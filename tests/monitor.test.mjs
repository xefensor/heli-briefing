import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonitor } from '../web/js/monitor.js';

function harness(overrides = {}) {
  let at = 0;
  let visibility = 'visible';
  let online = true;
  let sequence = 0;
  const timers = new Map();
  const ticks = [];
  const requests = [];
  const monitor = createMonitor({
    now: () => at,
    getVisibility: () => visibility,
    isOnline: () => online,
    setTimer: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: at + delay }); return id; },
    clearTimer: (id) => timers.delete(id),
    onTick: (time, state) => ticks.push({ time, state }),
    onRefresh: async (request) => { requests.push(request); },
    ...overrides,
  });
  async function advance(milliseconds) {
    const target = at + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      at = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    at = target;
    await flush();
  }
  return { monitor, timers, ticks, requests, advance,
    setTime: (value) => { at = value; },
    setVisibility: (value) => { visibility = value; },
    setOnline: (value) => { online = value; },
  };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

test('age ticks continue while inspection is pinned; products refresh at separate deadlines', async () => {
  const h = harness();
  assert.equal(h.monitor.getState().nextRefreshAt, null);
  h.monitor.start();
  assert.equal(h.requests.length, 0, 'initial app requests are not repeated');
  h.monitor.setLive(false);
  await h.advance(5 * 60_000);
  assert.equal(h.ticks.at(-1).time, 5 * 60_000);
  assert.equal(h.ticks.at(-1).state.live, false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].forecast, false);
  assert.equal(h.requests[0].aviation, true);
  await h.advance(5 * 60_000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].forecast, true);
  assert.equal(h.requests[1].aviation, true);
  assert.equal(h.monitor.getState().products.forecast.succeededAt, 10 * 60_000);
  assert.equal(h.timers.size, 1);
});

test('hidden and offline periods do no HTTP work and wake performs one overdue refresh', async () => {
  const h = harness();
  h.monitor.start();
  h.setVisibility('hidden');
  await h.advance(20 * 60_000);
  assert.equal(h.requests.length, 0);
  assert.ok(h.ticks.length > 10, 'age clock still ticks while hidden');
  h.setVisibility('visible');
  h.setOnline(false);
  await h.monitor.wake('visible');
  assert.equal(h.requests.length, 0);
  h.setOnline(true);
  await h.monitor.wake('online');
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].forecast, true);
  assert.equal(h.requests[0].aviation, true);
  await h.monitor.wake('focus');
  assert.equal(h.requests.length, 1, 'resume does not replay missed intervals');
  assert.equal(h.timers.size, 1);
});

test('manual and scheduled refresh calls coalesce while a request is unresolved', async () => {
  let release;
  const calls = [];
  const h = harness({ onRefresh: (request) => { calls.push(request); return new Promise((resolve) => { release = resolve; }); } });
  h.monitor.start();
  const first = h.monitor.refresh();
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(h.monitor.getState().refreshing, true);
  const second = h.monitor.refresh();
  await h.advance(20 * 60_000);
  assert.equal(calls.length, 1);
  assert.equal(h.timers.size, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(h.monitor.getState().refreshing, false);
  assert.equal(h.monitor.getState().products.aviation.succeededAt, 20 * 60_000);
  assert.equal(h.monitor.getState().products.forecast.attemptedAt, 0);
  assert.equal(h.monitor.getState().products.forecast.nextAt, 30 * 60_000);
});

test('per-product errors retain success time and use bounded backoff including Retry-After', async () => {
  let fail = false;
  const h = harness({ onRefresh: async () => fail ? {
    forecast: { ok: false, error: 'HTTP 429', retryAt: 30 * 60_000 },
    aviation: true,
  } : { forecast: true, aviation: true } });
  h.monitor.start();
  await h.monitor.refresh();
  fail = true;
  await h.advance(10 * 60_000);
  const state = h.monitor.getState();
  assert.equal(state.products.forecast.succeededAt, 0);
  assert.equal(state.products.forecast.attemptedAt, 10 * 60_000);
  assert.equal(state.products.forecast.error, 'HTTP 429');
  assert.equal(state.products.forecast.nextAt, 30 * 60_000);
  assert.equal(state.products.aviation.succeededAt, 10 * 60_000);
  fail = false;
  await h.advance(20 * 60_000);
  assert.equal(h.monitor.getState().products.forecast.succeededAt, 30 * 60_000);
  assert.equal(h.monitor.getState().products.forecast.error, null);
});

test('repeated failures back off without a tight loop and cap at product interval', async () => {
  const requests = [];
  const h = harness({ onRefresh: async (request) => { requests.push(request); throw new Error('offline source'); } });
  h.monitor.start();
  await h.monitor.refresh();
  assert.equal(h.monitor.getState().products.aviation.nextAt, 60_000);
  await h.advance(60_000);
  assert.equal(h.monitor.getState().products.aviation.nextAt, 3 * 60_000);
  await h.advance(2 * 60_000);
  assert.equal(h.monitor.getState().products.aviation.nextAt, 7 * 60_000);
  await h.advance(4 * 60_000);
  assert.equal(h.monitor.getState().products.aviation.nextAt, 12 * 60_000);
  assert.equal(requests.length, 4);
  assert.equal(h.timers.size, 1);
});

test('stop clears the timer, aborts work and prevents late completion from changing state', async () => {
  let release;
  let signal;
  const h = harness({ onRefresh: (request) => { signal = request.signal; return new Promise((resolve) => { release = resolve; }); } });
  h.monitor.start();
  const pending = h.monitor.refresh();
  await flush();
  h.monitor.stop();
  assert.equal(signal.aborted, true);
  assert.equal(h.timers.size, 0);
  h.setTime(5 * 60_000);
  release();
  await pending;
  assert.equal(h.monitor.getState().products.forecast.succeededAt, null);
  assert.equal(h.monitor.getState().active, false);
  const ticks = h.ticks.length;
  await h.monitor.wake('focus');
  await h.monitor.refresh();
  assert.equal(h.ticks.length, ticks);
});

test('restart checks elapsed deadlines once and start is idempotent', async () => {
  const h = harness();
  h.monitor.start();
  h.monitor.start();
  assert.equal(h.timers.size, 1);
  h.monitor.stop();
  h.setTime(20 * 60_000);
  h.monitor.start();
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].reason, 'start');
  assert.equal(h.timers.size, 1);
});

test('late work from before stop cannot overwrite or release a newer refresh', async () => {
  const pending = [];
  const h = harness({ onRefresh: () => new Promise((resolve) => pending.push(resolve)) });
  h.monitor.start();
  const old = h.monitor.refresh();
  await flush();
  h.monitor.stop();
  h.setTime(20 * 60_000);
  h.monitor.start();
  await flush();
  assert.equal(pending.length, 2);
  pending[0]();
  await old;
  assert.equal(h.monitor.getState().refreshing, true);
  assert.equal(h.monitor.getState().products.forecast.succeededAt, null);
  pending[1]();
  await flush();
  assert.equal(h.monitor.getState().refreshing, false);
  assert.equal(h.monitor.getState().products.forecast.succeededAt, 20 * 60_000);
  assert.equal(h.timers.size, 1);
});

test('state is isolated from callers and render errors remain visible without terminating ticks', async () => {
  let calls = 0;
  const h = harness({ onTick: () => { calls++; if (calls < 3) throw new Error('render failure'); } });
  h.monitor.start();
  assert.equal(h.monitor.getState().tickError, 'render failure');
  const external = h.monitor.getState();
  external.products.forecast.nextAt = 0;
  assert.equal(h.monitor.getState().products.forecast.nextAt, 10 * 60_000);
  await h.advance(60_000);
  assert.equal(h.monitor.getState().tickError, null);
  assert.equal(h.timers.size, 1);
  assert.throws(() => createMonitor({ intervals: { tick: 0 } }), RangeError);
});

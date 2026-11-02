import test from 'node:test';
import assert from 'node:assert/strict';
import { createForecastClient } from '../web/js/weather.js';

const instant = Date.parse('2026-11-02T14:00:00Z');
const point = { lat: 48.9463, lon: 14.4294, model: 'aladin' };
function payload(values = [3, 4, 5]) {
  return {
    latitude: 48.95, longitude: 14.43, elevation: 425,
    hourly_units: { time: 'unixtime', temperature_2m: '°C' },
    hourly: { time: [0, 1, 2].map(hour => instant / 1000 + hour * 3600), temperature_2m: values },
  };
}
function response(status = 200, data = payload(), headers = {}) {
  return { ok: status >= 200 && status < 300, status,
    headers: new Headers({ 'Content-Type': 'application/json', ...headers }),
    json: async () => data };
}
function immediateWait(delays = []) {
  return async (milliseconds, signal) => {
    delays.push(milliseconds);
    if (signal?.aborted) throw signal.reason;
  };
}
function cancellableDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

test('a brief 503 retries the exact model/query once and reports the second attempt', async () => {
  const urls = [], waits = [], retries = [];
  const client = createForecastClient({ storage: null, now: () => instant,
    waitForRetry: immediateWait(waits),
    fetchImpl: async url => { urls.push(url); return response(urls.length === 1 ? 503 : 200); },
  });
  const result = await client.fetchForecast({ ...point, onRetry: details => retries.push(details) });
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
  assert.equal(new URL(urls[1]).searchParams.get('models'), 'chmi_aladin_central_europe_2km');
  assert.deepEqual(waits, [1000]);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].attempt, 2);
  assert.equal(retries[0].maxAttempts, 2);
  assert.equal(retries[0].delayMs, 1000);
  assert.equal(retries[0].error.status, 503);
  assert.equal(result.model, 'aladin');
  assert.equal(result.transport.status, 'live');
});

test('eligible 502/504 and fast network failures get one bounded same-query retry', async () => {
  for (const failure of [502, 504, 'network']) {
    let calls = 0;
    const urls = [], waits = [];
    const client = createForecastClient({ storage: null, now: () => instant, retryDelayMs: 1,
      waitForRetry: immediateWait(waits), fetchImpl: async url => {
        urls.push(url); calls++;
        if (calls === 1) {
          if (failure === 'network') throw new TypeError('brief network interruption');
          return response(failure);
        }
        return response();
      } });
    const result = await client.fetchForecast(point);
    assert.equal(calls, 2, String(failure));
    assert.equal(urls[0], urls[1]);
    assert.deepEqual(waits, [1]);
    assert.equal(result.transport.status, 'live');
  }
});

test('400, 500 and malformed successful responses do not trigger recovery retries', async () => {
  for (const kind of [400, 500, 'json', 'shape']) {
    let calls = 0;
    const waits = [];
    const client = createForecastClient({ storage: null, now: () => instant,
      waitForRetry: immediateWait(waits), fetchImpl: async () => {
        calls++;
        if (typeof kind === 'number') return response(kind);
        if (kind === 'json') return { ...response(), json: async () => { throw new SyntaxError('bad JSON'); } };
        return response(200, { error: false, hourly: {} });
      } });
    await assert.rejects(client.fetchForecast(point));
    assert.equal(calls, 1, String(kind));
    assert.deepEqual(waits, [], String(kind));
  }
});

test('future 503 Retry-After is observed without an immediate second attempt', async () => {
  let clock = instant, calls = 0;
  const waits = [], retries = [];
  const client = createForecastClient({ storage: null, now: () => clock,
    waitForRetry: immediateWait(waits), fetchImpl: async () => {
      calls++;
      return calls === 1 ? response(503, null, { 'Retry-After': '30' }) : response();
    } });
  await assert.rejects(client.fetchForecast({ ...point, onRetry: value => retries.push(value) }),
    error => error.status === 503 && error.retryAt === new Date(instant + 30000).toISOString());
  await assert.rejects(client.fetchForecast({ ...point, lat: 49, force: true }), error => error.status === 503);
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
  assert.deepEqual(retries, []);
  clock += 30000;
  assert.equal((await client.fetchForecast({ ...point, force: true })).transport.status, 'live');
  assert.equal(calls, 2);
});

test('terminal transient failure creates a 60-second model cooldown across points, not other models', async () => {
  let clock = instant, calls = 0, recovered = false;
  const waits = [];
  const client = createForecastClient({ storage: null, now: () => clock, retryDelayMs: 0,
    waitForRetry: immediateWait(waits), fetchImpl: async url => {
      calls++;
      const aladin = new URL(url).searchParams.get('models') === 'chmi_aladin_central_europe_2km';
      return response(aladin && !recovered ? 503 : 200);
    } });
  await assert.rejects(client.fetchForecast(point),
    error => error.status === 503 && error.retryAt === new Date(instant + 60000).toISOString());
  assert.equal(calls, 2);
  await assert.rejects(client.fetchForecast({ ...point, lat: 49, force: true }), error => error.status === 503);
  assert.equal(calls, 2);
  assert.equal((await client.fetchForecast({ ...point, model: 'icon', force: true })).model, 'icon');
  assert.equal(calls, 3);
  recovered = true; clock += 60000;
  assert.equal((await client.fetchForecast({ ...point, lat: 49, force: true })).transport.status, 'live');
  assert.equal(calls, 4);
  assert.equal(waits.length, 1);
});

test('429 creates a provider-wide cooldown that force and model/location changes cannot bypass', async () => {
  let clock = instant, calls = 0;
  const waits = [];
  const client = createForecastClient({ storage: null, now: () => clock,
    waitForRetry: immediateWait(waits), fetchImpl: async () => {
      calls++;
      return calls === 1 ? response(429, null, { 'Retry-After': '120' }) : response();
    } });
  const blocked = error => error.code === 'rate-limit' && error.status === 429
    && error.retryAt === new Date(instant + 120000).toISOString();
  await assert.rejects(client.fetchForecast(point), blocked);
  await assert.rejects(client.fetchForecast({ ...point, model: 'icon', lat: 49, force: true }), blocked);
  await assert.rejects(client.fetchForecast({ ...point, model: 'ecmwf', lon: 15, force: true }), blocked);
  assert.equal(calls, 1);
  assert.deepEqual(waits, []);
  clock += 120000;
  assert.equal((await client.fetchForecast({ ...point, model: 'ecmwf', force: true })).model, 'ecmwf');
  assert.equal(calls, 2);
});

test('429 HTTP-date is preserved and absent/short Retry-After still has a 60-second floor', async () => {
  for (const [header, seconds] of [[new Date(instant + 180000).toUTCString(), 180], [null, 60], ['1', 60]]) {
    let calls = 0;
    const client = createForecastClient({ storage: null, now: () => instant,
      fetchImpl: async () => { calls++; return response(429, null, header === null ? {} : { 'Retry-After': header }); } });
    const failure = error => error.code === 'rate-limit' && error.retryAt === new Date(instant + seconds * 1000).toISOString();
    await assert.rejects(client.fetchForecast(point), failure);
    await assert.rejects(client.fetchForecast({ ...point, model: 'icon', force: true }), failure);
    assert.equal(calls, 1);
  }
});

test('aborting the retry wait never returns stale cache or installs a failure cooldown', async () => {
  let clock = instant, calls = 0, reachedWait;
  const waiting = new Promise(resolve => { reachedWait = resolve; });
  const client = createForecastClient({ storage: null, now: () => clock,
    fetchImpl: async () => { calls++; return response(calls === 2 ? 503 : 200); },
    waitForRetry: async (_, signal) => {
      reachedWait();
      return new Promise((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    } });
  const first = await client.fetchForecast(point);
  clock += 11000;
  const controller = new AbortController();
  const request = client.fetchForecast({ ...point, force: true, signal: controller.signal });
  await waiting;
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  const next = await client.fetchForecast({ ...point, force: true });
  assert.equal(next.transport.status, 'live');
  assert.equal(calls, 3);
  assert.equal(first.retrievedAt, new Date(instant).toISOString());
});

test('an all-null 200 is not retried and cannot overwrite genuine cached values or clocks', async () => {
  let clock = instant, calls = 0;
  const waits = [];
  const client = createForecastClient({ storage: null, now: () => clock,
    waitForRetry: immediateWait(waits), fetchImpl: async () => {
      calls++;
      return response(200, payload(calls === 1 ? [3, 4, 5] : [null, null, null]));
    } });
  const first = await client.fetchForecast(point);
  clock += 11 * 60000;
  const stale = await client.fetchForecast({ ...point, force: true });
  assert.equal(calls, 2);
  assert.deepEqual(waits, []);
  assert.equal(stale.transport.status, 'stale');
  assert.equal(stale.transport.error.code, 'no-data');
  assert.equal(stale.retrievedAt, first.retrievedAt);
  assert.deepEqual(stale.hourly.temperature, [3, 4, 5]);
});

test('an all-null first response is a visible no-data failure, never a successful empty forecast', async () => {
  let calls = 0;
  const client = createForecastClient({ storage: null, now: () => instant,
    fetchImpl: async () => { calls++; return response(200, payload([null, null, null])); } });
  await assert.rejects(client.fetchForecast(point), error => error.code === 'no-data');
  assert.equal(calls, 1);
});

test('failure recovery retains only the same point/model cache and its original retrieval time', async () => {
  let clock = instant, calls = 0;
  const client = createForecastClient({ storage: null, now: () => clock, retryDelayMs: 0,
    waitForRetry: immediateWait(), fetchImpl: async () => { calls++; return response(calls === 1 ? 200 : 503); } });
  const first = await client.fetchForecast(point);
  clock += 11 * 60000;
  const stale = await client.fetchForecast({ ...point, force: true });
  assert.equal(stale.transport.status, 'stale');
  assert.equal(stale.transport.error.status, 503);
  assert.equal(stale.retrievedAt, first.retrievedAt);
  assert.deepEqual(stale.hourly.temperature, first.hourly.temperature);
  await assert.rejects(client.fetchForecast({ ...point, lat: point.lat + 0.00001, force: true }));
  assert.equal(calls, 3);
});

test('the total timeout covers retry delay and the second attempt instead of restarting the budget', async () => {
  let calls = 0;
  const client = createForecastClient({ storage: null, now: () => instant, timeoutMs: 50, retryDelayMs: 30,
    waitForRetry: cancellableDelay, fetchImpl: async (_, { signal }) => {
      calls++;
      if (calls === 1) return response(503);
      await cancellableDelay(30, signal);
      return response();
    } });
  await assert.rejects(client.fetchForecast(point), error => error.code === 'timeout');
  assert.ok(calls >= 1 && calls <= 2);
});

test('an older failed request cannot install a cooldown over a newer successful same-key request', async () => {
  const pending = [];
  let calls = 0, failing = true;
  const client = createForecastClient({ storage: null, now: () => instant, retryDelayMs: 0,
    waitForRetry: immediateWait(), fetchImpl: async () => {
      calls++;
      if (calls <= 2) return new Promise(resolve => pending.push(resolve));
      return response(failing ? 503 : 200, payload([9, 10, 11]));
    } });
  const older = client.fetchForecast({ ...point, force: true });
  const newer = client.fetchForecast({ ...point, force: true });
  pending[1](response(200, payload([9, 10, 11])));
  await newer;
  const oldFailure = assert.rejects(older, error => error.status === 503);
  pending[0](response(503));
  await oldFailure;
  const before = calls;
  failing = false;
  const latest = await client.fetchForecast({ ...point, force: true });
  assert.equal(calls, before + 1);
  assert.equal(latest.transport.status, 'live');
  assert.deepEqual(latest.hourly.temperature, [9, 10, 11]);
});

test('an old v2 all-null session entry is ignored even inside the fresh-cache interval', async () => {
  const key = `heli-forecast-v2:${point.model}:${point.lat}:${point.lon}`;
  const stored = JSON.stringify({ version: 2, data: {
    model: point.model, requestedLocation: { lat: point.lat, lon: point.lon },
    times: [0, 1, 2].map(hour => new Date(instant + hour * 3600000).toISOString()),
    retrievedAt: new Date(instant - 1000).toISOString(), validFrom: null, validTo: null,
    hourly: { temperature: [null, null, null] },
  } });
  const reads = [];
  const storage = { getItem: name => { reads.push(name); return name === key ? stored : null; },
    setItem() {}, removeItem() {}, length: 0, key: () => null };
  let calls = 0;
  const client = createForecastClient({ storage, now: () => instant,
    fetchImpl: async () => { calls++; return response(); } });
  const result = await client.fetchForecast(point);
  assert.ok(reads.includes(key), 'the old entry was actually inspected');
  assert.equal(calls, 1);
  assert.equal(result.transport.status, 'live');
  assert.equal(result.validFrom, new Date(instant).toISOString());
  assert.deepEqual(result.hourly.temperature, [3, 4, 5]);
});

test('an already waiting 503/network retry stops if another request records a provider-wide 429 pause', async () => {
  for (const failure of [503, 'network']) {
    let calls = 0, releaseRetry, reachedRetry;
    const waiting = new Promise(resolve => { reachedRetry = resolve; });
    const client = createForecastClient({ storage: null, now: () => instant, retryDelayMs: 0,
      waitForRetry: async () => { reachedRetry(); return new Promise(resolve => { releaseRetry = resolve; }); },
      fetchImpl: async url => {
        calls++;
        if (new URL(url).searchParams.get('models') === 'icon_d2') return response(429, null, { 'Retry-After': '120' });
        if (calls === 1) {
          if (failure === 'network') throw new TypeError('brief network interruption');
          return response(failure);
        }
        return response();
      } });
    const pending = client.fetchForecast(point);
    await waiting;
    await assert.rejects(client.fetchForecast({ ...point, model: 'icon', force: true }), error => error.status === 429);
    const blocked = assert.rejects(pending, error => error.code === 'rate-limit' && error.status === 429
      && error.retryAt === new Date(instant + 120000).toISOString());
    releaseRetry();
    await blocked;
    assert.equal(calls, 2, `${failure} retry must not reach fetch after the pause`);
  }
});

test('an already waiting retry respects a new same-model 503 pause established at another point', async () => {
  let calls = 0, releaseRetry, reachedRetry;
  const waiting = new Promise(resolve => { reachedRetry = resolve; });
  const client = createForecastClient({ storage: null, now: () => instant, retryDelayMs: 0,
    waitForRetry: async () => { reachedRetry(); return new Promise(resolve => { releaseRetry = resolve; }); },
    fetchImpl: async url => {
      calls++;
      if (new URL(url).searchParams.get('latitude') === '49') return response(503, null, { 'Retry-After': '90' });
      return response(calls === 1 ? 503 : 200);
    } });
  const pending = client.fetchForecast(point);
  await waiting;
  await assert.rejects(client.fetchForecast({ ...point, lat: 49, force: true }), error => error.status === 503);
  const blocked = assert.rejects(pending, error => error.status === 503
    && error.retryAt === new Date(instant + 90000).toISOString());
  releaseRetry();
  await blocked;
  assert.equal(calls, 2);
});

test('an older same-key 429 still pauses the provider after a newer request succeeded', async () => {
  let calls = 0;
  const pending = [];
  const client = createForecastClient({ storage: null, now: () => instant,
    fetchImpl: async () => { calls++; return new Promise(resolve => pending.push(resolve)); } });
  const older = client.fetchForecast({ ...point, force: true });
  const newer = client.fetchForecast({ ...point, force: true });
  pending[1](response(200, payload([9, 10, 11])));
  await newer;
  const olderLimit = assert.rejects(older, error => error.status === 429);
  pending[0](response(429, null, { 'Retry-After': '120' }));
  await olderLimit;
  await assert.rejects(client.fetchForecast({ ...point, model: 'icon', lat: 49, force: true }),
    error => error.code === 'rate-limit' && error.retryAt === new Date(instant + 120000).toISOString());
  assert.equal(calls, 2);
});

test('an older successful point request cannot clear a newer same-model Retry-After pause', async () => {
  let calls = 0, finishOlder;
  const client = createForecastClient({ storage: null, now: () => instant,
    fetchImpl: async url => {
      calls++;
      if (calls === 1) return new Promise(resolve => { finishOlder = resolve; });
      if (new URL(url).searchParams.get('latitude') === '49') return response(503, null, { 'Retry-After': '90' });
      return response();
    } });
  const older = client.fetchForecast({ ...point, force: true });
  await assert.rejects(client.fetchForecast({ ...point, lat: 49, force: true }), error => error.status === 503);
  finishOlder(response());
  assert.equal((await older).transport.status, 'live');
  await assert.rejects(client.fetchForecast({ ...point, lat: 50, force: true }),
    error => error.status === 503 && error.retryAt === new Date(instant + 90000).toISOString());
  assert.equal(calls, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { settleForecastPair, forecastPairOutcome } from '../web/js/forecast-loading.js';

const now = Date.parse('2026-11-02T12:00:00Z');
const valid = (model = 'aladin') => ({ model, validFrom: '2026-11-02T11:00:00Z', retrievedAt: '2026-11-02T11:55:00Z', runTime: null, transport: { stale: false, error: null } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

test('a deferred comparison cannot delay publication of successful main-model data', async () => {
  const main = deferred(), comparison = deferred(), mainNotified = deferred(), started = [], notifications = [];
  const forecast = valid();
  let finished = false;
  const pair = settleForecastPair({
    main: () => { started.push('main'); return main.promise; },
    comparison: () => { started.push('comparison'); return comparison.promise; },
    onSettled: (kind, outcome) => { notifications.push({ kind, outcome }); if (kind === 'main') mainNotified.resolve(); },
  });
  pair.then(() => { finished = true; });
  assert.deepEqual(started, ['main', 'comparison']);
  main.resolve(forecast);
  await mainNotified.promise;
  assert.equal(finished, false);
  assert.deepEqual(notifications, [{ kind: 'main', outcome: { status: 'fulfilled', value: forecast } }]);
  const error = new Error('Comparison HTTP503'); comparison.reject(error);
  const result = await pair;
  assert.equal(result.main.value, forecast);
  assert.equal(result.comparison.reason, error);
  assert.deepEqual(notifications.map(item => item.kind), ['main', 'comparison']);
});

test('comparison can publish first and a synchronous main failure does not prevent its start', async () => {
  const main = deferred(), comparison = valid('icon'), comparisonNotified = deferred(), notifications = [];
  const pair = settleForecastPair({ main: () => main.promise, comparison: () => comparison, onSettled: kind => { notifications.push(kind); if (kind === 'comparison') comparisonNotified.resolve(); } });
  await comparisonNotified.promise;
  assert.deepEqual(notifications, ['comparison']);
  main.reject(new Error('Main unavailable'));
  assert.equal((await pair).main.status, 'rejected');
  const error = new Error('Synchronous source error');
  let comparisonStarted = false;
  const result = await settleForecastPair({ main: () => { throw error; }, comparison: () => { comparisonStarted = true; return comparison; }, onSettled: () => assert.equal(comparisonStarted, true) });
  assert.equal(comparisonStarted, true);
  assert.equal(result.main.reason, error);
  assert.equal(result.comparison.value, comparison);
});

test('an unrequested comparison is a fulfilled null rather than a failed source', async () => {
  const notifications = [];
  const result = await settleForecastPair({ main: () => valid(), comparison: null, onSettled: (kind, outcome) => notifications.push([kind, outcome.status]) });
  assert.deepEqual(result.comparison, { status: 'fulfilled', value: null });
  assert.equal(notifications.filter(([kind]) => kind === 'main').length, 1);
  assert.equal(notifications.filter(([kind]) => kind === 'comparison').length, 1);
  assert.deepEqual(forecastPairOutcome(result, { nowMs: now }), { ok: true, error: undefined, retryAt: undefined });
});

test('mixed main/comparison failures preserve the latest future cooldown in milliseconds', () => {
  const mainError = Object.assign(new Error('Main HTTP503'), { retryAt: '2026-11-02T12:02:00Z' });
  const comparisonError = Object.assign(new Error('Comparison rate limit'), { retryAt: now + 5 * 60000 });
  const result = forecastPairOutcome({ main: { status: 'rejected', reason: mainError }, comparison: { status: 'rejected', reason: comparisonError } }, { comparisonRequested: true, nowMs: now });
  assert.equal(result.ok, false);
  assert.match(result.error, /Main HTTP503/);
  assert.match(result.error, /Porovnání: Comparison rate limit/);
  assert.equal(result.retryAt, now + 5 * 60000);
});

test('a failed or stale comparison remains a failure even when the main forecast is usable', () => {
  for (const comparison of [
    { status: 'rejected', reason: Object.assign(new Error('HTTP503'), { retryAt: now + 120000 }) },
    { status: 'fulfilled', value: { ...valid('icon'), transport: { stale: true, error: { message: 'Cached after HTTP503', retryAt: '2026-11-02T12:03:00Z' } } } },
  ]) {
    const result = forecastPairOutcome({ main: { status: 'fulfilled', value: valid() }, comparison }, { comparisonRequested: true, nowMs: now });
    assert.equal(result.ok, false);
    assert.match(result.error, /^Porovnání: /);
    assert.ok(result.retryAt > now);
  }
});

test('stale/error transport and empty coverage remain failures without changing original source clocks', () => {
  const cached = Object.freeze({ ...valid(), transport: Object.freeze({ stale: true, error: Object.freeze({ message: 'Refresh failed', retryAt: '2026-11-02T12:04:00Z' }) }) });
  const result = forecastPairOutcome({ main: { status: 'fulfilled', value: cached } }, { nowMs: now });
  assert.equal(result.ok, false); assert.equal(result.error, 'Refresh failed');
  assert.equal(result.retryAt, now + 240000);
  assert.equal(cached.retrievedAt, '2026-11-02T11:55:00Z'); assert.equal(cached.runTime, null);
  for (const data of [null, { ...valid(), validFrom: null }, { ...valid(), validFrom: 'invalid' }, { ...valid(), transport: { stale: false, error: { message: 'Transport failed' } } }]) {
    assert.equal(forecastPairOutcome({ main: { status: 'fulfilled', value: data } }, { nowMs: now }).ok, false);
  }
});

test('past, invalid and unrequested cooldowns cannot delay a healthy pair', () => {
  const main = { status: 'fulfilled', value: valid() };
  assert.deepEqual(forecastPairOutcome({ main, comparison: { status: 'rejected', reason: { message: 'Ignored source', retryAt: now + 3600000 } } }, { nowMs: now }), { ok: true, error: undefined, retryAt: undefined });
  for (const retryAt of ['invalid', '2026-11-02T11:59:00Z', now, Infinity]) {
    const outcome = forecastPairOutcome({ main: { status: 'rejected', reason: { message: 'Source failed', retryAt } } }, { nowMs: now });
    assert.equal(outcome.ok, false); assert.equal(outcome.retryAt, undefined);
  }
});

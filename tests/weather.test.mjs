import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, createForecastClient, forecastUrl, normalizeForecast, nearestTimeIndex, forecastWindowIndices } from '../web/js/weather.js';

const instant = Date.parse('2026-11-01T12:00:00Z');
const options = { lat: 48.9463, lon: 14.4294, model: 'aladin', retrievedAt: '2026-11-01T12:00:00Z' };
function payload(overrides = {}) {
  return {
    latitude: 48.94, longitude: 14.43, elevation: 419,
    hourly_units: { time: 'unixtime', temperature_2m: '°C', pressure_msl: 'hPa', wind_speed_10m: 'kn', precipitation: 'mm', wind_speed_925hPa: 'kn', geopotential_height_925hPa: 'm' },
    hourly: { time: [instant / 1000, instant / 1000 + 3600, instant / 1000 + 7200], temperature_2m: [0, null, 3], wind_speed_10m: [0, 7, null], pressure_msl: [1010, 1011, 1012], precipitation: [0, 0.5, null], wind_speed_925hPa: [8, 12, 10], geopotential_height_925hPa: [800, 400, 900], ...overrides },
  };
}
function response(data = payload()) { return { ok: true, json: async () => data }; }

test('normalization preserves zero, gaps, UTC time, coverage and interval semantics', () => {
  const result = normalizeForecast(payload(), options);
  assert.equal(result.times[0], '2026-11-01T12:00:00.000Z');
  assert.deepEqual(result.hourly.temperature, [0, null, 3]);
  assert.deepEqual(result.hourly.cloudLow, [null, null, null]);
  assert.equal(result.coverage.temperature, 2);
  assert.equal(result.runTime, null);
  assert.match(result.semantics.precipitation, /preceding hour/);
  assert.equal(result.grid.elevation, 419);
  assert.deepEqual(result.hourly.wind925, [8, null, 10]);
  assert.deepEqual(result.belowTerrain, [false, true, false]);
});

test('unexpected units and numeric strings are not silently interpreted', () => {
  const input = payload({ wind_speed_10m: ['5', 0, Infinity] });
  input.hourly_units.pressure_msl = 'Pa';
  const result = normalizeForecast(input, options);
  assert.deepEqual(result.hourly.pressure, [null, null, null]);
  assert.deepEqual(result.hourly.wind, [null, 0, null]);
});

test('ECMWF HRES never borrows pressure-level fields from another distribution', () => {
  const result = normalizeForecast(payload(), { ...options, model: 'ecmwf' });
  assert.deepEqual(result.hourly.wind925, [null, null, null]);
  assert.equal(result.capabilities.wind925.reason, 'unsupported-model-field');
  assert.equal(result.apiModel, 'ecmwf_ifs');
  const url = new URL(forecastUrl({ ...options, model: 'ecmwf' }));
  assert.equal(url.searchParams.get('models'), 'ecmwf_ifs');
  assert.ok(!url.searchParams.get('hourly').includes('925'));
  assert.equal(MODELS.find(m => m.id === 'aladin').apiModel, 'chmi_aladin_central_europe_2km');
});

test('reject malformed times and invalid coordinates; no clamping across horizon', () => {
  assert.throws(() => normalizeForecast(payload({ time: [1, 1] }), options), /časy/);
  const wrongTime = payload();
  wrongTime.hourly_units.time = 'iso8601';
  assert.throws(() => normalizeForecast(wrongTime, options), /očekávanou/);
  assert.throws(() => normalizeForecast(payload(), { ...options, lat: NaN }), /souřadnice/);
  const times = normalizeForecast(payload(), options).times;
  assert.equal(nearestTimeIndex(times, instant - 1000), -1);
  assert.equal(nearestTimeIndex(times, instant + 60 * 60000), 1);
  assert.equal(nearestTimeIndex(times, instant + 29 * 60000), 0);
  assert.equal(nearestTimeIndex(times, instant + 30 * 60000), 0);
  assert.equal(nearestTimeIndex(times, instant + 3 * 3600000), -1);
  assert.deepEqual(forecastWindowIndices(times, instant + 1, 1), [1]);
});

test('cache stays scoped to exact model/location and exposes stale source failure', async () => {
  let clock = instant;
  let calls = 0;
  let fail = false;
  const client = createForecastClient({ storage: null, now: () => clock, fetchImpl: async () => { calls++; if (fail) throw new TypeError('offline'); return response(); } });
  const first = await client.fetchForecast(options);
  const cached = await client.fetchForecast(options);
  assert.equal(calls, 1);
  assert.equal(cached.transport.status, 'cached');
  assert.equal(first.transport.status, 'live');
  cached.hourly.temperature[0] = 99;
  assert.equal((await client.fetchForecast(options)).hourly.temperature[0], 0);
  await client.fetchForecast({ ...options, model: 'icon' });
  await client.fetchForecast({ ...options, lat: options.lat + 0.00001 });
  assert.equal(calls, 3);
  clock += 11 * 60000;
  fail = true;
  const stale = await client.fetchForecast(options);
  assert.equal(stale.transport.status, 'stale');
  assert.equal(stale.transport.error.code, 'network');
  assert.equal(stale.retrievedAt, first.retrievedAt);
  assert.equal(stale.transport.ageMs, 11 * 60000);
  clock += 6 * 3600000;
  await assert.rejects(client.fetchForecast(options), /načíst/);
});

test('late old same-key response cannot replace newer successful response in cache', async () => {
  const pending = [];
  const client = createForecastClient({ storage: null, now: () => instant, fetchImpl: () => new Promise(resolve => pending.push(resolve)) });
  const old = client.fetchForecast(options);
  const newer = client.fetchForecast(options);
  pending[1](response(payload({ temperature_2m: [4, 5, 6] })));
  await newer;
  pending[0](response(payload({ temperature_2m: [1, 2, 3] })));
  await old;
  assert.deepEqual((await client.fetchForecast(options)).hourly.temperature, [4, 5, 6]);
});

test('aborted callers never receive cached/stale weather and abort does not affect other requests', async () => {
  const pending = [];
  const client = createForecastClient({ storage: null, now: () => instant, fetchImpl: () => new Promise(resolve => pending.push(resolve)) });
  const controller = new AbortController();
  const cancelled = client.fetchForecast({ ...options, signal: controller.signal });
  const other = client.fetchForecast(options);
  controller.abort();
  pending[0](response());
  pending[1](response());
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.equal((await other).transport.status, 'live');
  await assert.rejects(client.fetchForecast({ ...options, signal: controller.signal }), { name: 'AbortError' });
});

test('rate limit preserves Retry-After without automatic retry', async () => {
  let calls = 0;
  const client = createForecastClient({ storage: null, now: () => instant, fetchImpl: async () => {
    calls++;
    return { ok: false, status: 429, headers: { get: () => '120' } };
  } });
  await assert.rejects(client.fetchForecast(options), error => error.code === 'rate-limit' && error.retryAt === '2026-11-01T12:02:00.000Z');
  assert.equal(calls, 1);
});

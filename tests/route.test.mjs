import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoutePlan, routeSchedule, loadRouteForecasts, routeDataKey, routeSample, captureRoute, renderRouteBriefing, routeText, validateRouteBundle } from '../web/js/route.js';
import { createBriefingSnapshot, renderBriefingHtml, renderBriefingText } from '../web/js/archive.js';
const a = { name: 'Planá', lat: 48.9463, lon: 14.4294, legMinutes: 0 }, b = { name: 'Kvilda', lat: 49.0197, lon: 13.5794, legMinutes: 25 };
const plan = points => ({ schemaVersion: 1, departure: '2026-11-01T23:50:00.000Z', points: points || [a, b] });
const fields = { wind: 0, gust: 3, direction: 0, visibility: 10000, cloudLow: 0, precipitation: 0, temperature: 6, dewpoint: 2, pressure: 1029 };
function forecast(point, model = 'aladin') { return { model, requestedLocation: { lat: point.lat, lon: point.lon }, grid: { lat: point.lat, lon: point.lon, elevation: 420 }, times: ['2026-11-01T23:00:00.000Z', '2026-11-02T00:00:00.000Z', '2026-11-02T01:00:00.000Z'], hourly: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, [value, value, null]])), retrievedAt: '2026-11-01T20:00:00.000Z', sourceUrl: 'https://api.open-meteo.com/v1/forecast', transport: { stale: false } }; }
function bundle() { return captureRoute(plan(), ['aladin'], Object.fromEntries([a, b].map(point => [routeDataKey(point, 'aladin'), { forecast: forecast(point) }]))); }

test('route timing crosses UTC/local midnight without turning inspection time into departure', () => {
  const rows = routeSchedule(plan());
  assert.equal(rows[0].passageAt, plan().departure); assert.equal(rows[1].passageAt, '2026-11-02T00:15:00.000Z');
  assert.equal(rows[1].elapsedMinutes, 25); assert.ok(rows[1].distanceKm > 60 && rows[1].distanceKm < 65);
  assert.equal(plan().departure, '2026-11-01T23:50:00.000Z');
});
test('a missing duration propagates missing passage times, never a guessed speed', () => {
  const rows = routeSchedule(plan([a, { ...b, legMinutes: null }, { ...a, legMinutes: 12 }]));
  assert.equal(rows[1].passageAt, null); assert.equal(rows[2].passageAt, null); assert.equal(rows[2].elapsedMinutes, null);
});
test('invalid plan fields, duration limits and overlong routes are rejected', () => {
  for (const legMinutes of [0, -1, 1.5, 601, '25', undefined]) assert.throws(() => normalizeRoutePlan(plan([a, { ...b, legMinutes }])));
  assert.throws(() => normalizeRoutePlan(plan(Array.from({ length: 7 }, () => a))));
  assert.throws(() => normalizeRoutePlan({ ...plan(), departure: '2026-02-30T12:00:00Z' }));
  assert.throws(() => normalizeRoutePlan(plan([{ ...a, lat: null }])));
});
test('DST repeated-hour route passages remain absolute instants', () => {
  const route = { ...plan([a, { ...b, legMinutes: 30 }]), departure: '2026-10-25T00:45:00.000Z' };
  assert.equal(routeSchedule(route)[1].passageAt, '2026-10-25T01:15:00.000Z');
});
test('samples preserve zero/null, stale transport and independent source/valid times', () => {
  const point = routeSchedule(plan())[0], data = forecast(a); data.hourly.visibility[1] = null; data.transport = { stale: true, error: { message: 'outage' } };
  const sample = routeSample({ forecast: data }, point, 'aladin');
  assert.equal(sample.values.wind, 0); assert.equal(sample.values.precipitation, 0); assert.equal(sample.values.visibility, null);
  assert.equal(sample.status, 'partial'); assert.equal(sample.stale, true); assert.equal(sample.validAt, '2026-11-02T00:00:00.000Z');
  assert.equal(sample.retrievedAt, data.retrievedAt); assert.equal(sample.runTime, null); assert.equal(sample.error, 'outage');
});
test('wrong model, wrong coordinates, absent hours and outside horizon do not leak weather', () => {
  const point = routeSchedule(plan())[0];
  assert.equal(routeSample({ forecast: forecast(b) }, point, 'aladin').status, 'context-error');
  assert.equal(routeSample({ forecast: forecast(a, 'icon') }, point, 'aladin').status, 'context-error');
  const gap = forecast(a); gap.times.splice(1, 1);
  const missing = routeSample({ forecast: gap }, point, 'aladin'); assert.equal(missing.status, 'outside-horizon'); assert.equal(missing.values.wind, null);
  assert.equal(routeSample({ forecast: forecast(a) }, { ...point, passageAt: '2026-11-03T00:00:00Z' }, 'aladin').status, 'outside-horizon');
});
test('route requests are bounded, duplicate coordinates reuse one result and missing times skip requests', async () => {
  let active = 0, maximum = 0, calls = 0;
  const p = plan([a, b, { ...a, legMinutes: 20 }, { ...b, legMinutes: null }]);
  const loaded = await loadRouteForecasts(p, ['aladin', 'icon'], { fetcher: async options => { active++; maximum = Math.max(maximum, active); calls++; await new Promise(resolve => setTimeout(resolve, 2)); active--; return forecast(options, options.model); } });
  assert.equal(maximum, 2); assert.equal(calls, 4); assert.equal(Object.keys(loaded.results).length, 4);
});
test('one point failure preserves other point results and a rate limit stops the queued work', async () => {
  const partial = await loadRouteForecasts(plan(), ['aladin'], { fetcher: async options => { if (options.lat === a.lat) throw new Error('outage'); return forecast(options); } });
  assert.equal(partial.results[routeDataKey(a, 'aladin')].error, 'outage'); assert.ok(partial.results[routeDataKey(b, 'aladin')].forecast);
  let calls = 0;
  const limited = await loadRouteForecasts(plan(), ['aladin', 'icon'], { fetcher: async () => { calls++; throw Object.assign(new Error('limited'), { status: 429, retryAt: '2026-11-02T01:00:00Z' }); } });
  assert.equal(limited.limited, true); assert.equal(calls, 2); assert.equal(limited.retryAt, '2026-11-02T01:00:00Z');
});
test('an aborted route request cannot complete as a successful route refresh', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadRouteForecasts(plan(), ['aladin'], { signal: controller.signal, fetcher: async () => { throw new Error('should not run'); } }), { name: 'AbortError' });
});
test('rendered output is escaped, gap-aware and contains no unsafe source link', () => {
  const route = bundle(); route.rows[0].name = '<script>bad</script>'; route.rows[0].samples[0].sourceUrl = 'javascript:alert(1)';
  const html = renderRouteBriefing(route, { zone: 'UTC' });
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('javascript:'));
  assert.equal((html.match(/<svg /g) || []).length, 2); assert.ok(html.includes('předchozí hodině')); assert.ok(html.includes('MSL'));
  assert.ok(routeText(route, 'UTC').join('\n').includes('průchod 2.11.2026 00:15 UTC'));
});
test('frozen full output includes route samples while report-only output stays scoped', () => {
  const route = bundle(), state = { ...a, model: 'aladin', compare: '', time: plan().departure, timezone: 'UTC', hours: 48 };
  const snapshot = createBriefingSnapshot({ state, route, createdAt: '2026-11-01T21:00:00.000Z' });
  route.rows[0].samples[0].values.wind = 100;
  assert.equal(snapshot.route.rows[0].samples[0].values.wind, 0);
  assert.ok(renderBriefingHtml(snapshot).includes('Počasí v bodech plánované trasy'));
  assert.ok(renderBriefingText(snapshot).includes('POČASÍ V BODECH TRASY'));
  assert.ok(!renderBriefingText(snapshot, { mode: 'reports' }).includes('POČASÍ V BODECH TRASY'));
  assert.ok(!renderBriefingHtml(snapshot, { mode: 'reports' }).includes('Počasí v bodech plánované trasy'));
});
test('archive route validation rejects changed models, passage time, coordinates and unsupported values', () => {
  for (const modify of [r => { r.models = ['icon']; }, r => { r.rows[1].passageAt = r.rows[0].passageAt; }, r => { r.rows[0].lat = 0; }, r => { r.rows[0].samples[0].values.wind = '0'; }, r => { r.rows[0].samples[0].validAt = null; }]) {
    const route = bundle(); modify(route); assert.throws(() => validateRouteBundle(route, ['aladin']));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createProcessedCeilingSource } from '../web/js/processed-ceiling-source.js';
import { fixtureTiff, fixtureCell } from './processed-geotiff-fixtures.mjs';

const ORIGIN = 'https://d34ooj23crdzyh.cloudfront.net';
const RUN = '2026110209_2026110211_2026110206';
const BASE = '2026-11-02T11:00:00Z';
const NOW = () => Date.parse('2026-11-02T12:37:00Z');
const point = fixtureCell(0, 0);
const name = hour => `ceiling_${RUN}_h${String(hour).padStart(2, '0')}m00.tif`;
function provider({ omit = [], fail = [], valueMissing = [], latestChange, htmlChange, redirect = '', future = false, quarter = false } = {}) {
  let active = 0, maxActive = 0;
  const requests = [];
  const frames = Array.from({ length: 10 }, (_, hour) => ({ filename: name(hour), hour, minute: 0, minutesOffset: hour * 60, source: hour < 2 ? 'RUC' : hour < 4 ? 'D2' : 'EU' })).filter(x => !omit.includes(x.hour));
  if (quarter) frames.splice(1, 0, ...[15, 30, 45].map(minute => ({ filename: name(0).replace('m00', `m${minute}`), hour: 0, minute, minutesOffset: minute, source: 'RUC' })));
  const original = { run_id: RUN, timestamp: '2026-11-02T12:00:00Z', viewers: { ceiling: `viewers/ceiling-viewer-${RUN}.html` } };
  const latest = latestChange ? latestChange(structuredClone(original)) : original;
  let html = `<script>window.ICON_CONFIG = {frames: ${JSON.stringify(frames)}, bounds: {lat_min: 43,lat_max:58,lon_min:-4,lon_max:20.5}, baseTime: '${future ? '2026-11-03T11:00:00Z' : BASE}', cogBaseUrl: '${ORIGIN}/cog', runId: '${RUN}', productType: 'ceiling'}; globalThis.__processedCeilingScriptExecuted = true;</script><footer>D2 2026-11-02 09Z &middot; RUC 2026-11-02 11Z &middot; EU 2026-11-02 06Z</footer>`;
  if (htmlChange) html = htmlChange(html);
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    assert.equal(options.credentials, 'omit'); assert.equal(options.mode, 'cors');
    assert.equal(new Headers(options.headers).has('Authorization'), false);
    active++; maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    if (redirect) return { ok: true, url: redirect, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) };
    if (String(url).includes('/latest.json')) return new Response(JSON.stringify(latest), { headers: { 'content-type': 'application/json' } });
    if (String(url).includes('/viewers/')) return new Response(html, { headers: { 'content-type': 'text/html' } });
    const match = /_h(\d{2,3})m(00|15|30|45)\.tif$/.exec(String(url)); assert.ok(match, String(url));
    const hour = +match[1], minute = +match[2];
    if (fail.includes(hour)) return new Response('unavailable', { status: 503 });
    const values = Array.from({ length: 16 }, (_, i) => i === 0 && valueMissing.includes(hour) ? NaN : hour * 100 + minute + i);
    return new Response(fixtureTiff({ values }), { headers: { 'content-type': 'image/tiff' } });
  };
  return { fetchImpl, requests, getMax: () => maxActive };
}

test('processed source preserves AGL, selected frame and each advertised model/run through an hourly series', async () => {
  const p = provider(), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  const r = await source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' });
  assert.equal(r.source, 'ClearToFly'); assert.equal(r.units, 'ft AGL'); assert.equal(r.product, 'CEILING');
  assert.equal(r.valueAglFt, 100); assert.equal(r.validAt, '2026-11-02T12:00:00.000Z');
  assert.equal(r.model, 'ICON-D2-RUC'); assert.equal(r.runTime, '2026-11-02T11:00:00.000Z');
  assert.deepEqual(r.series.values, [0, 100, 200, 300, 400, 500]);
  assert.deepEqual(r.series.frames.map(x => x.model), ['ICON-D2-RUC', 'ICON-D2-RUC', 'ICON-D2', 'ICON-D2', 'ICON-EU', 'ICON-EU']);
  assert.equal(r.series.frames[2].runTime, '2026-11-02T09:00:00.000Z');
  assert.equal(r.series.frames[4].runTime, '2026-11-02T06:00:00.000Z');
  assert.equal(r.regional.units, 'ft AGL'); assert.equal(r.regional.nodes[0].valueAglFt, 100);
  assert.equal(r.cell.index, 0); assert.ok(r.distanceKm < 1e-5);
  assert.equal(r.valueMsl, undefined); assert.equal(r.cell.gridUuid, undefined);
  assert.equal(globalThis.__processedCeilingScriptExecuted, undefined);
  assert.equal(p.getMax(), 2); assert.equal(p.requests.length, 8);
  const retrievedAt = r.retrievedAt, count = p.requests.length;
  const again = await source.load({ ...point, selectedTime: '2026-11-02T11:30:00Z' });
  assert.equal(again.validAt, '2026-11-02T11:00:00.000Z');
  assert.equal(again.retrievedAt, retrievedAt); assert.equal(p.requests.length, count);
});

test('NaN remains unknown while missing and failed frames remain separate null gaps', async () => {
  const p = provider({ omit: [3], fail: [2], valueMissing: [1] });
  const source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  const r = await source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' });
  assert.equal(r.status, 'partial'); assert.equal(r.valueAglFt, null); assert.equal(r.selectedStatus, 'missing');
  assert.deepEqual(r.series.values, [0, null, null, null, 400, 500]);
  assert.equal(r.series.frames[1].error, undefined);
  assert.ok(r.series.frames[2].error); assert.ok(r.series.frames[3].error);
  assert.equal(r.regional.nodes[0].valueAglFt, null);
});

test('selected quarter-hour is fetched independently from the six hourly series slots', async () => {
  const p = provider({ quarter: true }), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  const r = await source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' });
  assert.equal(r.validAt, '2026-11-02T11:30:00.000Z'); assert.equal(r.valueAglFt, 30);
  assert.deepEqual(r.series.values, [0, 100, 200, 300, 400, 500]);
  assert.equal(r.regional.validAt, r.validAt); assert.equal(r.regional.nodes[0].valueAglFt, 30);
  assert.equal(p.requests.length, 9); assert.equal(p.getMax(), 2);
});

test('processed source refuses changed catalogue paths/origins, run identities and executable frame data', async () => {
  const variants = [
    { latestChange: x => ({ ...x, viewers: { ceiling: 'https://untrusted.test/a.html' } }) },
    { latestChange: x => ({ ...x, viewers: { ceiling: `viewers/../ceiling-viewer-${RUN}.html` } }) },
    { latestChange: x => ({ ...x, run_id: '2026110309_2026110311_2026110306' }) },
    { htmlChange: x => x.replace(`${ORIGIN}/cog`, 'https://untrusted.test/cog') },
    { htmlChange: x => x.replace("runId: '" + RUN, "runId: '2026110206_2026110208_2026110200") },
    { htmlChange: x => x.replace(name(0), '../' + name(0)) },
    { htmlChange: x => x.replace('"source":"RUC"', '"source":"surprise-model"') },
    { htmlChange: x => x.replace('RUC 2026-11-02 11Z', 'RUC 2026-11-02 10Z') },
    { htmlChange: x => x.replace('frames: [', 'frames: [(() => {globalThis.__processedCeilingScriptExecuted = true})(),') },
    { redirect: 'https://untrusted.test/latest.json' },
    { future: true },
  ];
  for (const options of variants) {
    const p = provider(options), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
    await assert.rejects(source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' }));
  }
  assert.equal(globalThis.__processedCeilingScriptExecuted, undefined);
});

test('invalid requests and out-of-horizon/domain selections never acquire a fabricated numeric value', async () => {
  const p = provider(), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  for (const params of [{ hours: 25 }, { hours: 0 }, { lat: 95 }, { lon: 181 }, { selectedTime: '2026-11-02T12:00:00' }, { selectedTime: '2026-02-31T12:00:00Z' }]) {
    await assert.rejects(source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z', ...params }), JSON.stringify(params));
  }
  const before = p.requests.length;
  const horizon = await source.load({ ...point, selectedTime: '2026-11-05T11:00:00Z' });
  assert.equal(horizon.status, 'outside-horizon'); assert.equal(horizon.valueAglFt, null); assert.equal(horizon.regional, null);
  assert.ok(p.requests.slice(before).every(x => !x.url.endsWith('.tif')));
  const outside = await source.load({ lat: 80, lon: 14, selectedTime: '2026-11-02T11:37:00Z' });
  assert.equal(outside.status, 'outside-domain'); assert.equal(outside.valueAglFt, null);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z', signal: controller.signal }), { name: 'AbortError' });
});

test('format failure and raster size refusal retain partial provenance without a numeric fallback', async () => {
  for (const overSize of [false, true]) {
    const p = provider();
    const fetchImpl = (url, opts) => String(url).endsWith(name(1))
      ? Promise.resolve(new Response(overSize ? fixtureTiff() : new Uint8Array([73, 73, 42, 0]), { headers: { 'content-type': 'image/tiff', ...(overSize ? { 'content-length': String(8 * 1024 * 1024 + 1) } : {}) } }))
      : p.fetchImpl(url, opts);
    const source = createProcessedCeilingSource({ fetchImpl, now: NOW });
    const r = await source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' });
    assert.equal(r.status, 'partial'); assert.equal(r.valueAglFt, null); assert.equal(r.selectedStatus, 'unavailable');
    assert.equal(r.validAt, '2026-11-02T12:00:00.000Z'); assert.equal(r.model, 'ICON-D2-RUC');
    assert.equal(r.runTime, '2026-11-02T11:00:00.000Z'); assert.equal(r.sourceUrl, `${ORIGIN}/cog/${name(1)}`);
    assert.equal(r.regional, null); assert.deepEqual(r.series.values, [0, null, 200, 300, 400, 500]);
    assert.ok(r.series.frames[1].error);
  }
});

test('catalogue byte limit is enforced for advertised size and streamed bytes', async () => {
  for (const advertised of [false, true]) {
    let count = 0;
    const fetchImpl = async () => {
      count++;
      return new Response(advertised ? '{}' : 'x'.repeat(65537), { headers: { 'content-type': 'application/json', ...(advertised ? { 'content-length': '65537' } : {}) } });
    };
    const source = createProcessedCeilingSource({ fetchImpl, now: NOW });
    await assert.rejects(source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z' }));
    assert.equal(count, 1);
  }
});

test('cancelling a load aborts the two in-flight requests and removes queued raster requests', async () => {
  const p = provider(), controller = new AbortController();
  let started = 0, cancelled = 0;
  const fetchImpl = async (url, options) => {
    if (!String(url).endsWith('.tif')) return p.fetchImpl(url, options);
    started++;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { cancelled++; reject(new DOMException('Test cancel', 'AbortError')); }, { once: true });
      if (started === 2) queueMicrotask(() => controller.abort());
    });
  };
  const source = createProcessedCeilingSource({ fetchImpl, now: NOW });
  await assert.rejects(source.load({ ...point, selectedTime: '2026-11-02T11:37:00Z', signal: controller.signal }), { name: 'AbortError' });
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(started, 2); assert.equal(cancelled, 2);
});

test('explicit refresh reloads the catalogue while unchanged raster retrieval times remain original', async () => {
  let current = NOW();
  const p = provider(), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: () => current });
  const params = { ...point, selectedTime: '2026-11-02T11:00:00Z', hours: 1 };
  const original = await source.load(params), count = p.requests.length;
  current += 2 * 60000;
  const refreshed = await source.load({ ...params, forceRefresh: true });
  assert.equal(p.requests.length, count + 2);
  assert.ok(p.requests.slice(count).every(x => !x.url.endsWith('.tif')));
  assert.equal(refreshed.retrievedAt, original.retrievedAt);
  assert.deepEqual(refreshed.request, { lat: point.lat, lon: point.lon, selectedTime: '2026-11-02T11:00:00.000Z', hours: 1 });
});

test('raster cache remains bounded after moving the selected time through more than eight fields', async () => {
  const p = provider(), source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  await source.load({ ...point, selectedTime: '2026-11-02T11:00:00Z', hours: 8 });
  await source.load({ ...point, selectedTime: '2026-11-02T19:00:00Z', hours: 2 });
  const count = p.requests.length;
  const r = await source.load({ ...point, selectedTime: '2026-11-02T11:00:00Z', hours: 1 });
  assert.equal(r.valueAglFt, 0); assert.equal(p.requests.length, count + 1);
  assert.equal(p.requests.at(-1).url, `${ORIGIN}/cog/${name(0)}`);
});

test('a viewer without dated model labels keeps unknown run times separate from provider reference time', async () => {
  const p = provider({ htmlChange: html => html.replace(/<footer>.*?<\/footer>/, '') });
  const source = createProcessedCeilingSource({ fetchImpl: p.fetchImpl, now: NOW });
  const r = await source.load({ ...point, selectedTime: '2026-11-02T11:00:00Z' });
  assert.equal(r.valueAglFt, 0); assert.equal(r.runTime, null);
  assert.ok(r.series.frames.every(x => x.runTime === null));
  assert.equal(r.providerReferenceTime, '2026-11-02T11:00:00.000Z');
});

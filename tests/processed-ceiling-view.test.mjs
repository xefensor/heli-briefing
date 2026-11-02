import test from 'node:test';
import assert from 'node:assert/strict';
import { createProcessedCeilingSource } from '../web/js/processed-ceiling-source.js';
import { validateProcessedCeiling, renderProcessedCeiling, PROCESSED_CEILING_PRINT_CSS } from '../web/js/processed-ceiling-view.js';
import { fixtureTiff, fixtureCell } from './processed-geotiff-fixtures.mjs';

const ORIGIN = 'https://d34ooj23crdzyh.cloudfront.net';
const RUN = '2026110209_2026110211_2026110206';
const point = fixtureCell(0, 0);
const selectedTime = '2026-11-02T11:37:00Z';
async function fixture({ omit = [], fail = [], missing = [], runs = true, selection = selectedTime, location = point } = {}) {
  const name = hour => `ceiling_${RUN}_h${String(hour).padStart(2, '0')}m00.tif`;
  const frames = Array.from({ length: 10 }, (_, hour) => ({ filename: name(hour), hour, minute: 0, minutesOffset: hour * 60, source: hour < 2 ? 'RUC' : hour < 4 ? 'D2' : 'EU' })).filter(item => !omit.includes(item.hour));
  const latest = { run_id: RUN, timestamp: '2026-11-02T12:00:00Z', viewers: { ceiling: `viewers/ceiling-viewer-${RUN}.html` } };
  const html = `<script>window.ICON_CONFIG = {frames: ${JSON.stringify(frames)}, baseTime: '2026-11-02T11:00:00Z', cogBaseUrl: '${ORIGIN}/cog', runId: '${RUN}', productType: 'ceiling'};</script>${runs ? '<footer>D2 2026-11-02 09Z RUC 2026-11-02 11Z EU 2026-11-02 06Z</footer>' : ''}`;
  const source = createProcessedCeilingSource({ now: () => Date.parse('2026-11-02T12:37:00Z'), fetchImpl: async url => {
    if (url.endsWith('latest.json')) return new Response(JSON.stringify(latest), { headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('.html')) return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    const hour = Number(/_h(\d+)m00\.tif$/.exec(url)[1]);
    if (fail.includes(hour)) return new Response('Unavailable', { status: 503 });
    return new Response(fixtureTiff({ values: Array.from({ length: 16 }, (_, i) => i === 0 && missing.includes(hour) ? NaN : hour * 100 + i) }), { headers: { 'Content-Type': 'image/tiff' } });
  } });
  return source.load({ ...location, selectedTime: selection });
}

test('the view accepts real decoded fixture cells and preserves each model, run and AGL reference', async () => {
  const data = await fixture();
  assert.equal(validateProcessedCeiling(data), data);
  const html = renderProcessedCeiling(data, { timezone: 'UTC', width: 720 });
  assert.match(html, /<strong>100<\/strong> <span>ft AGL/);
  for (const model of ['ICON-D2-RUC', 'ICON-D2', 'ICON-EU']) assert.ok(html.includes(model));
  for (const hour of ['09:00 UTC', '11:00 UTC', '06:00 UTC']) assert.ok(html.includes(hour));
  assert.match(html, /6 hodinových vzorků/);
  assert.match(html, /Použitý terén a podrobnosti převodu poskytovatel nepopisuje/);
  assert.match(html, /časová základna katalogu.*není běh jednotlivých modelů/);
  assert.match(html, /Dodatečné podmínky využití zpracovaného výstupu nejsou zveřejněny/);
  assert.equal((html.match(/data-processed-cell=/g) || []).length, data.regional.nodes.length);
  assert.match(html, /data-selected-cell="0"/);
  assert.doesNotMatch(html, /<img|<iframe|<script|<image|url\(https?:/);
  assert.match(PROCESSED_CEILING_PRINT_CSS, /processed-ceiling-map/);
});

test('missing heights, failed frames and absent inventory slots remain distinct null gaps', async () => {
  const data = await fixture({ omit: [3], fail: [2], missing: [1] });
  validateProcessedCeiling(data);
  assert.equal(data.status, 'partial'); assert.equal(data.selectedStatus, 'missing');
  assert.deepEqual(data.series.values, [0, null, null, null, 400, 500]);
  const html = renderProcessedCeiling(data, { timezone: 'UTC' });
  assert.match(html, /<strong>—<\/strong>/);
  assert.match(html, /Chybějící hodnota nepotvrzuje jasno/);
  assert.match(html, /hodnota chybí, nikoli jasno/);
  assert.match(html, /Požadovaný čas není v katalogu/);
  assert.match(html, /HTTP 503/);
  assert.match(html, /<td>0<\/td>/);
  assert.doesNotMatch(html, /\bCLR\b|\bCAVOK\b/);
});

test('an absent explicit model run stays unknown rather than adopting the provider reference time', async () => {
  const data = await fixture({ runs: false });
  validateProcessedCeiling(data);
  assert.equal(data.runTime, null); assert.ok(data.series.frames.every(frame => frame.runTime === null));
  const html = renderProcessedCeiling(data, { timezone: 'UTC' });
  assert.match(html, /běh modelu neuvedeno/);
  assert.match(html, /časová základna katalogu 2\.11\. 11:00 UTC/);
  const forged = structuredClone(data); forged.runTime = data.providerReferenceTime;
  assert.throws(() => validateProcessedCeiling(forged), /běh modelu/);
});

test('outside-domain and outside-horizon states do not acquire numerical or regional coverage', async () => {
  const outside = await fixture({ location: { lat: 80, lon: 14 } });
  const future = await fixture({ selection: '2026-11-05T11:00:00Z' });
  for (const data of [outside, future]) {
    validateProcessedCeiling(data);
    const html = renderProcessedCeiling(data);
    assert.match(html, /<strong>—<\/strong>/);
    assert.doesNotMatch(html, /data-processed-cell=|data-selected-cell=/);
  }
  assert.match(renderProcessedCeiling(outside), /mimo zpracovaný rastr/);
  assert.match(renderProcessedCeiling(future), /mimo publikovaný horizont/);
});

test('snapshot validation rejects unit/provider/time swaps and fabricated pixel positions or coverage', async () => {
  const data = await fixture();
  const changes = [
    d => { d.units = 'm MSL'; },
    d => { d.source = 'DWD native'; },
    d => { d.processing.terrainSource = 'verified DWD HSURF'; },
    d => { d.sourceUrl = d.sourceUrl.replace('cloudfront.net', 'cloudfront.net.evil.test'); },
    d => { d.request.selectedTime = '2026-11-03T11:37:00Z'; },
    d => { d.cell.lat += 0.01; },
    d => { d.cell.index += 1; },
    d => { d.grid.pixelHeight *= -1; },
    d => { d.distanceKm = 123; },
    d => { d.series.frames[2].model = 'ICON-D2-RUC'; },
    d => { d.series.times[0] = '2026-02-31T12:00:00Z'; },
    d => { d.series.values[1] = Infinity; },
    d => { d.regional.units = 'm MSL'; },
    d => { d.regional.grid.originX += 1; },
    d => { d.regional.nodes[0].valueAglFt = NaN; },
    d => { d.regional.nodes[0].lon += 1; },
    d => { d.regional.nodes.push(structuredClone(d.regional.nodes[0])); },
    d => { d.regional.nodes = Array.from({ length: 2049 }, () => d.regional.nodes[0]); },
    d => { d.regional.totalCells = 1; },
  ];
  for (const mutate of changes) {
    const forged = structuredClone(data); mutate(forged);
    assert.throws(() => validateProcessedCeiling(forged));
  }
});

test('stale-context readings remain withheld and provider error strings cannot become markup', async () => {
  const data = await fixture({ omit: [3] });
  const unrelated = renderProcessedCeiling(data, { lat: point.lat + 1, lon: point.lon, time: selectedTime });
  assert.match(unrelated, /Načtená data nepatří zvolenému místu/);
  assert.match(unrelated, /<strong>—<\/strong>/);
  data.series.frames[3].error = '<img src="https://untrusted.test" onerror="alert(1)">';
  const html = renderProcessedCeiling(data);
  assert.match(html, /&lt;img src=&quot;https:\/\/untrusted\.test/);
  assert.doesNotMatch(html, /<img|onerror="|<script|<iframe/);
});

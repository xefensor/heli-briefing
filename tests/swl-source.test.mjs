import test from 'node:test';
import assert from 'node:assert/strict';
import { SWL_IMAGE_URL, isAllowedSwlImageUrl, swlImageUrl, loadSwlImage, fetchSwl } from '../web/js/swl-source.js';
import { fetchBrowserCharts, validateCharts, captureCharts, renderAviationCharts } from '../web/js/aviation-charts.js';

const at = Date.parse('2026-11-02T10:37:28Z');
const clock = () => at;
const image = { width: 2339, height: 1654 };

test('SWL restricts image loading to the exact official distributor and bounded cache key', () => {
  assert.equal(isAllowedSwlImageUrl(SWL_IMAGE_URL), true);
  assert.equal(swlImageUrl(at), 'https://meteo.rlp.cz/swlmap.png?t=1793615700000');
  assert.equal(isAllowedSwlImageUrl(swlImageUrl(at)), true);
  for (const url of ['http://meteo.rlp.cz/swlmap.png', 'https://meteo.rlp.cz.evil.test/swlmap.png', 'https://evil@meteo.rlp.cz/swlmap.png', 'https://meteo.rlp.cz/swlmap.png#image', `${swlImageUrl(at)}&extra=1`, `${SWL_IMAGE_URL}?t=1`, `${SWL_IMAGE_URL}?t=Infinity`, 'data:image/png;base64,iVBORw0KGgo=']) assert.equal(isAllowedSwlImageUrl(url), false, url);
});

test('native image confirmation needs bounded decoded dimensions, uses no CORS and cleans up failed loads', async () => {
  let seen;
  class ImageMock {
    naturalWidth = image.width; naturalHeight = image.height;
    constructor() { seen = this; }
    set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
    removeAttribute(name) { this.removed = name; }
  }
  assert.deepEqual(await loadSwlImage(swlImageUrl(at), { ImageClass: ImageMock }), image);
  assert.equal(seen.crossOrigin, undefined);
  assert.equal(seen.onload, null);
  assert.equal(seen.onerror, null);
  class HugeImage extends ImageMock { naturalWidth = 9000; }
  await assert.rejects(loadSwlImage(swlImageUrl(at), { ImageClass: HugeImage }), /rozměry/);
  assert.equal(seen.removed, 'src');
  class NeverImage extends ImageMock { set src(value) { this.url = value; } }
  await assert.rejects(loadSwlImage(swlImageUrl(at), { ImageClass: NeverImage, timeoutMs: 1 }), /časový limit/);
  assert.equal(seen.removed, 'src');
});

test('a loaded SWL confirms display and retrieval only, never validity or issuing time', async () => {
  let requested;
  const data = await fetchBrowserCharts({ now: clock, loadImage: async url => { requested = url; return image; } });
  validateCharts(data);
  assert.equal(data.swl.imageUrl, requested);
  assert.equal(data.swl.confirmedBy, 'image-load');
  assert.equal(data.swl.status, 'ok');
  assert.equal(data.swl.retrievedAt, new Date(at).toISOString());
  assert.equal(data.swl.issuedAt, null);
  assert.equal(data.swl.validFrom, null);
  assert.equal(data.swl.validTo, null);
  assert.equal(data.lowCloud.status, 'unsupported');
  const html = renderAviationCharts(data, { interactive: true, time: new Date(at).toISOString() });
  assert.match(html, /<img[^>]+src="https:\/\/meteo\.rlp\.cz\/swlmap\.png/);
  assert.match(html, /data-chart-enlarge="swl"/);
  assert.match(html, /Platnost ověř v záhlaví mapy v UTC/);
  assert.match(html, /není svázána s časem přehledu/);
  assert.doesNotMatch(html, /crossorigin|MAPA NEPOKRÝVÁ VYBRANÝ ČAS/);
});

test('failed refresh preserves only a confirmed allowlisted source and its original load time', async () => {
  const previous = await fetchSwl({ now: clock, loadImage: async () => image });
  const fail = () => { throw new Error('offline'); };
  const stale = await fetchSwl({ previous, now: () => at + 10 * 60000, loadImage: fail });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.imageUrl, previous.imageUrl);
  assert.equal(stale.retrievedAt, previous.retrievedAt);
  assert.notEqual(stale.checkedAt, previous.checkedAt);
  assert.equal(stale.validFrom, null);
  for (const invalid of [{ ...previous, imageUrl: 'https://example.com/swl.png' }, { ...previous, confirmedBy: undefined }, { ...previous, retrievedAt: new Date(at + 86400000).toISOString() }, { ...previous, width: 9000 }]) {
    const result = await fetchSwl({ previous: invalid, now: clock, loadImage: fail });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.imageUrl, null);
    assert.equal(result.retrievedAt, null);
  }
});

test('abort propagates and does not turn a retained image into refresh success', async () => {
  const controller = new AbortController();
  await assert.rejects(fetchSwl({ now: clock, signal: controller.signal, loadImage: async () => { controller.abort(); return image; } }), { name: 'AbortError' });
});

test('frozen SWL keeps only online source/time and never makes remote image requests', async () => {
  const live = await fetchBrowserCharts({ now: clock, loadImage: async () => image });
  assert.throws(() => validateCharts(live, { captured: true }), /offline snímek/);
  const captured = await captureCharts(live, new Date(at).toISOString(), { fetcher: () => { throw new Error('unexpected byte request'); } });
  validateCharts(captured, { captured: true });
  assert.equal(captured.swl.imageUrl, null);
  assert.equal(captured.swl.onlineImageUrl, live.swl.imageUrl);
  assert.equal(captured.swl.imageDataUrl, null);
  assert.equal(captured.swl.onlineOnly, true);
  const html = renderAviationCharts(captured);
  assert.match(html, /pouze online/);
  assert.match(html, /Načtení|načtení/);
  assert.match(html, /https:\/\/meteo\.rlp\.cz\/swlmap\.png/);
  assert.doesNotMatch(html, /<img|data-chart-enlarge/);
  for (const changes of [{ issuedAt: new Date(at).toISOString() }, { validFrom: new Date(at).toISOString() }, { imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }]) {
    const forged = structuredClone(captured); Object.assign(forged.swl, changes);
    assert.throws(() => validateCharts(forged, { captured: true }), /předstírat/);
  }
  const unsafe = structuredClone(live); unsafe.swl.imageUrl = 'https://example.com/map.png';
  assert.throws(() => validateCharts(unsafe), /přímý obraz/);
});

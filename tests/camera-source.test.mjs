import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_IMAGE_SOURCES, cameraImageCandidates, cameraImageInfo, isAllowedCameraImageUrl, loadCameraImage, fetchCameraImages } from '../web/js/camera-source.js';
import { fetchBrowserCameras, validateCameras, captureCameras, cameraState, renderCameras } from '../web/js/cameras.js';

const at = Date.parse('2026-11-02T11:16:00Z');
const now = () => at;
const full = { width: 1600, height: 1200 };
const context = { lat: 48.9463, lon: 14.4294, timezone: 'UTC', now: at };

test('camera candidates follow the published exact camera/hour paths across a UTC day boundary', () => {
  const candidates = cameraImageCandidates('ceske_budejovice', Date.parse('2026-11-02T00:02:00Z'));
  assert.equal(candidates.length, 3);
  assert.match(candidates[0].imageUrl, /\/55\/186428055\/hour\/20261102_0000\.jpg\?t=\d+$/);
  assert.match(candidates[1].imageUrl, /\/55\/186428055\/hour\/20261101_2300\.jpg\?t=\d+$/);
  assert.match(candidates[2].imageUrl, /\/55\/186428055\/latest_thumb\.jpg\?t=\d+$/);
  assert.equal(candidates[0].fileBucketAt, '2026-11-02T00:00:00.000Z');
  assert.equal(candidates[2].fileBucketAt, null);
  for (const candidate of candidates) assert.ok(isAllowedCameraImageUrl(candidate.imageUrl, 'ceske_budejovice'));
  assert.throws(() => cameraImageCandidates('foreign-camera', at), /Neznámá/);
});

test('the source allowlist rejects other cameras, arbitrary URL parts and impossible date/cache keys', () => {
  const url = cameraImageCandidates('ceske_budejovice', at)[0].imageUrl;
  for (const bad of [url.replace('https:', 'http:'), url.replace('webcams.ventusky.com', 'webcams.ventusky.com.evil.test'), url.replace('/55/186428055/', '/02/855413202/'), url + '&other=1', url + '#picture', url.replace('_1100', '_1130'), url.replace('20261102_', '20260231_'), url.replace(/t=\d+/, 't=1'), url.replace('https://', 'https://user:pass@')]) assert.equal(isAllowedCameraImageUrl(bad, 'ceske_budejovice'), false, bad);
  assert.equal(isAllowedCameraImageUrl(url, 'churanov'), false);
  assert.equal(cameraImageInfo(url, 'ceske_budejovice').variant, 'hourly-file');
});

test('normal Image loading confirms dimensions without reading pixels and cleans up abort/error', async () => {
  let last;
  class MockImage {
    naturalWidth = 1600; naturalHeight = 1200;
    constructor() { last = this; }
    set src(url) { this.url = url; queueMicrotask(() => this.onload?.()); }
    removeAttribute(name) { this.removed = name; }
  }
  const url = cameraImageCandidates('ceske_budejovice', at)[0].imageUrl;
  assert.deepEqual(await loadCameraImage(url, { id: 'ceske_budejovice', ImageClass: MockImage }), full);
  assert.equal(last.crossOrigin, undefined); assert.equal(last.onload, null); assert.equal(last.onerror, null);
  class Huge extends MockImage { naturalWidth = 9000; }
  await assert.rejects(loadCameraImage(url, { id: 'ceske_budejovice', ImageClass: Huge }), /rozměry/);
  assert.equal(last.removed, 'src');
  class Pending extends MockImage { set src(url) { this.url = url; } }
  const controller = new AbortController();
  const request = loadCameraImage(url, { id: 'ceske_budejovice', ImageClass: Pending, signal: controller.signal });
  controller.abort(); await assert.rejects(request, { name: 'AbortError' }); assert.equal(last.removed, 'src');
});

test('camera probing has a shared concurrency bound and confirms fallback existence without assigning exposure time', async () => {
  let active = 0, peak = 0;
  const requested = [];
  const data = await fetchBrowserCameras({ now, loadImage: async (url, { id }) => {
    requested.push({ id, url }); active += 1; peak = Math.max(peak, active);
    await new Promise(resolve => queueMicrotask(resolve)); active -= 1;
    if (id === 'ceske_budejovice' && !url.includes('latest_thumb')) throw new Error('Unavailable full file');
    return url.includes('latest_thumb') ? { width: 250, height: 187 } : full;
  } });
  validateCameras(data);
  assert.equal(peak, 2); assert.equal(requested.length, 5);
  assert.equal(data.status, 'ok'); assert.ok(data.onlineViewer);
  const thumbnail = data.items.find(item => item.id === 'ceske_budejovice');
  assert.equal(thumbnail.variant, 'thumbnail'); assert.equal(thumbnail.fileBucketAt, null);
  for (const item of data.items) {
    assert.equal(item.observedAt, null); assert.equal(item.imageDataUrl, null);
    assert.equal(item.confirmedBy, 'image-load'); assert.equal(item.retrievedAt, new Date(at).toISOString());
    assert.equal(cameraState(item, at), 'unverified');
  }
});

test('previous-hour fallback remains a filename bucket and not an observation timestamp', async () => {
  const data = await fetchCameraImages({ now, loadImage: async url => {
    if (url.includes('20261102_1100')) throw new Error('Current bucket missing');
    return full;
  } });
  assert.ok(data.items.every(item => item.variant === 'hourly-file' && item.fileBucketAt === '2026-11-02T10:00:00.000Z' && item.observedAt === null && item.missingCandidates === 1));
});

test('refresh failure retains only confirmed camera sources and their original load time', async () => {
  const previous = await fetchBrowserCameras({ now, loadImage: async () => full });
  const data = await fetchBrowserCameras({ previous, now: () => at + 600000, loadImage: async () => { throw new Error('Offline'); } });
  assert.equal(data.status, 'stale');
  for (const item of data.items) {
    assert.equal(item.status, 'stale'); assert.equal(item.retrievedAt, new Date(at).toISOString());
    assert.equal(item.observedAt, null); assert.match(item.error, /Obsah zdrojové adresy se může změnit/);
    assert.equal(cameraState(item, at + 600000), 'stale');
  }
  const invalid = structuredClone(previous); invalid.items[0].imageUrl = previous.items[1].imageUrl;
  const missing = await fetchBrowserCameras({ previous: invalid, now, loadImage: async () => { throw new Error('Offline'); } });
  assert.equal(missing.items[0].status, 'unavailable'); assert.equal(missing.items[0].imageUrl, null);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchBrowserCameras({ previous, now, signal: controller.signal, loadImage: async () => full }), { name: 'AbortError' });
});

test('inline images preserve source/time uncertainty while captured cameras remain metadata-only and idempotent', async () => {
  const data = await fetchBrowserCameras({ now, loadImage: async () => full });
  const live = renderCameras(data, { ...context, interactive: true });
  assert.equal((live.match(/data-camera-image=/g) || []).length, 3);
  assert.match(live, /Čas pořízení ověř v obrazu/); assert.match(live, /distribuce In-počasí \/ Ventusky/);
  assert.doesNotMatch(live, /<iframe|crossorigin|před \d+ min/);
  assert.throws(() => validateCameras(data, { captured: true }), /offline snímek/);
  const captured = captureCameras(data);
  assert.deepEqual(captureCameras(captured), captured);
  validateCameras(captured, { captured: true });
  for (const [index, item] of captured.items.entries()) {
    assert.equal(item.imageUrl, null); assert.equal(item.imageDataUrl, null); assert.equal(item.observedAt, null);
    assert.equal(item.onlineImageUrl, data.items[index].imageUrl); assert.equal(item.onlineOnly, true);
  }
  const frozen = renderCameras(captured, context);
  assert.doesNotMatch(frozen, /<img|<iframe|<video/);
  assert.match(frozen, /Hodinová složka souboru/); assert.match(frozen, /není čas pořízení/); assert.match(frozen, /Pouze online/);
  for (const change of [{ observedAt: new Date(at).toISOString() }, { imageDataUrl: 'data:image/jpeg;base64,/9j/AAAA' }, { onlineImageUrl: data.items[1].imageUrl }]) {
    const forged = structuredClone(captured); Object.assign(forged.items[0], change);
    assert.throws(() => validateCameras(forged, { captured: true }));
  }
  assert.equal(CAMERA_IMAGE_SOURCES.length, 3);
});

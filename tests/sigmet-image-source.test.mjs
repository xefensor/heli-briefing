import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGMET_IMAGE_URL, sigmetImageUrl, isAllowedSigmetImageUrl, loadSigmetImage, fetchSigmetImage, validateSigmetImage } from '../web/js/sigmet-image-source.js';

const at = Date.parse('2026-11-02T12:17:28Z');
const now = () => at;
const image = { width: 1500, height: 900 };

test('warning image requests are restricted to the exact HTTPS provider path and a canonical five-minute bucket', async () => {
  const expected = `${SIGMET_IMAGE_URL}?t=${Math.floor(at / 300000) * 300000}`;
  assert.equal(sigmetImageUrl(at), expected);
  assert.equal(isAllowedSigmetImageUrl(expected), true);
  assert.equal(isAllowedSigmetImageUrl(SIGMET_IMAGE_URL), true);
  for (const url of ['http://meteo.rlp.cz/sigmetmap.png', 'https://meteo.rlp.cz.evil.test/sigmetmap.png', 'https://user@meteo.rlp.cz/sigmetmap.png', `${SIGMET_IMAGE_URL}?t=01`, `${SIGMET_IMAGE_URL}?t=-300000`, `${SIGMET_IMAGE_URL}?t=1`, `${expected}&token=secret`, `${expected}#extra`, `${SIGMET_IMAGE_URL}?callback=evil`, 'data:image/png;base64,iVBORw0KGgo=']) assert.equal(isAllowedSigmetImageUrl(url), false, url);
  let constructed = false;
  await assert.rejects(async () => loadSigmetImage('https://example.com/image', { ImageClass: class { constructor() { constructed = true; } } }), /Nepovolený/);
  assert.equal(constructed, false);
});

test('display success needs an actual decoded image and does not request CORS pixel access', async () => {
  let seen;
  class LoadedImage {
    naturalWidth = image.width; naturalHeight = image.height;
    constructor() { seen = this; }
    set src(url) { this.url = url; queueMicrotask(() => this.onload?.()); }
    removeAttribute(name) { this.removed = name; }
  }
  assert.deepEqual(await loadSigmetImage(sigmetImageUrl(at), { ImageClass: LoadedImage }), image);
  assert.equal(seen.crossOrigin, undefined);
  assert.equal(seen.onload, null); assert.equal(seen.onerror, null);
  class InvalidDimensions extends LoadedImage { naturalHeight = 0; }
  await assert.rejects(loadSigmetImage(sigmetImageUrl(at), { ImageClass: InvalidDimensions }), /rozměry/);
  assert.equal(seen.removed, 'src');
  class NetworkFailure extends LoadedImage { set src(url) { this.url = url; queueMicrotask(() => this.onerror?.()); } }
  await assert.rejects(loadSigmetImage(sigmetImageUrl(at), { ImageClass: NetworkFailure }), /nelze zobrazit/);
  assert.equal(seen.removed, 'src');
});

test('a successfully displayed warning map never means current issue, forecast validity or complete warning coverage', async () => {
  let requested;
  const value = await fetchSigmetImage({ now, loadImage: async url => { requested = url; return image; } });
  validateSigmetImage(value);
  assert.equal(value.status, 'ok'); assert.equal(value.imageUrl, requested);
  assert.equal(value.retrievedAt, new Date(at).toISOString());
  assert.equal(value.confirmedBy, 'image-load'); assert.equal(value.displayOnly, true);
  assert.equal(value.coverageComplete, false); assert.equal(value.coverageStatus, 'unknown');
  for (const key of ['issuedAt', 'validFrom', 'validTo', 'observedAt', 'updatedAt']) assert.equal(value[key], null, key);
  assert.match(value.exportNote, /prázdná mapa nepotvrzují úplnost výstrah/);
  for (const patch of [{ coverageComplete: true }, { coverageStatus: 'complete' }, { issuedAt: new Date(at).toISOString() }, { updatedAt: new Date(at).toISOString() }, { imageDataUrl: 'data:image/png;base64,example' }]) assert.throws(() => validateSigmetImage({ ...value, ...patch }));
});

test('failed refresh retains only the previous confirmed source and its real load time, not fixed pixels or new validity', async () => {
  const previous = await fetchSigmetImage({ now, loadImage: async () => image });
  const failure = () => { throw Error('offline'); };
  const stale = await fetchSigmetImage({ previous, now: () => at + 600000, loadImage: failure });
  validateSigmetImage(stale);
  assert.equal(stale.status, 'stale'); assert.equal(stale.imageUrl, previous.imageUrl);
  assert.equal(stale.retrievedAt, previous.retrievedAt); assert.notEqual(stale.checkedAt, previous.checkedAt);
  assert.equal(stale.coverageComplete, false); assert.equal(stale.updatedAt, null);
  assert.match(stale.error, /proměnlivá.*neměnný snímek/);
  for (const patch of [{ imageUrl: 'https://example.com/warning.png' }, { confirmedBy: undefined }, { displayOnly: false }, { width: 9000 }, { retrievedAt: new Date(at + 86400000).toISOString() }, { imageUrl: sigmetImageUrl(at + 86400000) }]) {
    const unavailable = await fetchSigmetImage({ previous: { ...previous, ...patch }, now, loadImage: failure });
    assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.imageUrl, null); assert.equal(unavailable.retrievedAt, null);
    assert.match(unavailable.error, /Neznamená to nepřítomnost výstrah/);
  }
});

test('aborted and timed-out loads release their Image request and never become confirmed warnings', async () => {
  let seen;
  class NeverImage {
    constructor() { seen = this; }
    set src(url) { this.url = url; }
    removeAttribute(name) { this.removed = name; }
  }
  await assert.rejects(loadSigmetImage(sigmetImageUrl(at), { ImageClass: NeverImage, timeoutMs: 1 }), /časový limit/);
  assert.equal(seen.removed, 'src'); assert.equal(seen.onload, null);
  const controller = new AbortController();
  const work = loadSigmetImage(sigmetImageUrl(at), { ImageClass: NeverImage, signal: controller.signal });
  controller.abort();
  await assert.rejects(work, { name: 'AbortError' }); assert.equal(seen.removed, 'src');
  await assert.rejects(fetchSigmetImage({ now, signal: controller.signal, loadImage: () => { throw Error('must not load'); } }), { name: 'AbortError' });
  const lateAbort = new AbortController();
  await assert.rejects(fetchSigmetImage({ now, signal: lateAbort.signal, loadImage: async () => { lateAbort.abort(); return image; } }), { name: 'AbortError' });
});

test('captured warning metadata allows a safe online link but prohibits automatically loaded imagery', async () => {
  const live = await fetchSigmetImage({ now, loadImage: async () => image });
  assert.throws(() => validateSigmetImage(live, { captured: true }), /jen online odkaz/);
  const captured = { ...live, imageUrl: null, onlineImageUrl: live.imageUrl, onlineOnly: true };
  assert.equal(validateSigmetImage(captured, { captured: true }), captured);
  for (const patch of [{ onlineImageUrl: 'https://evil.test/warning' }, { onlineOnly: false }, { sourceUrl: 'https://evil.test/source' }, { pageUrl: 'javascript:alert(1)' }, { validTo: new Date(at + 3600000).toISOString() }, { confirmedBy: null }, { retrievedAt: null }, { retrievedAt: 'not a date' }, { width: 0 }, { height: 9000 }, { onlineImageUrl: null }, { status: 'unavailable' }]) assert.throws(() => validateSigmetImage({ ...captured, ...patch }, { captured: true }));
  assert.throws(() => validateSigmetImage({ ...live, imageUrl: null }), /potvrzené načtení/);
  const unavailable = await fetchSigmetImage({ now, loadImage: async () => { throw Error('offline'); } });
  validateSigmetImage(unavailable, { captured: true });
  for (const patch of [{ confirmedBy: 'image-load' }, { retrievedAt: live.retrievedAt }, { width: 1500 }, { onlineImageUrl: live.imageUrl, onlineOnly: true }]) assert.throws(() => validateSigmetImage({ ...unavailable, ...patch }, { captured: true }), /nesmí předstírat/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { radarImageUrl, radarCandidates, loadRadarImage, fetchRadar } from '../web/js/radar-source.js';

const at = Date.parse('2026-11-02T08:53:20Z');
const clock = () => at;

test('radar candidates use UTC boundaries, exclude the future and remain bounded across midnight', () => {
  const candidates = radarCandidates('2026-11-02T00:02:00Z');
  assert.equal(candidates.length, 24);
  assert.equal(candidates[0].observedAt, '2026-11-02T00:00:00.000Z');
  assert.match(candidates[1].url, /20261101\.2355\.0\.png$/);
  assert.ok(candidates.every(frame => Date.parse(frame.observedAt) <= Date.parse('2026-11-02T00:02:00Z')));
  assert.throws(() => radarCandidates(at, 25), /1–24/);
  assert.throws(() => radarImageUrl(at), /pětiminutovému/);
});

test('only loaded images become observations, with at most two requests and missing frames kept as gaps', async () => {
  let active = 0, maximum = 0, calls = 0;
  const data = await fetchRadar({ now: clock, loadImage: async url => {
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (/\.0850\.|\.0800\./.test(url)) throw new Error('missing');
    return { width: 960, height: 690 };
  } });
  assert.equal(calls, 24);
  assert.equal(maximum, 2);
  assert.equal(data.status, 'partial');
  assert.equal(data.frames.length, 22);
  assert.equal(data.missingFrames.length, 2);
  assert.equal(data.observedAt, '2026-11-02T08:45:00.000Z');
  assert.ok(data.frames.every(frame => !/\.0850\.|\.0800\./.test(frame.url)));
  assert.ok(data.frames.every(frame => frame.confirmedBy === 'image-load'));
  assert.equal(data.coverageComplete, false);
  assert.equal(data.imageDataUrl, null);
  assert.equal(data.imageFetchStatus, 'unsupported-cors');
  assert.match(data.exportNote, /nikoli vložený snímek/);
  assert.deepEqual(data.bounds, [[48.047, 11.267], [52.167, 20.770]]);
});

test('complete failure retains real prior frame times, but never substitutes an unconfirmed URL', async () => {
  const good = await fetchRadar({ now: clock, frameLimit: 1, loadImage: async () => true });
  const later = () => at + 30 * 60_000;
  const stale = await fetchRadar({ now: later, previous: good, frameLimit: 1, loadImage: async () => { throw new Error('offline'); } });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.observedAt, good.observedAt);
  assert.equal(stale.retrievedAt, good.retrievedAt);
  assert.equal(stale.checkedAt, new Date(later()).toISOString());
  assert.equal(stale.frames[0].retrievedAt, good.frames[0].retrievedAt);
  const bad = await fetchRadar({ now: later, previous: { ...good, frames: [{ url: 'https://example.org/frame.png', observedAt: good.observedAt }] }, frameLimit: 1, loadImage: async () => false });
  assert.equal(bad.status, 'unavailable');
  assert.equal(bad.url, null);
  assert.deepEqual(bad.frames, []);
  assert.equal(bad.retrievedAt, null);
  const unconfirmed = await fetchRadar({ now: later, previous: { ...good, frames: [{ url: good.url, observedAt: good.observedAt }] }, frameLimit: 1, loadImage: async () => false });
  assert.equal(unconfirmed.status, 'unavailable');
  assert.deepEqual(unconfirmed.frames, []);
});

test('a lightweight check tolerates publication lag using only a genuinely loaded older frame', async () => {
  const calls = [];
  const data = await fetchRadar({ now: clock, frameLimit: 4, loadImage: async url => {
    calls.push(url);
    if (!url.includes('.0835.')) throw new Error('not published');
    return true;
  } });
  assert.equal(calls.length, 4);
  assert.equal(data.observedAt, '2026-11-02T08:35:00.000Z');
  assert.equal(data.frames.length, 1);
  assert.equal(data.missingFrames.length, 3);
});

test('cancellation stops the queue and rejects rather than returning a successful partial observation', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchRadar({ now: clock, signal: controller.signal, loadImage: async (_url, { signal }) => {
    calls++;
    if (calls === 1) { await new Promise(resolve => setImmediate(resolve)); controller.abort(); }
    if (signal.aborted) throw signal.reason;
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } }), { name: 'AbortError' });
  assert.equal(calls, 2);
});

test('native Image display succeeds without requesting CORS access and cleans up timeout failures', async () => {
  let seen;
  class ImageMock {
    naturalWidth = 960; naturalHeight = 690;
    constructor() { seen = this; }
    set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
    removeAttribute(name) { this.removed = name; }
  }
  const image = await loadRadarImage(radarImageUrl('2026-11-02T08:50:00Z'), { ImageClass: ImageMock });
  assert.equal(image.width, 960);
  assert.equal(seen.crossOrigin, undefined);
  assert.equal(seen.onload, null);
  class NeverImage {
    set src(value) { this.url = value; }
    removeAttribute(name) { this.removed = name; }
    constructor() { seen = this; }
  }
  await assert.rejects(loadRadarImage(radarImageUrl('2026-11-02T08:50:00Z'), { ImageClass: NeverImage, timeoutMs: 1 }), /časový limit/);
  assert.equal(seen.removed, 'src');
  assert.equal(seen.onerror, null);
});

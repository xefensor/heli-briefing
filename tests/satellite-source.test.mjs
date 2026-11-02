import test from 'node:test';
import assert from 'node:assert/strict';
import {advertisedSatelliteFrames, fetchSatellite, parseSatelliteCapabilities} from '../web/js/satellite-source.js';
import {satelliteState} from '../web/js/satellite.js';

const now = Date.parse('2026-11-02T09:03:00Z');
const extent = {extent: '2026-11-02T08:00:00Z/2026-11-02T09:10:00Z/PT10M', defaultTime: '2026-11-02T09:10:00Z'};
function png({width = 1000, height = 500} = {}) {
  const value = new Uint8Array(57);
  value.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(value.buffer);
  view.setUint32(8, 13); value.set([73, 72, 68, 82], 12);
  view.setUint32(16, width); view.setUint32(20, height);
  value.set([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130], value.length - 12);
  return value;
}
const imageResponse = (bytes = png()) => new Response(bytes, {headers: {'Content-Type': 'image/png'}});
function source(fetchImpl, options = {}) {
  return fetchSatellite({fetchImpl, now: () => now, parseCapabilities: () => extent, ...options});
}

test('advertised interval selection excludes future frames and follows its actual cadence', () => {
  assert.deepEqual(advertisedSatelliteFrames(extent, now), ['2026-11-02T09:00:00Z', '2026-11-02T08:50:00Z']);
  assert.deepEqual(advertisedSatelliteFrames({...extent, extent: '2026-11-02T08:05:00Z/2026-11-02T09:05:00Z/PT10M', defaultTime: null}, now), ['2026-11-02T08:55:00Z', '2026-11-02T08:45:00Z']);
  assert.deepEqual(advertisedSatelliteFrames({extent: '2026-11-02T08:30:00Z,2026-11-02T09:10:00Z,2026-11-02T08:50:00Z', defaultTime: null}, now), ['2026-11-02T08:50:00Z', '2026-11-02T08:30:00Z']);
  assert.throws(() => advertisedSatelliteFrames({extent: '2026-11-02T09:10:00Z', defaultTime: null}, now), /non-future/);
});

test('time inventory cannot invent malformed, unadvertised or off-cadence defaults', () => {
  assert.throws(() => advertisedSatelliteFrames({...extent, defaultTime: '2026-11-02T09:03:00Z'}, now), /outside/);
  assert.throws(() => advertisedSatelliteFrames({extent: '2026-11-02T08:50:00/2026-11-02T09:10:00Z/PT10M'}, now), /UTC/);
  assert.throws(() => advertisedSatelliteFrames({extent: '2026-02-30T08:50:00Z'}, now), /invalid/);
  assert.throws(() => advertisedSatelliteFrames({extent: '2026-11-02T09:10:00Z/2026-11-02T08:00:00Z/PT10M'}, now), /reversed/);
  assert.throws(() => advertisedSatelliteFrames({...extent, extent: extent.extent.replace('PT10M', 'PT0M')}, now), /cadence/);
  assert.throws(() => parseSatelliteCapabilities('<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]><x/>'), /declaration/);
});

test('direct WMS requests retain geographic axis order, source time and frozen bytes', async () => {
  const calls = [];
  let clockCalls = 0;
  const result = await source(async (url, options) => {
    calls.push({url: new URL(url), options});
    return calls.length === 1 ? new Response('<capabilities/>') : imageResponse();
  }, {now: () => now + (clockCalls++ ? 1500 : 0)});
  assert.equal(calls.length, 2);
  const params = calls[1].url.searchParams;
  assert.equal(calls[0].url.origin, 'https://view.eumetsat.int');
  assert.equal(params.get('bbox'), '47,10,52,20');
  assert.equal(params.get('crs'), 'EPSG:4326');
  assert.equal(params.get('version'), '1.3.0');
  assert.equal(params.get('time'), '2026-11-02T09:00:00Z');
  assert.equal(params.get('width'), '1000');
  assert.equal(params.get('height'), '500');
  assert.equal(params.get('layers'), 'mtg_fd:rgb_geocolour');
  for (const call of calls) {
    assert.equal(call.options.mode, 'cors');
    assert.equal(call.options.credentials, 'omit');
    assert.equal(call.options.redirect, 'error');
  }
  assert.equal(result.status, 'ok');
  assert.equal(result.observedAt, '2026-11-02T09:00:00Z');
  assert.equal(result.retrievedAt, '2026-11-02T09:03:01.500Z');
  assert.equal(result.attemptedAt, '2026-11-02T09:03:00.000Z');
  assert.equal(result.fallbackNote, undefined);
  assert.deepEqual(new Uint8Array(Buffer.from(result.imageDataUrl.split(',')[1], 'base64')), png());
  assert.equal(satelliteState(result, now + 2000).status, 'available');
});

test('one failed image can use only the preceding advertised frame with its own timestamp', async () => {
  const calls = [];
  const result = await source(async url => {
    calls.push(new URL(url));
    return calls.length === 1 ? new Response('<capabilities/>') : calls.length === 2 ? new Response('Not ready', {status: 503}) : imageResponse();
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].searchParams.get('time'), '2026-11-02T08:50:00Z');
  assert.equal(result.observedAt, '2026-11-02T08:50:00Z');
  assert.match(result.fallbackNote, /preceding advertised/);
  assert.equal(result.retrievedAt, new Date(now).toISOString());
});

test('provider XML, wrong geometry and incomplete PNGs are never accepted as image data', async () => {
  const cases = [
    () => new Response('<ServiceException/>', {headers: {'Content-Type': 'text/xml'}}),
    () => imageResponse(png({width: 500, height: 1000})),
    () => imageResponse(png().subarray(0, 35)),
  ];
  for (const bad of cases) {
    let requests = 0;
    await assert.rejects(source(async () => ++requests === 1 ? new Response('<capabilities/>') : bad(), {parseCapabilities: () => ({extent: '2026-11-02T09:00:00Z'})}), /PNG|png|dimensions/);
    assert.equal(requests, 2);
  }
});

test('oversize responses are rejected before buffering and no fallback is invented', async () => {
  let reads = 0;
  await assert.rejects(source(async () => ({ok: true, url: '', headers: new Headers({'Content-Length': '2000001'}), arrayBuffer: async () => {reads++; return new ArrayBuffer(0);}})), /size limit/);
  assert.equal(reads, 0);
  let calls = 0;
  await assert.rejects(source(async () => ++calls === 1 ? new Response('<capabilities/>') : new Response('down', {status: 500}), {parseCapabilities: () => ({extent: '2026-11-02T09:00:00Z'})}), /HTTP 500/);
  assert.equal(calls, 2);
});

test('an unannounced oversized response stream is cancelled at the byte limit', async () => {
  let calls = 0, cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2_000_001)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(source(async () => ++calls === 1 ? new Response('<capabilities/>') : new Response(body, {headers: {'Content-Type': 'image/png'}}), {parseCapabilities: () => ({extent: '2026-11-02T09:00:00Z'})}), /size limit/);
  assert.equal(cancelled, true);
  assert.equal(calls, 2);
});

test('abort and timeout stop direct requests without trying another frame', async () => {
  const controller = new AbortController();
  controller.abort(new Error('User left'));
  let calls = 0;
  await assert.rejects(source(async () => {calls++;}, {signal: controller.signal}), /User left/);
  assert.equal(calls, 0);
  await assert.rejects(source(async (_url, {signal}) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
  }, {timeoutMs: 5}), /timed out/);
  assert.equal(calls, 1);
});

test('an abort during image retrieval prevents the preceding-frame retry', async () => {
  let calls = 0;
  const controller = new AbortController();
  await assert.rejects(source(async (_url, {signal}) => {
    if (++calls === 1) return new Response('<capabilities/>');
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      queueMicrotask(() => controller.abort(new Error('Selection changed')));
    });
  }, {signal: controller.signal}), /Selection changed/);
  assert.equal(calls, 2);
});

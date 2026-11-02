import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { parseLowCloudFiles, validateLocalLowCloudFrame, LOW_CLOUD_FRAME_BASE, LOW_CLOUD_PAGE, LOW_CLOUD_FILE_LIMITS } from '../web/js/lowcloud-file-source.js';

function crc32(data) {
  let crc = 0xffffffff;
  for (const value of data) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data = Buffer.alloc(0)) {
  const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, crc]);
}
function png(width = 100, height = 100, extra = []) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const raster = deflateSync(Buffer.alloc((width * 4 + 1) * height));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...extra, chunk('IDAT', raster), chunk('IEND')]);
}
function file(name, bytes = png()) {
  return new File([bytes], name, { type: name.endsWith('.json') ? 'application/json' : 'image/png', lastModified: 0 });
}
const dataUrl = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const jsonFile = (name, value = { img: dataUrl(png()) }) => file(name, JSON.stringify(value));
const clock = '2026-11-02T12:30:00.000Z';
const decode = async (_, { width, height }) => ({ width, height });
const options = { now: clock, decodeImage: decode };

test('official JSON and PNG preserve filename claims independently from local read time and unknown issue/retrieval', async () => {
  let reads = 0;
  const result = await parseLowCloudFiles([jsonFile('202611021500.json'), file('202611021200.png'), file('202611020900')], { ...options, now: () => new Date(Date.parse(clock) + reads++ * 1000) });
  assert.deepEqual(result.frames.map(frame => frame.validAt), ['2026-11-02T09:00:00.000Z', '2026-11-02T12:00:00.000Z', '2026-11-02T15:00:00.000Z']);
  assert.equal(result.importedAt, '2026-11-02T12:30:02.000Z');
  for (const frame of result.frames) {
    assert.equal(frame.delivery, 'local-file'); assert.equal(frame.status, 'manual'); assert.equal(frame.timeBasis, 'filename-unverified');
    assert.equal(frame.validityConfirmed, false); assert.equal(frame.issuedAt, null); assert.equal(frame.retrievedAt, null);
    assert.equal(frame.sourceUrl, LOW_CLOUD_FRAME_BASE + frame.originalFileName.slice(0, 12)); assert.equal(frame.sourcePage, LOW_CLOUD_PAGE);
    assert.equal(frame.author, 'ČHMÚ'); assert.equal(frame.license, 'CC BY 4.0'); assert.equal(frame.width, 100); assert.equal(frame.height, 100);
    assert.equal(frame.units, 'hft AMSL'); assert.equal(frame.projection, 'EPSG:3857');
    assert.equal(validateLocalLowCloudFrame(frame), frame);
  }
  assert.notEqual(result.frames[0].importedAt, result.frames[2].importedAt);
  assert.ok(result.totalRawBytes > result.frames[0].imageBytes);
});

test('dates and filenames must retain an actual UTC three-hour slot without renaming or guessed time', async () => {
  for (const name of ['202602301200.json', '202611022400.png', '202611021201.png', '202611021300.png', '202611021200 (1).json', '../202611021200.png', '202611021200.svg', '202611021200.PNG', '<script>.json', '20261102120.json']) {
    await assert.rejects(parseLowCloudFiles([file(name)], options), /název|Název/);
  }
  const leap = await parseLowCloudFiles([file('202402291200.png')], options);
  assert.equal(leap.frames[0].validAt, '2024-02-29T12:00:00.000Z');
  await assert.rejects(parseLowCloudFiles([file('202302291200.png')], options), /UTC termín/);
});

test('count, total raw size, duplicates and file-read integrity are checked before any decode', async () => {
  let decoded = 0; const opts = { ...options, decodeImage: async (...args) => { decoded++; return decode(...args); } };
  await assert.rejects(parseLowCloudFiles([], opts), /alespoň jeden/);
  await assert.rejects(parseLowCloudFiles(Array.from({ length: 13 }, (_, index) => file(`202611${String(1 + Math.floor(index / 8)).padStart(2, '0')}${String(index % 8 * 3).padStart(2, '0')}00.png`)), opts), /12 rámců/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png'), jsonFile('202611021200.json')], opts), /stejný UTC termín/);
  await assert.rejects(parseLowCloudFiles([{ name: '202611021200.png', size: LOW_CLOUD_FILE_LIMITS.rawBytes + 1, arrayBuffer() { throw Error('must not read'); } }], opts), /8 MiB/);
  assert.equal(decoded, 0);
  await assert.rejects(parseLowCloudFiles([{ name: '202611021200.png', size: 50, arrayBuffer: async () => new ArrayBuffer(49) }], opts), /velikost/);
  await assert.rejects(parseLowCloudFiles([{ name: '202611021200.png', size: 50, arrayBuffer: async () => { throw Error('gone'); } }], opts), /přečíst/);
});

test('JSON is data only: reject non-PNG types, extra keys, malformed encodings and extension mismatches', async () => {
  for (const value of [{ img: 'data:image/svg+xml;base64,PHN2Zy8+' }, { img: 'https://example.com/frame.png' }, { img: dataUrl(png()), issuedAt: clock }, [{ img: dataUrl(png()) }], { img: dataUrl(png()).replace('base64,', 'base64,\n') }, { img: 'data:image/png;base64,AAAA=' }, null]) {
    await assert.rejects(parseLowCloudFiles([jsonFile('202611021200.json', value)], options), /JSON|base64/);
  }
  await assert.rejects(parseLowCloudFiles([file('202611021200.png', JSON.stringify({ img: dataUrl(png()) }))], options), /Přípona/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.json')], options), /Přípona/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.json', '{"img":')], options), /JSON/);
});

test('PNG envelope checks reject truncation, forged dimensions, corruption, animation and appended payloads', async () => {
  const image = png(), corrupt = Buffer.from(image); corrupt[corrupt.length - 1] ^= 1;
  const malformed = [image.subarray(0, image.length - 12), Buffer.concat([image, Buffer.from('<script/>')]), png(99), png(4097, 100), corrupt, png(100, 100, [chunk('acTL', Buffer.alloc(8))]), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IEND')])];
  for (const bytes of malformed) await assert.rejects(parseLowCloudFiles([file('202611021200.png', bytes)], options), /PNG|100–4096/);
  const huge = Buffer.alloc(LOW_CLOUD_FILE_LIMITS.imageBytes + 1); image.copy(huge);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png', huge)], options), /2 MiB/);
});

test('actual image decode is mandatory, atomic on failure and cannot override checked header geometry', async () => {
  await assert.rejects(parseLowCloudFiles([file('202611021200.png')], { ...options, decodeImage: async () => { throw Error('bad compressed pixels'); } }), /dekódovat/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png')], { ...options, decodeImage: async () => ({ width: 101, height: 100 }) }), /rozměrům/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png'), file('202611021500.png')], { ...options, decodeImage: (() => { let count = 0; return async (...args) => { if (++count === 2) throw Error('second failed'); return decode(...args); }; })() }), /nebyl importován/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png')], { ...options, now: 'not a clock' }), /Čas místního importu/);
});

test('synchronous archive validation rejects changed provenance, promoted certainty and substituted bytes', async () => {
  const { frames: [frame] } = await parseLowCloudFiles([jsonFile('202611021200.json')], options);
  for (const mutate of [
    item => { item.validityConfirmed = true; }, item => { item.timeBasis = 'provider'; }, item => { item.retrievedAt = clock; },
    item => { item.issuedAt = clock; }, item => { item.validAt = '2026-11-02T15:00:00.000Z'; }, item => { item.sourceUrl = 'https://example.com'; },
    item => { item.importedAt = '2026-02-30T12:00:00.000Z'; }, item => { item.delivery = 'browser-direct'; }, item => { item.originalFileName = '<img>'; },
    item => { item.imageDataUrl = 'data:image/svg+xml;base64,PHN2Zy8+'; }, item => { item.width++; }, item => { item.imageBytes++; },
    item => { item.bounds[0][0] = 48; }, item => { item.units = 'm AGL'; }, item => { item.license = 'unknown'; },
  ]) { const changed = structuredClone(frame); mutate(changed); assert.throws(() => validateLocalLowCloudFrame(changed)); }
});

test('a stalled native decoder cannot keep briefing capture busy indefinitely', async () => {
  await assert.rejects(parseLowCloudFiles([file('202611021200.png')], { ...options, timeoutMs:1, decodeImage:()=>new Promise(()=>{}) }), /časovém limitu/);
  await assert.rejects(parseLowCloudFiles([file('202611021200.png')], { ...options, timeoutMs:16000 }), /časový limit/);
});

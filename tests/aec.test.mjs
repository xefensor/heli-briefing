import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeAec, decodeAecSamples } from '../web/js/aec.js';

const bytes = bits => Uint8Array.from((bits + '0'.repeat((8 - bits.length % 8) % 8)).match(/.{8}/g).map(value => parseInt(value, 2)));
const binary = (value, width) => value.toString(2).padStart(width, '0');
const unary = value => '0'.repeat(value) + '1';
const options = changes => ({ bitsPerSample: 8, blockSize: 8, rsi: 1, flags: 0, samples: 8, ...changes });

test('AEC decodes independent uncompressed, split, second-extension and zero-block streams', () => {
  assert.deepEqual([...decodeAecSamples(bytes('111' + [1, 7, 99, 255, 0, 8, 12, 6].map(n => binary(n, 8)).join('')), options())], [1, 7, 99, 255, 0, 8, 12, 6]);
  const deltas = [2, 1, 6, 5, 14, 13, 18];
  const split = '010' + binary(100, 8) + deltas.map(n => unary(Math.floor(n / 2))).join('') + deltas.map(n => String(n % 2)).join('');
  assert.deepEqual([...decodeAecSamples(bytes(split), options({ flags: 8 }))], [100, 101, 100, 103, 100, 107, 100, 109]);
  assert.deepEqual([...decodeAecSamples(bytes('0001' + [1, 2, 3, 5].map(unary).join('')), options())], [1, 0, 0, 1, 2, 0, 0, 2]);
  assert.deepEqual([...decodeAecSamples(bytes('0000' + binary(37, 8) + unary(0)), options({ flags: 8 }))], Array(8).fill(37));
});

test('AEC rest-of-segment zero coding and padded reference intervals retain exact counts', () => {
  const ros = bytes('0000' + binary(37, 8) + unary(4));
  assert.deepEqual([...decodeAecSamples(ros, options({ flags: 8, rsi: 10, samples: 80 }))], Array(80).fill(37));
  const block = n => ('0000' + binary(n, 8) + unary(0)).padEnd(16, '0');
  assert.deepEqual([...decodeAecSamples(bytes(block(10) + block(20)), options({ flags: 8 | 32, samples: 16 }))], [...Array(8).fill(10), ...Array(8).fill(20)]);
});

test('AEC preserves unsigned 32-bit limits and declared output byte order', () => {
  const values = [0, 1, 4294967295, 2147483648, 13, 65535, 16777215, 42];
  const encoded = bytes('11111' + values.map(n => binary(n, 32)).join(''));
  const opts = options({ bitsPerSample: 32, flags: 4 });
  assert.deepEqual([...decodeAecSamples(encoded, opts)], values);
  assert.deepEqual([...decodeAecSamples(encoded, { ...opts, samples: 3 })], values.slice(0, 3));
  const big = decodeAec(encoded, opts), little = decodeAec(encoded, { ...opts, flags: 0 });
  assert.equal(new DataView(big.buffer).getUint32(8), 4294967295);
  assert.equal(new DataView(little.buffer).getUint32(12, true), 2147483648);
  assert.deepEqual([...decodeAec(bytes('11111' + values.map(n => binary(n & 0xffffff, 24)).join('')), options({ bitsPerSample: 24, flags: 2 | 4 }))].slice(0, 9), [0, 0, 0, 0, 0, 1, 255, 255, 255]);
});

test('AEC rejects unsupported configuration, malformed ranges and truncated payloads', () => {
  const sample = bytes('111' + binary(42, 8).repeat(8));
  for (const changes of [{ bitsPerSample: 0 }, { bitsPerSample: 33 }, { blockSize: 3 }, { blockSize: 6 }, { rsi: 0 }, { rsi: 65536 }, { samples: 0 }, { samples: 2000001 }, { flags: 1 }, { flags: 128 }, { bitsPerSample: 8, flags: 16 }]) assert.throws(() => decodeAecSamples(sample, options(changes)));
  assert.throws(() => decodeAecSamples(new Uint8Array(16000001), options()), /input/);
  assert.throws(() => decodeAecSamples(sample.subarray(0, 4), options()), /Truncated/);
  assert.throws(() => decodeAecSamples(sample, options({ samples: 9 })), /Truncated/);
  assert.throws(() => decodeAecSamples(bytes('0000' + unary(6)), options()), /reference interval|sample range/);
  assert.throws(() => decodeAecSamples(bytes('0001' + unary(91)), options()), /sample range/);
});

test('unsigned libaec golden vectors match across widths, preprocessing, zero runs, restricted coding and RSI padding', async () => {
  const fixtures = JSON.parse(await readFile(new URL('./aec-goldens.json', import.meta.url), 'utf8'));
  for (const vector of fixtures.vectors) {
    const decoded = decodeAecSamples(Uint8Array.from(Buffer.from(vector.encoded, 'base64')), vector);
    const serialized = new Uint8Array(decoded.length * 4), view = new DataView(serialized.buffer);
    decoded.forEach((value, i) => view.setUint32(i * 4, value, true));
    assert.equal(createHash('sha256').update(serialized).digest('hex'), vector.sha256, vector.name);
  }
});

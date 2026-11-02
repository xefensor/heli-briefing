/**
 * Bounded unsigned CCSDS 121.0-B-3 decoder for GRIB2 template 5.42.
 * Block/preprocessor logic adapted from Dan Markham's MIT-licensed Go port of
 * libaec: https://github.com/dmarkham/grib2/blob/146d5733902af5b41c45c7819b24079f7cdaebad/internal/aec/decode.go
 * Original C authors: Mathis Rosenhauer, Moritz Hanke, Joerg Behrens,
 * Luis Kornblueh. See ../vendor/aec.LICENSE.
 *
 * This intentionally rejects signed samples and unknown flags rather than
 * guessing. The current DWD native fields use unsigned, MSB, preprocessed
 * 16-bit data (flags 14). Decode exact counts, never an unbounded stream.
 */
export const AEC_FLAGS = Object.freeze({ signed: 1, threeByte: 2, msb: 4, preprocess: 8, restricted: 16, padRsi: 32, notEnforce: 64 });
const MAX_SAMPLES = 2_000_000;
const MAX_INPUT = 16_000_000;

class Bits {
  constructor(bytes) { this.bytes = bytes; this.position = 0; }
  read(count) {
    if (!Number.isInteger(count) || count < 0 || count > 32 || this.position + count > this.bytes.length * 8) throw new Error('Truncated AEC stream.');
    let value = 0;
    while (count) {
      const offset = this.position % 8, take = Math.min(count, 8 - offset);
      value = value * 2 ** take + ((this.bytes[Math.floor(this.position / 8)] >>> (8 - offset - take)) & (2 ** take - 1));
      this.position += take; count -= take;
    }
    return value;
  }
  unary(limit) {
    let value = 0;
    // Skip whole zero bytes without iterating each bit of a long sequence.
    while (this.position % 8 === 0 && this.position < this.bytes.length * 8 && this.bytes[this.position / 8] === 0) {
      this.position += 8; value += 8;
      if (value > limit) throw new Error('AEC sequence exceeds its sample range.');
    }
    while (this.read(1) === 0) {
      if (++value > limit) throw new Error('AEC sequence exceeds its sample range.');
      while (this.position % 8 === 0 && this.position < this.bytes.length * 8 && this.bytes[this.position / 8] === 0) {
        this.position += 8; value += 8;
        if (value > limit) throw new Error('AEC sequence exceeds its sample range.');
      }
    }
    return value;
  }
  align() { this.position = Math.ceil(this.position / 8) * 8; }
}

function configuration(input, options) {
  const { bitsPerSample, blockSize, rsi, flags, samples } = options || {};
  if (!(input instanceof Uint8Array) || input.byteLength > MAX_INPUT) throw new TypeError('Invalid AEC input.');
  if (!Number.isInteger(bitsPerSample) || bitsPerSample < 1 || bitsPerSample > 32 || !Number.isInteger(blockSize) || blockSize < 2 || blockSize > 256 || blockSize % 2 || !Number.isInteger(rsi) || rsi < 1 || rsi > 65535 || rsi * blockSize > MAX_SAMPLES || !Number.isInteger(samples) || samples < 1 || samples > MAX_SAMPLES) throw new RangeError('Invalid bounded AEC dimensions.');
  if (!Number.isInteger(flags) || flags < 0 || flags > 127 || flags & AEC_FLAGS.signed) throw new Error('Unsupported AEC flags or signed samples.');
  if (flags & AEC_FLAGS.restricted && bitsPerSample > 4) throw new Error('Restricted AEC requires at most four bits.');
  if (!(flags & AEC_FLAGS.notEnforce) && ![8, 16, 32, 64].includes(blockSize)) throw new Error('Unsupported AEC block size.');
  return { bitsPerSample, blockSize, rsi, flags, samples };
}

/** Return integer sample bit patterns before GRIB binary/decimal scaling. */
export function decodeAecSamples(input, options) {
  const { bitsPerSample: width, blockSize: block, rsi, flags, samples } = configuration(input, options);
  const reader = new Bits(input), output = new Uint32Array(samples), buffer = new Uint32Array(rsi * block);
  const preprocess = Boolean(flags & AEC_FLAGS.preprocess), maximum = 2 ** width - 1, midpoint = 2 ** (width - 1);
  const idBits = width > 16 ? 5 : width > 8 ? 4 : flags & AEC_FLAGS.restricted ? width <= 2 ? 1 : 2 : 3;
  const maximumId = 2 ** idBits - 1;
  let used = 0, written = 0;
  const put = value => {
    if (!Number.isInteger(value) || value < 0 || value > maximum || used >= buffer.length) throw new Error('AEC block exceeds its sample range.');
    buffer[used++] = value;
  };
  function flush() {
    let at = 0, value = buffer[0];
    if (preprocess && used && written < samples) { output[written++] = value; at = 1; }
    for (; at < used && written < samples; at++) {
      if (preprocess) {
        const delta = buffer[at], half = Math.ceil(delta / 2), upper = value >= midpoint;
        if (half <= (upper ? maximum - value : value)) value += delta % 2 ? -Math.floor(delta / 2) - 1 : delta / 2;
        else value = upper ? maximum - delta : delta;
        if (value < 0 || value > maximum) throw new Error('AEC preprocessor exceeds its sample range.');
        output[written++] = value;
      } else output[written++] = buffer[at];
    }
    used = 0;
  }
  while (written < samples) {
    const reference = preprocess && used === 0 ? 1 : 0, id = reader.read(idBits);
    if (id === maximumId) {
      for (let n = 0; n < block; n++) put(reader.read(width));
    } else if (id > 0) {
      const k = id - 1;
      if (reference) put(reader.read(width));
      const base = used;
      for (let n = reference; n < block; n++) put(reader.unary(maximum) * 2 ** k);
      if (k) for (let n = base; n < used; n++) {
        const value = buffer[n] + reader.read(k);
        if (value > maximum) throw new Error('AEC split value exceeds its sample range.');
        buffer[n] = value;
      }
    } else {
      const secondExtension = reader.read(1);
      if (reference) put(reader.read(width));
      if (secondExtension) {
        for (let n = reference; n < block;) {
          const m = reader.unary(90), diagonal = Math.floor((Math.sqrt(8 * m + 1) - 1) / 2), second = m - diagonal * (diagonal + 1) / 2;
          if (n % 2 === 0) { put(diagonal - second); n++; }
          put(second); n++;
        }
      } else {
        let zeroBlocks = reader.unary(Math.max(4, rsi + 1)) + 1;
        const blockIndex = Math.floor((used - reference) / block);
        if (zeroBlocks === 5) zeroBlocks = Math.min(rsi - blockIndex, 64 - blockIndex % 64);
        else if (zeroBlocks > 5) zeroBlocks--;
        const count = zeroBlocks * block - reference;
        if (used + count > buffer.length) throw new Error('AEC zero run exceeds its reference interval.');
        buffer.fill(0, used, used + count); used += count;
      }
    }
    if (used === buffer.length || used >= samples - written) {
      flush();
      if (flags & AEC_FLAGS.padRsi) reader.align();
    }
  }
  return output;
}

/** Return libaec-compatible sample bytes with declared width and byte order. */
export function decodeAec(input, options) {
  const values = decodeAecSamples(input, options), width = options.bitsPerSample;
  const size = width <= 8 ? 1 : width <= 16 ? 2 : width <= 24 && options.flags & AEC_FLAGS.threeByte ? 3 : 4;
  const output = new Uint8Array(values.length * size), msb = Boolean(options.flags & AEC_FLAGS.msb);
  for (let i = 0; i < values.length; i++) for (let byte = 0; byte < size; byte++) {
    const shift = (msb ? size - byte - 1 : byte) * 8;
    output[i * size + byte] = Math.floor(values[i] / 2 ** shift) & 255;
  }
  return output;
}

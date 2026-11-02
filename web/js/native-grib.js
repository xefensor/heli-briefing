/** Narrow GRIB2 reader for the documented DWD native-grid point products.
 * Supports one field, grid template 3.101, product template 4.0 and CCSDS 5.42.
 * This deliberately rejects other products/packing instead of guessing a value.
 * Section layouts: https://codes.ecmwf.int/grib/format/grib2/templates/
 */
import { decodeAecSamples } from './aec.js';

const FIELDS = Object.freeze({
  CEILING: { category: 6, number: 13, units: 'm MSL', firstSurface: 2, secondSurface: 101 },
  CLAT: { category: 191, number: 1, units: 'Degree N', firstSurface: 1, secondSurface: 255 },
  CLON: { category: 191, number: 2, units: 'Degree E', firstSurface: 1, secondSurface: 255 },
  HSURF: { category: 3, number: 6, units: 'm MSL', firstSurface: 1, secondSurface: 101 },
});
const MAX_POINTS = 1_500_000;
const TIME_UNITS = new Map([[0, 60000], [1, 3600000], [2, 86400000], [10, 10800000], [11, 21600000], [12, 43200000], [13, 1000]]);
const fail = message => { throw new Error(`Nativní GRIB: ${message}`); };
const signedMagnitude = (value, sign) => value >= sign ? -(value - sign) : value;

function date(year, month, day, hour, minute, second) {
  const at = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 1970 || year > 2200 || at.getUTCFullYear() !== year || at.getUTCMonth() + 1 !== month || at.getUTCDate() !== day || at.getUTCHours() !== hour || at.getUTCMinutes() !== minute || at.getUTCSeconds() !== second) fail('neplatné datum běhu.');
  return at.getTime();
}

/** Decode only an explicitly requested DWD field; missing bitmap values are NaN. */
export function decodeNativeGrib(input, { expectedField } = {}) {
  const field = FIELDS[expectedField];
  if (!field) fail('neznámý požadovaný parametr.');
  const bytes = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : null;
  if (!bytes || bytes.byteLength < 146 || bytes.byteLength > 8_000_000) fail('neplatná velikost zprávy.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 71 || bytes[1] !== 82 || bytes[2] !== 73 || bytes[3] !== 66 || bytes[7] !== 2 || bytes[6] !== 0 || view.getBigUint64(8) !== BigInt(bytes.byteLength) || !bytes.subarray(-4).every(value => value === 55)) fail('neplatná hlavička nebo délka GRIB2.');
  const sections = new Map();
  let offset = 16, previous = 0;
  while (offset < bytes.byteLength - 4) {
    if (offset + 5 > bytes.byteLength - 4) fail('neúplná hlavička sekce.');
    const length = view.getUint32(offset), number = bytes[offset + 4];
    if (length < 5 || offset + length > bytes.byteLength - 4 || number <= previous || number < 1 || number > 7) fail('neúplná, opakovaná nebo neočekávaná sekce.');
    sections.set(number, new DataView(bytes.buffer, bytes.byteOffset + offset, length));
    previous = number; offset += length;
  }
  if (offset !== bytes.byteLength - 4 || [1, 3, 4, 5, 6, 7].some(number => !sections.has(number))) fail('chybí povinná sekce.');
  const id = sections.get(1), grid = sections.get(3), product = sections.get(4), packing = sections.get(5), bitmapSection = sections.get(6), data = sections.get(7);
  if (id.byteLength !== 21 || id.getUint16(5) !== 78 || id.getUint8(11) !== 1) fail('neočekávaný původ nebo význam času běhu.');
  const runMs = date(id.getUint16(12), id.getUint8(14), id.getUint8(15), id.getUint8(16), id.getUint8(17), id.getUint8(18));
  if (grid.byteLength !== 35 || grid.getUint8(5) !== 0 || grid.getUint8(10) !== 0 || grid.getUint8(11) !== 0 || grid.getUint16(12) !== 101) fail('podporována je pouze nativní síť 3.101.');
  const count = grid.getUint32(6), gridNumber = grid.getUint8(15) * 65536 + grid.getUint16(16), gridReference = grid.getUint8(18);
  if (!count || count > MAX_POINTS) fail('neplatný počet buněk.');
  const uuid = Array.from({ length: 16 }, (_, i) => grid.getUint8(19 + i).toString(16).padStart(2, '0')).join('');
  if (/^0+$/.test(uuid)) fail('chybí identita sítě.');
  if (product.byteLength !== 34 || product.getUint16(5) !== 0 || product.getUint16(7) !== 0 || product.getUint8(9) !== field.category || product.getUint8(10) !== field.number || product.getUint8(22) !== field.firstSurface || product.getUint8(28) !== field.secondSurface) fail('parametr nebo výšková reference neodpovídá požadavku.');
  const timeUnit = TIME_UNITS.get(product.getUint8(17)), lead = signedMagnitude(product.getUint32(18), 0x80000000);
  if (!timeUnit || lead < 0 || lead * timeUnit > 120 * 3600000) fail('nepodporovaný čas předpovědi.');
  const validMs = runMs + lead * timeUnit;
  if (packing.byteLength !== 25 || packing.getUint16(9) !== 42 || packing.getUint8(20) !== 0) fail('podporováno je pouze CCSDS 5.42 s reálnými hodnotami.');
  const packedCount = packing.getUint32(5), reference = packing.getFloat32(11), binaryScale = signedMagnitude(packing.getUint16(15), 0x8000), decimalScale = signedMagnitude(packing.getUint16(17), 0x8000);
  const bitsPerSample = packing.getUint8(19), flags = packing.getUint8(21), blockSize = packing.getUint8(22), rsi = packing.getUint16(23);
  if (!Number.isFinite(reference) || Math.abs(binaryScale) > 60 || Math.abs(decimalScale) > 15 || bitsPerSample > 32 || packedCount > count) fail('neplatné měřítko nebo počet zabalených hodnot.');
  if (bitmapSection.byteLength < 6) fail('neúplná maska.');
  const indicator = bitmapSection.getUint8(5);
  let bitmap = null;
  if (indicator === 255) {
    if (bitmapSection.byteLength !== 6 || packedCount !== count) fail('počet hodnot nesouhlasí se sítí.');
  } else if (indicator === 0) {
    if (bitmapSection.byteLength !== 6 + Math.ceil(count / 8)) fail('neplatná délka masky.');
    bitmap = new Uint8Array(count); let present = 0;
    for (let i = 0; i < count; i++) { bitmap[i] = bitmapSection.getUint8(6 + (i >> 3)) >> (7 - (i % 8)) & 1; present += bitmap[i]; }
    if (present !== packedCount) fail('maska a hodnoty nejsou zarovnány.');
    if (count % 8 && bitmapSection.getUint8(bitmapSection.byteLength - 1) & (1 << (8 - count % 8)) - 1) fail('neplatné doplnění masky.');
  } else fail('nepodporovaná zděděná nebo předdefinovaná maska.');
  const packed = new Uint8Array(data.buffer, data.byteOffset + 5, data.byteLength - 5);
  const integers = bitsPerSample === 0 || packedCount === 0 ? new Uint32Array(packedCount) : decodeAecSamples(packed, { bitsPerSample, blockSize, rsi, flags, samples: packedCount });
  if (bitsPerSample === 0 && packed.length) fail('konstantní pole obsahuje neočekávané hodnoty.');
  const values = new Float64Array(count), factor = 2 ** binaryScale, decimal = 10 ** -decimalScale;
  for (let i = 0, j = 0; i < count; i++) {
    if (bitmap && !bitmap[i]) { values[i] = NaN; continue; }
    const value = (reference + integers[j++] * factor) * decimal;
    values[i] = Number.isFinite(value) && Math.abs(value) <= 1_000_000 ? value : NaN;
  }
  return { field: expectedField, units: field.units, runTime: new Date(runMs).toISOString(), validAt: new Date(validMs).toISOString(), centre: 78,
    grid: { type: 'native-unstructured', uuid, number: gridNumber, reference: gridReference, count },
    packing: { template: 42, reference, binaryScale, decimalScale, bitsPerSample, flags, blockSize, rsi }, values };
}

export function assertSameNativeGrid(...fields) {
  if (!fields.length || fields.some(field => !field?.grid || field.values?.length !== field.grid.count || field.grid.uuid !== fields[0].grid.uuid || field.grid.number !== fields[0].grid.number || field.grid.count !== fields[0].grid.count || field.grid.reference !== fields[0].grid.reference)) fail('pole nepatří stejné nativní síti.');
}

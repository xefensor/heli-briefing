/* Research only. setup.py copies this worker and pinned decoder assets to web/data,
 * which the application build excludes. This is a separate ICON-EU experiment,
 * not the production ICON-D2 adapter or a verified briefing product. */
importScripts('./eccodes.js');
const ceilingFactory = self.createEccodes;
importScripts('./bz2.js');
const bzipFactory = self.Module;
importScripts('./wrapper.js');
const ProofEccodes = self.CeilingProofWrapper.Eccodes;
const ORIGIN = 'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/';
const PREFIX = 'dynamical/dwd-icon-grib/icon-eu/regular-lat-lon/';
const announce = (stage, extra = {}) => self.postMessage({ stage, ...extra });
async function get(url, limit) {
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`Provider HTTP ${response.status}`);
  const size = Number(response.headers.get('content-length'));
  if (size > limit) throw Error('Provider response exceeds size bound');
  const value = new Uint8Array(await response.arrayBuffer());
  if (value.byteLength > limit) throw Error('Provider response exceeds size bound');
  return value;
}
async function list(params) {
  return new TextDecoder().decode(await get(`${ORIGIN}?${new URLSearchParams({ 'list-type': '2', ...params })}`, 150000));
}
function metadataTime(date, time) {
  const d = String(date), t = String(time).padStart(4, '0');
  if (!/^\d{8}$/.test(d) || !/^\d{4}$/.test(t)) throw Error('Malformed GRIB date/time');
  const value = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)), Number(t.slice(0, 2)), Number(t.slice(2, 4)));
  if (!Number.isFinite(value)) throw Error('Invalid GRIB date/time');
  return value;
}
function decompress(module, bytes) {
  const capacity = 4000000;
  const src = module._malloc(bytes.byteLength), dest = module._malloc(capacity);
  try {
    module.HEAPU8.set(bytes, src);
    const answer = module.decompress(dest, capacity, src, bytes.byteLength, 0);
    if (answer.code || !answer.buffer) throw Error(`Bzip2 decoder: ${answer.error || answer.code}`);
    return new Uint8Array(answer.buffer);
  } finally { module._free(src); module._free(dest); }
}
self.onmessage = async ({ data }) => {
  let handle;
  try {
    const start = performance.now(), now = Date.now();
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lon) || data.lat < -90 || data.lat > 90 || data.lon < -180 || data.lon > 180) throw Error('Invalid test coordinate');
    const since = new Date(now - 86400000).toISOString().slice(0, 10);
    announce('Discovering actual published ICON-EU runs directly from the public source bucket…');
    const runsXml = await list({ prefix: PREFIX, delimiter: '/', 'start-after': `${PREFIX}${since}T00`, 'max-keys': '12' });
    const runs = [...runsXml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)].map(x => x[1]).filter(x => /^dynamical\/dwd-icon-grib\/icon-eu\/regular-lat-lon\/\d{4}-\d{2}-\d{2}T(?:00|06|12|18)\/$/.test(x)).filter(x => Date.parse(`${x.slice(PREFIX.length, -1)}:00:00Z`) <= now).sort();
    const run = runs.at(-1);
    if (!run) throw Error('No advertised nonfuture run');
    const keysXml = await list({ prefix: `${run}ceiling/`, 'max-keys': '100' });
    const keys = [...keysXml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(x => x[1]);
    const runDate = `${run.slice(PREFIX.length, -1)}:00:00Z`;
    const runMs = Date.parse(runDate), wantedMs = Math.ceil(now / 3600000) * 3600000;
    const choices = keys.map(key => ({ key, match: key.match(/\/icon-eu_europe_regular-lat-lon_single-level_(\d{10})_(\d{3})_CEILING\.grib2\.bz2$/) })).filter(x => x.match && x.key.startsWith(`${run}ceiling/`)).map(x => ({ key: x.key, lead: Number(x.match[2]), valid: runMs + Number(x.match[2]) * 3600000 })).filter(x => x.valid >= wantedMs && x.lead <= 120).sort((a, b) => a.valid - b.valid);
    const chosen = choices[0];
    if (!chosen) throw Error('No advertised suitable forecast step');
    const sourceUrl = ORIGIN + chosen.key;
    announce('Fetching one actual advertised forecast file and initializing the isolated WASM decoders…');
    const [compressed, bz, module] = await Promise.all([
      get(sourceUrl, 3000000),
      bzipFactory({ locateFile: name => new URL(name, self.location.href).href }),
      ceilingFactory({ locateFile: name => new URL(name, self.location.href).href }),
    ]);
    const grib = decompress(bz, compressed);
    if (new TextDecoder().decode(grib.subarray(0, 4)) !== 'GRIB') throw Error('Not GRIB after decompression');
    module.FS.mkdirTree('/proof'); module.FS.writeFile('/proof/ceiling.grib2', grib);
    const eccodes = new ProofEccodes(module);
    handle = eccodes.openGrib('/proof/ceiling.grib2');
    announce('Decoding the actual CEILING field in this browser worker…');
    const meta = {};
    for (const key of ['shortName', 'name', 'units', 'gridType', 'packingType']) meta[key] = handle.getString(key);
    for (const key of ['centre', 'dataDate', 'dataTime', 'validityDate', 'validityTime', 'Ni', 'Nj', 'numberOfDataPoints', 'bitmapPresent', 'scanningMode', 'parameterCategory', 'parameterNumber']) meta[key] = handle.getLong(key);
    for (const key of ['latitudeOfFirstGridPointInDegrees', 'longitudeOfFirstGridPointInDegrees', 'iDirectionIncrementInDegrees', 'jDirectionIncrementInDegrees']) meta[key] = handle.getDouble(key);
    if (meta.shortName !== 'ceil' || meta.units !== 'm' || meta.gridType !== 'regular_ll' || meta.parameterCategory !== 6 || meta.parameterNumber !== 13 || meta.centre !== 78 || meta.scanningMode !== 64 || meta.Ni * meta.Nj !== meta.numberOfDataPoints || meta.numberOfDataPoints > 2000000) throw Error('Unexpected product/grid identity');
    if (metadataTime(meta.dataDate, meta.dataTime) !== runMs || metadataTime(meta.validityDate, meta.validityTime) !== chosen.valid) throw Error('Actual GRIB run/validity does not match the advertised object');
    const values = handle.getDoubleArray('values');
    if (values.length !== meta.numberOfDataPoints) throw Error('Decoded values do not match the advertised grid');
    const longitude = meta.longitudeOfFirstGridPointInDegrees > 180 ? data.lon + 360 : data.lon;
    const i = Math.round((longitude - meta.longitudeOfFirstGridPointInDegrees) / meta.iDirectionIncrementInDegrees);
    const j = Math.round((data.lat - meta.latitudeOfFirstGridPointInDegrees) / meta.jDirectionIncrementInDegrees);
    if (i < 0 || i >= meta.Ni || j < 0 || j >= meta.Nj) throw Error('Point outside published model grid');
    const index = j * meta.Ni + i;
    const bitmap = meta.bitmapPresent ? handle.getDoubleArray('bitmap') : null;
    if (bitmap && bitmap.length !== values.length) throw Error('Bitmap and values are misaligned');
    const valueMsl = bitmap && !bitmap[index] || !Number.isFinite(values[index]) ? null : values[index];
    const result = { experimental: true, model: 'ICON-EU', product: 'CEILING', units: 'm MSL', definition: 'Scale/subscale cloud coverage first exceeds 50% looking upward; excludes convective contribution. Not observed METAR ceiling.', sourceUrl, sourceRun: runDate, advertisedValidAt: new Date(chosen.valid).toISOString(), retrievedAt: new Date().toISOString(), meta, sample: { requestedLat: data.lat, requestedLon: data.lon, gridLat: meta.latitudeOfFirstGridPointInDegrees + j * meta.jDirectionIncrementInDegrees, gridLon: (meta.longitudeOfFirstGridPointInDegrees + i * meta.iDirectionIncrementInDegrees + 180) % 360 - 180, valueMsl }, compressedBytes: compressed.byteLength, gribBytes: grib.byteLength, wasmHeapBytes: module.HEAPU8.byteLength, totalMs: Math.round(performance.now() - start), decoderVersions: { eccodesWasm: '2.48.2', foxgloveBzip: '0.3.0' }, attribution: 'DWD ICON-EU from dynamical.org · Source Cooperative · CC BY 4.0' };
    announce('Actual CORS fetch, bzip2 decompression and CEILING decode succeeded in this browser.', { result, done: true });
  } catch (error) { announce(`Failed: ${error.message}`, { done: true }); }
  finally { handle?.delete(); }
};

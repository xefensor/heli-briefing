/** Browser-native ICON-EU CEILING from the public unmodified DWD archive.
 * Public data host, not a project proxy. No credentials or software downloads.
 */
import { decodeNativeGrib, assertSameNativeGrid } from './native-grib.js';

export const NATIVE_CEILING_ORIGIN = 'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/';
export const NATIVE_CEILING_PREFIX = 'dynamical/dwd-icon-grib/icon-eu/icosahedral/';
export const NATIVE_CEILING_DOCUMENTATION = 'https://www.dwd.de/SharedDocs/downloads/DE/modelldokumentationen/nwv/icon/icon_dbbeschr_aktuell.pdf?nn=344870&view=nasPublication';
export const NATIVE_CEILING_DEFINITION = 'Height in metres above mean sea level where scale/subscale cloud coverage first exceeds 50% looking upward from ground; excludes the convective contribution. Not an observed METAR ceiling or an AGL measurement.';
const HOUR = 3600000, MAX_NODES = 2048, MAX_DISTANCE = 8;
const iso = at => new Date(at).toISOString();
const finite = value => typeof value === 'number' && Number.isFinite(value);
const abort = signal => { if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Načítání ICON-EU bylo zrušeno.', 'AbortError'); };
const fail = message => { throw new Error(`ICON-EU CEILING: ${message}`); };
export function createNativeCeilingCache() { return { manifest: null, fields: new Map() }; }
const defaultCache = createNativeCeilingCache();

function clock(now) {
  const at = typeof now === 'function' ? now() : now;
  if (!finite(at) || at < 0 || at > Date.UTC(2200, 0, 1)) fail('neplatný čas prohlížeče.');
  return at;
}
function selectedInstant(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!match || +match[4] > 23 || +match[5] > 59 || +(match[6] || 0) > 59) return NaN;
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  if (day.getUTCFullYear() !== +match[1] || day.getUTCMonth() + 1 !== +match[2] || day.getUTCDate() !== +match[3]) return NaN;
  return Date.parse(value);
}
function runTime(prefix) {
  const text = prefix.slice(NATIVE_CEILING_PREFIX.length, -1), at = Date.parse(`${text}:00:00Z`);
  return finite(at) && iso(at).slice(0, 13) === text ? at : NaN;
}
const runPattern = /^dynamical\/dwd-icon-grib\/icon-eu\/icosahedral\/\d{4}-\d{2}-\d{2}T(?:00|03|06|09|12|15|18|21)\/$/;

function parseListing(text) {
  if (typeof text !== 'string' || text.length > 200000 || /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text) || !/<ListBucketResult\b[^>]*xmlns="http:\/\/s3\.amazonaws\.com\/doc\/2006-03-01\/"/.test(text) || !/<\/ListBucketResult>\s*$/.test(text) || !/<IsTruncated>false<\/IsTruncated>/.test(text)) fail('katalog má neočekávaný nebo neúplný formát.');
  const keys = [...text.matchAll(/<Contents>\s*<Key>([^<]+)<\/Key>[\s\S]*?<\/Contents>/g)].map(match => match[1]);
  const prefixes = [...text.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>\s*<\/CommonPrefixes>/g)].map(match => match[1]);
  if (keys.length > 150 || prefixes.length > 24 || [...keys, ...prefixes].some(value => /[&\x00-\x20]/.test(value))) fail('katalog obsahuje nepovolené klíče.');
  return { keys, prefixes };
}
function listingUrl(parameters) { return `${NATIVE_CEILING_ORIGIN}?${new URLSearchParams({ 'list-type': '2', ...parameters })}`; }
async function response(fetcher, url, signal, limit, immutable = false) {
  abort(signal);
  const result = await fetcher(url, { mode: 'cors', credentials: 'omit', cache: immutable ? 'force-cache' : 'default', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!result.ok) fail(`zdroj vrátil HTTP ${result.status}.`);
  if (result.url && result.url !== url) fail('zdroj byl přesměrován mimo očekávaný objekt.');
  const advertised = Number(result.headers?.get?.('Content-Length'));
  if (finite(advertised) && advertised > limit) fail('odpověď překročila velikostní limit.');
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length > limit) fail('odpověď překročila velikostní limit.');
  abort(signal); return bytes;
}

/** Actual advertised run and CEILING keys, with ten-minute catalogue reuse. */
export async function discoverNativeCeiling({ fetcher = globalThis.fetch, now = Date.now, signal, cache = defaultCache, force = false } = {}) {
  const at = clock(now); abort(signal);
  if (!force && cache.manifest?.checkedAt <= at && at - cache.manifest.checkedAt < 600000) return cache.manifest;
  const since = iso(at - 86400000).slice(0, 10), url = listingUrl({ prefix: NATIVE_CEILING_PREFIX, delimiter: '/', 'start-after': `${NATIVE_CEILING_PREFIX}${since}T00`, 'max-keys': '24' });
  const runs = parseListing(new TextDecoder().decode(await response(fetcher, url, signal, 200000))).prefixes.filter(prefix => runPattern.test(prefix) && runTime(prefix) <= at && runTime(prefix) >= at - 48 * HOUR).sort();
  if (!runs.length) fail('není inzerován žádný nedávný běh.');
  const run = runs.at(-1), runMs = runTime(run);
  const contents = parseListing(new TextDecoder().decode(await response(fetcher, listingUrl({ prefix: `${run}CEILING/`, 'max-keys': '150' }), signal, 200000))).keys;
  const steps = contents.flatMap(key => {
    if (!key.startsWith(`${run}CEILING/`)) return [];
    const match = /^PT(\d{3})H00M\.grib2$/.exec(key.slice(`${run}CEILING/`.length));
    if (!match || +match[1] > 120) return [];
    return [{ key, validAt: iso(runMs + +match[1] * HOUR), leadHours: +match[1] }];
  }).sort((a, b) => a.leadHours - b.leadHours);
  if (!steps.length || new Set(steps.map(step => step.validAt)).size !== steps.length) fail('běh nemá ověřitelný inventář CEILING.');
  const manifest = { run, runTime: iso(runMs), steps, checkedAt: at, sourceUrl: `${NATIVE_CEILING_ORIGIN}${run}` };
  cache.manifest = manifest; return manifest;
}

function distance(lat, lon, otherLat, otherLon) {
  const rad = Math.PI / 180, a = Math.sin((otherLat - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(otherLat * rad) * Math.sin((otherLon - lon) * rad / 2) ** 2;
  return 12742.0176 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
/** A real nearest native centre and bounded real-cell crop; no interpolation. */
export function cropNativeGrid(latitude, longitude, surface, { lat, lon, maxNodes = MAX_NODES } = {}) {
  assertSameNativeGrid(latitude, longitude, surface);
  if (!finite(lat) || !finite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || !Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > MAX_NODES) fail('neplatné místo nebo limit výřezu.');
  const region = { south: Math.max(-90, lat - 0.9), north: Math.min(90, lat + 0.9), west: Math.max(-180, lon - 1.5), east: Math.min(180, lon + 1.5) };
  let nearest = -1, distanceKm = Infinity;
  const indices = [];
  for (let i = 0; i < latitude.values.length; i++) {
    const y = latitude.values[i], x = longitude.values[i];
    if (!finite(y) || !finite(x) || y < -90 || y > 90 || x < -180 || x > 180) continue;
    // An axis bound saves trigonometry for distant cells without choosing a fake centre.
    if (Math.abs(y - lat) < 1 && Math.abs(x - lon) < 3) {
      const km = distance(lat, lon, y, x); if (km < distanceKm) { nearest = i; distanceKm = km; }
    }
    if (y >= region.south && y <= region.north && x >= region.west && x <= region.east) indices.push(i);
  }
  if (nearest < 0 || distanceKm > MAX_DISTANCE) fail(`bod nemá blízkou buňku nativní sítě${finite(distanceKm) ? ` (nejbližší ${distanceKm.toFixed(1)} km)` : ''}.`);
  if (!indices.includes(nearest)) fail('nejbližší buňka je mimo výřez.');
  const totalCells = indices.length;
  const selected = totalCells > maxNodes ? Array.from({ length: maxNodes }, (_, i) => indices[Math.floor(i * totalCells / maxNodes)]) : indices;
  if (!selected.includes(nearest)) selected[selected.length - 1] = nearest;
  selected.sort((a, b) => a - b);
  const points = selected.map(index => ({ lat: latitude.values[index], lon: longitude.values[index], index, elevationMsl: finite(surface.values[index]) ? surface.values[index] : null }));
  return { region, indices: selected, points, totalCells, subset: selected.length < totalCells, nearestIndex: selected.indexOf(nearest), distanceKm };
}

function checkField(field, kind, manifest, validAt) {
  if (field.field !== kind || field.runTime !== manifest.runTime || field.validAt !== validAt) fail('skutečný parametr, běh nebo platnost GRIB neodpovídá katalogu.');
}

/** Six initial hourly slots, up to 24 explicitly requested; gaps remain null. */
export async function fetchNativeCeiling({ lat, lon, time, now = Date.now, fetcher = globalThis.fetch, signal, cache = defaultCache, frameLimit = 6, onProgress = () => {}, force = false } = {}) {
  const at = clock(now), selectedMs = selectedInstant(time);
  if (!finite(lat) || !finite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || !finite(selectedMs) || !Number.isInteger(frameLimit) || frameLimit < 1 || frameLimit > 24) fail('neplatné místo, čas nebo počet hodin.');
  abort(signal); onProgress('ICON-EU · hledám skutečně publikovaný nativní běh…');
  const manifest = await discoverNativeCeiling({ fetcher, now, signal, cache, force });
  const target = Math.floor(selectedMs / HOUR) * HOUR;
  const first = Date.parse(manifest.steps[0].validAt), last = Date.parse(manifest.steps.at(-1).validAt);
  if (target < first || target > last) fail(`vybraný čas je mimo inzerované období ${manifest.steps[0].validAt} – ${manifest.steps.at(-1).validAt}.`);
  const byTime = new Map(manifest.steps.map(step => [step.validAt, step]));
  const slots = Array.from({ length: frameLimit }, (_, i) => iso(target + i * HOUR));
  const selectedSlot = slots.reduce((best, slot, i) => Math.abs(Date.parse(slot) - selectedMs) < Math.abs(Date.parse(slots[best]) - selectedMs) ? i : best, 0);
  // Keep one current set of grid companions; never mix its terrain with another run.
  for (const [url, cached] of cache.fields) if (cached.field !== 'CEILING' && cached.runTime !== manifest.runTime) cache.fields.delete(url);
  const total = 3 + slots.filter(slot => byTime.has(slot)).length;
  let completed = 0, active = 0;
  const queue = [];
  async function limited(work) {
    if (active >= 2) await new Promise(resolve => queue.push(resolve));
    active++;
    try { abort(signal); return await work(); }
    finally { active--; queue.shift()?.(); }
  }
  async function field(kind, key, expectedValid) {
    const url = NATIVE_CEILING_ORIGIN + key;
    let existing = cache.fields.get(url);
    if (existing) {
      cache.fields.delete(url); cache.fields.set(url, existing);
      checkField(existing, kind, manifest, expectedValid); completed++; onProgress(`ICON-EU · nativní síť a hodiny ${completed}/${total}…`); return existing;
    }
    return limited(async () => {
      const bytes = await response(fetcher, url, signal, 8_000_000, true), decoded = decodeNativeGrib(bytes, { expectedField: kind });
      checkField(decoded, kind, manifest, expectedValid);
      existing = { ...decoded, sourceUrl: url, retrievedAt: iso(clock(now)) };
      cache.fields.set(url, existing);
      while (cache.fields.size > 15) {
        const oldestCeiling = [...cache.fields].find(([, value]) => value.field === 'CEILING');
        cache.fields.delete(oldestCeiling?.[0] || cache.fields.keys().next().value);
      }
      completed++; onProgress(`ICON-EU · nativní síť a hodiny ${completed}/${total}…`); return existing;
    });
  }
  // Coordinate/orography objects are advertised by this archive's native-run convention.
  // Each actual object must load and validate before any sample is shown.
  const companion = await Promise.all(['CLAT', 'CLON', 'HSURF'].map(kind => field(kind, `${manifest.run}${kind}/PT000H00M.grib2`, manifest.runTime)));
  assertSameNativeGrid(...companion);
  const crop = cropNativeGrid(...companion, { lat, lon });
  const fields = await Promise.all(slots.map(async validAt => {
    const step = byTime.get(validAt);
    if (!step) return { validAt, status: 'missing', sourceUrl: null, retrievedAt: null, values: crop.points.map(() => null), error: 'Tato hodina není v katalogu dostupná.' };
    try {
      const decoded = await field('CEILING', step.key, validAt); assertSameNativeGrid(...companion, decoded);
      return { validAt, status: 'ok', sourceUrl: decoded.sourceUrl, retrievedAt: decoded.retrievedAt, values: crop.indices.map(index => finite(decoded.values[index]) ? decoded.values[index] : null), error: null };
    } catch (error) {
      abort(signal); return { validAt, status: 'unavailable', sourceUrl: NATIVE_CEILING_ORIGIN + step.key, retrievedAt: null, values: crop.points.map(() => null), error: error.message };
    }
  }));
  abort(signal);
  if (!fields.some(frame => frame.status === 'ok')) fail('nepodařilo se potvrdit žádný požadovaný výstup; dříve načtené hodnoty se tím neobnovují.');
  const failed = fields.filter(frame => frame.status !== 'ok'), selected = fields[selectedSlot], nearest = crop.points[crop.nearestIndex];
  const valueMsl = selected.values[crop.nearestIndex], stale = at - Date.parse(manifest.runTime) > 9 * HOUR;
  const error = failed.length ? `${failed.length} z ${fields.length} požadovaných hodin chybí nebo se nepodařilo načíst. Mezery nejsou doplněny.` : null;
  const retrievedAt = fields.filter(frame => frame.retrievedAt).map(frame => frame.retrievedAt).sort().at(-1);
  const common = { schemaVersion: 1, model: 'ICON-EU', product: 'CEILING', units: 'm MSL', runTime: manifest.runTime, retrievedAt,
    sourceUrl: manifest.sourceUrl, archiveUrl: 'https://source.coop/dynamical/dwd-icon-grib', documentationUrl: NATIVE_CEILING_DOCUMENTATION,
    definition: NATIVE_CEILING_DEFINITION, attribution: 'DWD ICON-EU · distribuce dynamical.org / Source Cooperative · CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attemptedAt: iso(at), error };
  const snapshot = { ...common, status: failed.length ? 'partial' : 'ok', region: crop.region,
    grid: { ...companion[0].grid, type: 'native-unstructured', maxDistanceKm: MAX_DISTANCE, sampling: 'nearest actual native cell centre; no interpolation', totalCellsInBounds: crop.totalCells, subset: crop.subset },
    points: crop.points, frames: fields };
  const cell = { ...nearest, gridUuid: companion[0].grid.uuid };
  const regional = selected.status === 'ok' ? { ...common, validAt: selected.validAt, retrievedAt: selected.retrievedAt, gridUuid: companion[0].grid.uuid,
    bounds: [[crop.region.south, crop.region.west], [crop.region.north, crop.region.east]], totalCells: crop.totalCells, subset: crop.subset,
    nodes: crop.points.map((point, i) => ({ lat: point.lat, lon: point.lon, index: point.index, valueMsl: selected.values[i] })), selectedCell: { ...cell, valueMsl } } : null;
  onProgress('ICON-EU · nativní výstup načten.');
  return { ...common, status: selected.status !== 'ok' ? 'unavailable' : valueMsl === null ? 'missing' : 'available', valueMsl,
    requestedLocation: { lat, lon }, requestedTime: time, validAt: selected.status === 'ok' ? selected.validAt : null, retrievedAt: selected.retrievedAt,
    sourceUrl: selected.sourceUrl || manifest.sourceUrl, cell, distanceKm: crop.distanceKm, stale,
    series: { times: fields.map(frame => frame.validAt), values: fields.map(frame => frame.values[crop.nearestIndex]) }, snapshot, regional };
}

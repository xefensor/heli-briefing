/** Direct, bounded EUMETSAT WMS reads. The caller owns retained/stale data. */
const ENDPOINT = 'https://view.eumetsat.int/geoserver/wms';
const LAYER = 'mtg_fd:rgb_geocolour';
const WMS_NAMESPACE = 'http://www.opengis.net/wms';
const BOUNDS = [47, 10, 52, 20]; // south, west, north, east: WMS 1.3 EPSG:4326
const MAX_BYTES = 2_000_000;

function instant(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) throw new Error('Satellite time is not an explicit UTC instant.');
  const parts = match.slice(1, 7).map(Number);
  const milliseconds = Number((match[7] || '').padEnd(3, '0'));
  const at = Date.UTC(parts[0], parts[1] - 1, ...parts.slice(2), milliseconds);
  const date = new Date(at);
  if ([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].some((part, index) => part !== parts[index])) {
    throw new Error('Satellite time is invalid.');
  }
  return at;
}

function duration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  const result = match && (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000;
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('Unsupported satellite time cadence.');
  return result;
}

/** Read only the exact product's own time dimension, not another layer/default. */
export function parseSatelliteCapabilities(xml) {
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unexpected satellite XML declaration.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Satellite capabilities XML is invalid.');
  const named = [...document.getElementsByTagNameNS(WMS_NAMESPACE, 'Layer')].filter(layer =>
    [...layer.children].some(child => child.namespaceURI === WMS_NAMESPACE && child.localName === 'Name' && child.textContent.trim() === LAYER));
  if (named.length !== 1) throw new Error('GeoColour product is missing or ambiguous.');
  const dimensions = [...named[0].children].filter(child => child.namespaceURI === WMS_NAMESPACE && child.localName === 'Dimension' && child.getAttribute('name') === 'time');
  if (dimensions.length !== 1) throw new Error('GeoColour time dimension is missing or ambiguous.');
  return {extent: dimensions[0].textContent.trim(), defaultTime: dimensions[0].getAttribute('default')};
}

/** Return at most two actual advertised frames, newest first, excluding future. */
export function advertisedSatelliteFrames({extent, defaultTime} = {}, now = Date.now()) {
  if (!Number.isFinite(now) || typeof extent !== 'string' || !extent.trim() || extent.length > 150_000) throw new Error('Satellite time inventory is invalid.');
  const entries = extent.split(',').map(value => value.trim());
  if (entries.length > 4096) throw new Error('Satellite time inventory is too large.');
  const values = [];
  let defaultAdvertised = !defaultTime;
  const defaultAt = defaultTime ? instant(defaultTime) : null;
  for (const entry of entries) {
    const parts = entry.split('/');
    if (parts.length === 1) {
      const at = instant(parts[0]);
      if (at === defaultAt) defaultAdvertised = true;
      if (at <= now) values.push(at);
    } else if (parts.length === 3) {
      const start = instant(parts[0]), end = instant(parts[1]), step = duration(parts[2]);
      if (end < start) throw new Error('Satellite time interval is reversed.');
      if (defaultAt !== null && defaultAt >= start && defaultAt <= end && (defaultAt - start) % step === 0) defaultAdvertised = true;
      if (start <= now) {
        const latest = start + Math.floor((Math.min(now, end) - start) / step) * step;
        values.push(latest);
        if (latest - step >= start) values.push(latest - step);
      }
    } else throw new Error('Satellite time interval is unsupported.');
  }
  if (!defaultAdvertised) throw new Error('Satellite default is outside its advertised frames.');
  const result = [...new Set(values)].sort((a, b) => b - a).slice(0, 2);
  if (!result.length) throw new Error('No non-future satellite frame is advertised.');
  return result.map(value => new Date(value).toISOString().replace('.000Z', 'Z'));
}

function imageUrl(time) {
  const query = new URLSearchParams({service: 'WMS', request: 'GetMap', version: '1.3.0', layers: LAYER, styles: '', format: 'image/png', transparent: 'false', crs: 'EPSG:4326', bbox: BOUNDS.join(','), width: '1000', height: '500', time});
  return `${ENDPOINT}?${query}`;
}

async function boundedBytes(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Satellite response exceeds the size limit.');
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error('Satellite response exceeds the size limit.');
    return bytes;
  }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error('Satellite response exceeds the size limit.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function validatePng(bytes) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const end = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  if (bytes.length < 45 || signature.some((value, index) => bytes[index] !== value) || end.some((value, index) => bytes[bytes.length - end.length + index] !== value)) throw new Error('Satellite response is not a complete PNG.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR' || view.getUint32(16) !== 1000 || view.getUint32(20) !== 500) throw new Error('Satellite PNG dimensions or header are unexpected.');
}

function dataUrl(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return 'data:image/png;base64,' + btoa(binary);
}

/** Resolve a fresh schema-1 snapshot or throw; never freshen retained image times. */
export async function fetchSatellite({signal, fetchImpl = globalThis.fetch, now = Date.now, parseCapabilities = parseSatelliteCapabilities, timeoutMs = 20000} = {}) {
  if (typeof fetchImpl !== 'function' || typeof now !== 'function' || typeof parseCapabilities !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw new TypeError('Invalid satellite source options.');
  const started = now();
  if (!Number.isFinite(started)) throw new TypeError('Invalid satellite clock.');
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => controller.abort(new Error('Satellite request timed out.')), timeoutMs);
  async function request(url, accept) {
    const response = await fetchImpl(url, {signal: controller.signal, mode: 'cors', credentials: 'omit', cache: 'no-cache', redirect: 'error', headers: {Accept: accept}});
    if (!response.ok) throw new Error(`EUMETSAT HTTP ${response.status}.`);
    if (response.url && new URL(response.url).origin !== new URL(ENDPOINT).origin) throw new Error('Unexpected satellite response origin.');
    return response;
  }
  try {
    const response = await request(`${ENDPOINT}?service=WMS&request=GetCapabilities&version=1.3.0`, 'application/xml,text/xml');
    const xml = new TextDecoder('utf-8', {fatal: true}).decode(await boundedBytes(response));
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unexpected satellite XML declaration.');
    const frames = advertisedSatelliteFrames(parseCapabilities(xml), started);
    let lastError;
    for (let index = 0; index < frames.length; index++) {
      try {
        const url = imageUrl(frames[index]);
        const image = await request(url, 'image/png');
        if ((image.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'image/png') throw new Error('Satellite response is not image/png.');
        const bytes = await boundedBytes(image);
        validatePng(bytes);
        const finished = now();
        if (!Number.isFinite(finished) || instant(frames[index]) > finished) throw new Error('Satellite clock is invalid.');
        const stamp = new Date(finished).toISOString();
        return {schemaVersion: 1, status: 'ok', product: 'GeoColour RGB', layer: LAYER, bounds: [...BOUNDS], sourceUrl: 'https://user.eumetsat.int/catalogue/EO:EUM:DAT:0913', attribution: 'Contains modified EUMETSAT Meteosat GeoColour product 2026 · EUMETSAT / NASA · regional WMS crop', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', attemptedAt: new Date(started).toISOString(), observedAt: frames[index], retrievedAt: stamp, checkedAt: stamp, imageUrl: url, imageDataUrl: dataUrl(bytes), error: null, ...(index ? {fallbackNote: 'Latest advertised frame failed; image uses the preceding advertised frame.'} : {})};
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason || error;
        lastError = error;
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

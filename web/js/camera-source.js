/** ČHMÚ-owned views displayed through the publicly advertised In-počasí image routes.
 * No provider application is framed and no pixels are read through CORS/canvas.
 * Hour folders are file buckets, not camera exposure times.
 */
export const CAMERA_IMAGE_ORIGIN = 'https://webcams.ventusky.com';
export const CAMERA_IMAGE_DOCUMENTATION = 'https://media.in-pocasi.cz/js/webcam/constants.js';
export const CAMERA_IMAGE_SOURCES = Object.freeze([
  { id: 'ceske_budejovice', mirrorId: '186428055', name: 'České Budějovice', direction: 'Z', lat: 48.952085, lon: 14.46982, pageUrl: 'https://www.chmi.cz/namerena-data/webkamera/ceske_budejovice-ceske-budejovice', alternatePageUrl: 'https://www.in-pocasi.cz/webkamery/jihocesky/ceske-budejovice-186428055/' },
  { id: 'churanov', mirrorId: '855413202', name: 'Churáňov', direction: 'SV', lat: 49.068229, lon: 13.614786, pageUrl: 'https://www.chmi.cz/w/churanov-churanov', alternatePageUrl: 'https://www.in-pocasi.cz/webkamery/jihocesky/churanov-855413202/' },
  { id: 'kocelovice', mirrorId: '533216231', name: 'Kocelovice', direction: 'S–SZ', lat: 49.467246, lon: 13.837805, pageUrl: 'https://www.chmi.cz/w/kocelovice-kocelovice', alternatePageUrl: 'https://www.in-pocasi.cz/webkamery/jihocesky/kocelovice-533216231/' },
].map(item => Object.freeze(item)));
const HOUR = 3600000, STEP = 300000;
const dimensions = image => Number.isInteger(image?.width) && Number.isInteger(image?.height) && image.width >= 100 && image.height >= 100 && image.width <= 4096 && image.height <= 4096;
const iso = at => new Date(at).toISOString();
const pad = value => String(value).padStart(2, '0');
function clock(value) {
  const at = typeof value === 'function' ? value() : value;
  const time = typeof at === 'string' ? Date.parse(at) : at;
  if (!Number.isFinite(time) || time < 0 || time > 8.64e15) throw new Error('Neplatný čas načítání kamer.');
  return time;
}
function aborted(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Načítání kamer bylo zrušeno.', 'AbortError');
}
function source(id) {
  const camera = CAMERA_IMAGE_SOURCES.find(item => item.id === id);
  if (!camera) throw new Error('Neznámá kamera.');
  return camera;
}
function directory(camera) { return `${CAMERA_IMAGE_ORIGIN}/data/${camera.mirrorId.slice(-2)}/${camera.mirrorId}/`; }
function fileStamp(at) {
  const d = new Date(at);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}00`;
}
/** Return route metadata only for the exact known camera, path and cache key. */
export function cameraImageInfo(url, id) {
  if (typeof url !== 'string') return null;
  const camera = CAMERA_IMAGE_SOURCES.find(item => item.id === id);
  if (!camera || !url.startsWith(directory(camera))) return null;
  const tail = url.slice(directory(camera).length);
  const match = /^(latest_thumb\.jpg|hour\/(\d{8}_\d{2}00)\.jpg)(?:\?t=(\d{1,16}))?$/.exec(tail);
  if (!match) return null;
  if (match[3] !== undefined) {
    const at = Number(match[3]);
    if (!Number.isSafeInteger(at) || at < 0 || at > 8.64e15 || at % STEP) return null;
  }
  if (!match[2]) return { variant: 'thumbnail', fileBucketAt: null };
  const stamp = match[2], at = Date.parse(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:00:00Z`);
  if (!Number.isFinite(at) || fileStamp(at) !== stamp) return null;
  return { variant: 'hourly-file', fileBucketAt: iso(at) };
}
export const isAllowedCameraImageUrl = (url, id) => cameraImageInfo(url, id) !== null;

/** The provider's published path convention; successful loading confirms existence only. */
export function cameraImageCandidates(id, now = Date.now()) {
  const camera = source(id), at = clock(now), bucket = Math.floor(at / STEP) * STEP, hour = Math.floor(at / HOUR) * HOUR;
  const candidates = [hour, hour - HOUR].map(time => ({
    imageUrl: `${directory(camera)}hour/${fileStamp(time)}.jpg?t=${bucket}`,
    variant: 'hourly-file', fileBucketAt: iso(time),
  }));
  candidates.push({ imageUrl: `${directory(camera)}latest_thumb.jpg?t=${bucket}`, variant: 'thumbnail', fileBucketAt: null });
  return candidates;
}

/** Ordinary cross-origin image loading, deliberately without crossorigin or canvas. */
export function loadCameraImage(url, { id, signal, timeoutMs = 5000, ImageClass = globalThis.Image } = {}) {
  aborted(signal);
  if (!isAllowedCameraImageUrl(url, id)) throw new Error('Nepovolený zdroj kamerového obrazu.');
  if (typeof ImageClass !== 'function') throw new Error('Prohlížeč nemá podporu načítání obrazu kamery.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 15000) throw new Error('Neplatný časový limit kamery.');
  return new Promise((resolve, reject) => {
    const image = new ImageClass();
    let done = false;
    const finish = (error = null) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      image.onload = null; image.onerror = null;
      if (error) { image.removeAttribute?.('src'); reject(error); }
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new DOMException('Načítání kamery bylo zrušeno.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Načítání kamery překročilo časový limit.')), timeoutMs);
    image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(dimensions({ width: image.naturalWidth, height: image.naturalHeight }) ? null : new Error('Kamera nemá platné rozměry.'));
    image.onerror = () => finish(new Error('Kamerový soubor není dostupný.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.src = url;
  });
}

function base(camera, attemptedAt) {
  return {
    ...camera, provider: 'in-pocasi-ventusky', author: 'ČHMÚ', attribution: 'ČHMÚ · distribuce In-počasí / Ventusky',
    documentationUrl: CAMERA_IMAGE_DOCUMENTATION, licenceUrl: 'https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti',
    displayOnly: true, timeStatus: 'unverified', observedAt: null, imageDataUrl: null,
    attemptedAt, checkedAt: attemptedAt,
    exportNote: 'Kamera je vzdálený obraz bez přístupu k pixelům přes CORS. Offline briefing uchová pouze zdroj a poslední potvrzené načtení. Čas pořízení čti v původním obrazu.',
  };
}
async function fetchCamera(camera, { previous, now, signal, loadImage, timeoutMs }) {
  const at = clock(now), attemptedAt = iso(at), candidates = cameraImageCandidates(camera.id, at);
  let missingCandidates = 0;
  for (const candidate of candidates) {
    aborted(signal);
    try {
      const loaded = await loadImage(candidate.imageUrl, { id: camera.id, signal, timeoutMs });
      aborted(signal);
      if (!dimensions(loaded)) throw new Error('Kamera nemá platné rozměry.');
      return { ...base(camera, attemptedAt), ...candidate, ...loaded, status: 'ok', confirmedBy: 'image-load', retrievedAt: iso(clock(now)), missingCandidates,
        error: candidate.variant === 'thumbnail' ? 'Plný obraz se nepodařilo načíst; zobrazen je malý náhled. Čas ověř u zdroje.' : missingCandidates ? 'Záložní soubor z předchozí hodinové složky; složka neurčuje čas pořízení. Čti čas v obrazu.' : null };
    } catch (error) { aborted(signal); missingCandidates += 1; }
  }
  const old = previous?.items?.find(item => item.id === camera.id), retrieved = Date.parse(old?.retrievedAt), info = cameraImageInfo(old?.imageUrl, camera.id);
  if (old?.displayOnly === true && old.confirmedBy === 'image-load' && info && dimensions(old) && Number.isFinite(retrieved) && retrieved <= at && (!info.fileBucketAt || Date.parse(info.fileBucketAt) <= retrieved)) {
    return { ...base(camera, attemptedAt), ...info, imageUrl: old.imageUrl, width: old.width, height: old.height, retrievedAt: old.retrievedAt, status: 'stale', confirmedBy: 'image-load', retained: true, missingCandidates,
      error: 'Obnova kamery selhala; uveden je čas posledního potvrzeného načtení. Obsah zdrojové adresy se může změnit; čas pořízení ověř v obrazu.' };
  }
  return { ...base(camera, attemptedAt), status: 'unavailable', retrievedAt: null, imageUrl: null, confirmedBy: null, missingCandidates, error: 'Obraz kamery se nepodařilo načíst; žádný náhradní pohled není dosazen.' };
}

/** Three exact views, maximum two simultaneous image requests, at most three candidates each. */
export async function fetchCameraImages({ previous = null, now = Date.now, signal, loadImage = loadCameraImage, timeoutMs = 5000 } = {}) {
  aborted(signal);
  const attemptedAt = iso(clock(now)), items = new Array(CAMERA_IMAGE_SOURCES.length);
  let next = 0;
  async function worker() {
    while (next < CAMERA_IMAGE_SOURCES.length) {
      aborted(signal); const index = next++;
      items[index] = await fetchCamera(CAMERA_IMAGE_SOURCES[index], { previous, now, signal, loadImage, timeoutMs });
    }
  }
  await Promise.all([worker(), worker()]); aborted(signal);
  const loaded = items.filter(item => item.status === 'ok').length;
  return { schemaVersion: 1, delivery: 'browser-direct', provider: 'in-pocasi-ventusky', status: loaded === items.length ? 'ok' : loaded ? 'partial' : items.some(item => item.status === 'stale') ? 'stale' : 'unavailable',
    attemptedAt, retrievedAt: items.map(item => item.retrievedAt).filter(Boolean).sort().at(-1) || null, items };
}

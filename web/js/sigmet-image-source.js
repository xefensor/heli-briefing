/**
 * Direct display of the official ŘLP SIGMET/AIREP map. The OPMET service says
 * its meteorological data are supplied by ČHMÚ; this graphic is not a complete
 * machine-readable warning inventory. Checked 2026-11-02.
 */
export const SIGMET_IMAGE_URL = 'https://meteo.rlp.cz/sigmetmap.png';
export const SIGMET_PAGE = 'https://www.chmi.cz/letectvi/sigmet-vystrahy-pro-letiste';
export const SIGMET_DOCUMENTATION_URL = 'https://meteo.rlp.cz/met_help_cz.html';
const STEP = 5 * 60_000;
const EXPORT_NOTE = 'Mapa SIGMET / AIREP je vzdálený obraz pouze pro online zobrazení. Do zachyceného briefingu patří zdroj a čas potvrzeného načtení, nikoli živý obraz. Čas aktualizace čti v záhlaví mapy v UTC; obraz ani prázdná mapa nepotvrzují úplnost výstrah.';

function instant(value) {
  const at = typeof value === 'function' ? value() : value;
  const ms = typeof at === 'string' ? Date.parse(at) : Number(at);
  if (at == null || !Number.isFinite(ms) || ms < 0 || ms > 8.64e15) throw new TypeError('Neplatný čas požadavku na mapu SIGMET.');
  return ms;
}
function abortCheck(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na mapu SIGMET byl zrušen.', 'AbortError');
}
const dimensions = item => Number.isInteger(item?.width) && Number.isInteger(item?.height) && item.width >= 100 && item.height >= 100 && item.width <= 4096 && item.height <= 4096;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** One fixed provider image, with an optional canonical five-minute cache key. */
export function isAllowedSigmetImageUrl(value) {
  if (typeof value !== 'string') return false;
  if (value === SIGMET_IMAGE_URL) return true;
  if (!value.startsWith(`${SIGMET_IMAGE_URL}?t=`)) return false;
  const key = value.slice(SIGMET_IMAGE_URL.length + 3), number = Number(key);
  return /^(?:0|[1-9]\d{0,15})$/.test(key) && Number.isSafeInteger(number) && number <= 8.64e15 && number % STEP === 0;
}
export const sigmetImageUrl = time => `${SIGMET_IMAGE_URL}?t=${Math.floor(instant(time) / STEP) * STEP}`;

/** Ordinary Image loading; no crossorigin attribute, canvas, byte fetch or OCR. */
export function loadSigmetImage(url, { signal, timeoutMs = 12000, ImageClass = globalThis.Image } = {}) {
  abortCheck(signal);
  if (!isAllowedSigmetImageUrl(url)) throw new Error('Nepovolený zdroj mapy SIGMET.');
  if (typeof ImageClass !== 'function') throw new Error('Prohlížeč nemá podporu načítání mapy SIGMET.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new RangeError('Neplatný limit načítání mapy SIGMET.');
  return new Promise((resolve, reject) => {
    const image = new ImageClass();
    let done = false;
    const finish = (error = null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      image.onload = null; image.onerror = null;
      if (error) { image.removeAttribute?.('src'); reject(error); }
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na mapu SIGMET byl zrušen.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Načítání mapy SIGMET překročilo časový limit.')), timeoutMs);
    image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(dimensions({ width: image.naturalWidth, height: image.naturalHeight }) ? null : new Error('Mapa SIGMET nemá očekávané rozměry.'));
    image.onerror = () => finish(new Error('Mapu SIGMET nelze zobrazit.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.src = url;
  });
}
function base(attemptedAt) {
  return {
    product: 'SIGMET/AIREP map', provider: 'rlp-chmi-map',
    pageUrl: SIGMET_PAGE, sourceUrl: SIGMET_IMAGE_URL, documentationUrl: SIGMET_DOCUMENTATION_URL,
    distributorUrl: 'https://meteo.rlp.cz/', attribution: 'ŘLP ČR · meteorologická data ČHMÚ',
    licenceStatus: 'No additional redistribution grant for the RLP-rendered graphic is established by this adapter.',
    displayOnly: true, coverageComplete: false, coverageStatus: 'unknown',
    issuedAt: null, validFrom: null, validTo: null, observedAt: null, updatedAt: null,
    validityStatus: 'unverified', timeEvidence: 'image-heading',
    imagePath: null, imageDataUrl: null, attemptedAt, checkedAt: attemptedAt, exportNote: EXPORT_NOTE,
  };
}

/** Validate metadata without interpreting a loaded map as an all-clear. */
export function validateSigmetImage(data, { captured = false } = {}) {
  if (!data || typeof data !== 'object' || !['ok', 'stale', 'unavailable'].includes(data.status) || data.displayOnly !== true || data.coverageComplete !== false || data.coverageStatus !== 'unknown') throw new Error('Neplatná metadata mapy SIGMET.');
  if (['issuedAt', 'validFrom', 'validTo', 'observedAt', 'updatedAt'].some(key => data[key] != null) || data.imagePath || data.imageDataUrl) throw new Error('Mapa SIGMET nesmí předstírat ověřenou platnost nebo zachycené obrazové údaje.');
  for (const [key, expected] of [['sourceUrl', SIGMET_IMAGE_URL], ['pageUrl', SIGMET_PAGE], ['documentationUrl', SIGMET_DOCUMENTATION_URL]]) if (data[key] !== expected) throw new Error('Nepovolený zdroj mapy SIGMET.');
  const live = Boolean(data.imageUrl), online = Boolean(data.onlineImageUrl);
  if (live && online) throw new Error('Mapa SIGMET má nejednoznačný zdroj načtení.');
  if (data.status === 'unavailable') {
    if (live || online || data.confirmedBy != null || data.retrievedAt != null || data.width != null || data.height != null) throw new Error('Nedostupná mapa SIGMET nesmí předstírat potvrzené načtení.');
  } else if ((!live && !online) || !dimensions(data) || data.confirmedBy !== 'image-load' || !timestamp(data.retrievedAt)) {
    throw new Error('Mapa SIGMET nemá potvrzené načtení.');
  }
  if (live && !isAllowedSigmetImageUrl(data.imageUrl)) throw new Error('Nepovolený zdroj mapy SIGMET.');
  if (captured && data.imageUrl) throw new Error('Zachycená mapa SIGMET smí obsahovat jen online odkaz, nikoli automaticky načítaný obraz.');
  if (data.onlineImageUrl && (!isAllowedSigmetImageUrl(data.onlineImageUrl) || data.onlineOnly !== true)) throw new Error('Neplatný online odkaz mapy SIGMET.');
  return data;
}

/** Success is display transport only. Source header times and completeness stay unknown. */
export async function fetchSigmetImage({ previous = null, now = Date.now, signal, loadImage = loadSigmetImage, timeoutMs = 12000 } = {}) {
  abortCheck(signal);
  const at = instant(now), attemptedAt = new Date(at).toISOString(), imageUrl = sigmetImageUrl(at);
  try {
    const loaded = await loadImage(imageUrl, { signal, timeoutMs });
    abortCheck(signal);
    if (!dimensions(loaded)) throw new Error('Mapa SIGMET nemá očekávané rozměry.');
    return { ...base(attemptedAt), status: 'ok', imageUrl, width: loaded.width, height: loaded.height,
      retrievedAt: new Date(instant(now)).toISOString(), confirmedBy: 'image-load', error: null };
  } catch (error) {
    abortCheck(signal);
    const retrieved = Date.parse(previous?.retrievedAt), key = previous?.imageUrl?.split('?t=')[1];
    if (previous?.confirmedBy === 'image-load' && previous.displayOnly === true && isAllowedSigmetImageUrl(previous.imageUrl) && dimensions(previous) && Number.isFinite(retrieved) && retrieved <= at && (!key || Number(key) <= at)) {
      return { ...base(attemptedAt), status: 'stale', imageUrl: previous.imageUrl, width: previous.width, height: previous.height,
        retrievedAt: previous.retrievedAt, confirmedBy: 'image-load', retained: true,
        error: 'Obnova mapy SIGMET selhala; uveden je čas posledního potvrzeného načtení. Zdrojová adresa je proměnlivá, nepředstavuje neměnný snímek. Aktuálnost a rozsah ověř u zdroje.' };
    }
    return { ...base(attemptedAt), status: 'unavailable', imageUrl: null, retrievedAt: null, confirmedBy: null,
      error: 'Mapu SIGMET se nepodařilo načíst. Neznamená to nepřítomnost výstrah.' };
  }
}

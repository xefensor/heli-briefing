/** Official ČHMÚ-authored SWL distributed by ŘLP. Ordinary image display only. */
export const SWL_IMAGE_URL = 'https://meteo.rlp.cz/swlmap.png';
export const SWL_PAGE_URL = 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa';
export const SWL_DOCUMENTATION_URL = 'https://meteo.rlp.cz/swldoc.pdf';
const STEP = 5 * 60_000;
const EXPORT_NOTE = 'SWL je vzdálený obraz bez CORS přístupu k pixelům. Do zachyceného briefingu se zachová zdroj a čas načtení, nikoli obraz; platnost ověř v záhlaví původní mapy v UTC.';

function instant(value) {
  const at = typeof value === 'function' ? value() : value;
  const ms = typeof at === 'string' ? Date.parse(at) : Number(at);
  if (!Number.isFinite(ms) || ms < 0 || ms > 8.64e15) throw new TypeError('Neplatný čas požadavku na SWL.');
  return ms;
}
function abortCheck(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na SWL byl zrušen.', 'AbortError');
}
const dimensions = item => Number.isInteger(item?.width) && Number.isInteger(item?.height) && item.width >= 100 && item.height >= 100 && item.width <= 4096 && item.height <= 4096;

/** Only this provider-controlled PNG; the optional cache key is a five-minute bucket. */
export function isAllowedSwlImageUrl(value) {
  if (typeof value !== 'string') return false;
  if (value === SWL_IMAGE_URL) return true;
  if (!value.startsWith(`${SWL_IMAGE_URL}?t=`)) return false;
  const key = value.slice(SWL_IMAGE_URL.length + 3);
  return /^\d{1,16}$/.test(key) && Number.isSafeInteger(Number(key)) && Number(key) >= 0 && Number(key) <= 8.64e15 && Number(key) % STEP === 0;
}
export const swlImageUrl = time => `${SWL_IMAGE_URL}?t=${Math.floor(instant(time) / STEP) * STEP}`;

/** No crossorigin attribute or canvas access: success confirms display, not validity. */
export function loadSwlImage(url, { signal, timeoutMs = 12000, ImageClass = globalThis.Image } = {}) {
  abortCheck(signal);
  if (!isAllowedSwlImageUrl(url)) throw new Error('Nepovolený zdroj obrazu SWL.');
  if (typeof ImageClass !== 'function') throw new Error('Prohlížeč nemá podporu načítání obrazu SWL.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new RangeError('Neplatný limit načítání SWL.');
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
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na SWL byl zrušen.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Načítání SWL překročilo časový limit.')), timeoutMs);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(dimensions({ width: image.naturalWidth, height: image.naturalHeight }) ? null : new Error('Obraz SWL nemá očekávané rozměry.'));
    image.onerror = () => finish(new Error('Obraz SWL není dostupný.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.src = url;
  });
}
function base(attemptedAt) {
  return {
    pageUrl: SWL_PAGE_URL, sourceUrl: SWL_IMAGE_URL, documentationUrl: SWL_DOCUMENTATION_URL,
    attribution: 'ČHMÚ · distribuce ŘLP ČR', licenceUrl: 'https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti',
    displayOnly: true, issuedAt: null, validFrom: null, validTo: null, validityStatus: 'unverified',
    timeEvidence: 'image-heading', imagePath: null, imageDataUrl: null,
    attemptedAt, checkedAt: attemptedAt, exportNote: EXPORT_NOTE,
  };
}
/** Confirm a decoded image; never derive issue/validity from the request clock. */
export async function fetchSwl({ previous = null, now = Date.now, signal, loadImage = loadSwlImage, timeoutMs = 12000 } = {}) {
  abortCheck(signal);
  const at = instant(now), attemptedAt = new Date(at).toISOString(), imageUrl = swlImageUrl(at);
  try {
    const loaded = await loadImage(imageUrl, { signal, timeoutMs });
    abortCheck(signal);
    if (!dimensions(loaded)) throw new Error('Obraz SWL nemá očekávané rozměry.');
    return { ...base(attemptedAt), status: 'ok', imageUrl, width: loaded.width, height: loaded.height,
      retrievedAt: new Date(instant(now)).toISOString(), confirmedBy: 'image-load', error: null };
  } catch (error) {
    abortCheck(signal);
    const retrieved = Date.parse(previous?.retrievedAt);
    const key = previous?.imageUrl?.split('?t=')[1];
    if (previous?.confirmedBy === 'image-load' && previous.displayOnly === true && isAllowedSwlImageUrl(previous.imageUrl) &&
      dimensions(previous) && Number.isFinite(retrieved) && retrieved <= at && (!key || Number(key) <= at)) {
      return { ...base(attemptedAt), status: 'stale', imageUrl: previous.imageUrl, width: previous.width, height: previous.height,
        retrievedAt: previous.retrievedAt, confirmedBy: 'image-load', retained: true,
        error: 'Obnova SWL selhala; uveden je čas posledního potvrzeného načtení. Obsah zdrojové adresy se může změnit; platnost ověř v záhlaví mapy.' };
    }
    return { ...base(attemptedAt), status: 'unavailable', imageUrl: null, retrievedAt: null, confirmedBy: null,
      error: 'SWL se nepodařilo načíst. Neznamená to nepřítomnost významného počasí.' };
  }
}

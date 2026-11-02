/**
 * Direct ČHMÚ observed radar images. The provider does not enable CORS for its
 * directory or PNG bytes, but a normal Image can display these public PNGs.
 * A clock-derived candidate is never an observation until its image loads.
 * Invoke lazily when radar is requested; no directory fetch, proxy or collector.
 */
export const RADAR_DIRECTORY = 'https://opendata.chmi.cz/meteorology/weather/radar/composite/pseudocappi2km/png/';
export const RADAR_DOCUMENTATION = 'https://opendata.chmi.cz/meteorology/weather/radar/radar_description_en.pdf';
const STEP = 5 * 60_000;
const LIMIT = 24;
const WINDOW = 2 * 60 * 60_000;
const EXPORT_NOTE = 'Radar se načítá přímo jako vzdálený obraz. Zdroj nepovoluje čtení obrazových dat pomocí CORS; do offline briefingu se zachová jeho čas a odkaz, nikoli vložený snímek.';
const pad = value => String(value).padStart(2, '0');
const stamp = value => new Date(value).toISOString();

function instant(value) {
  const at = typeof value === 'function' ? value() : value;
  const ms = typeof at === 'string' ? Date.parse(at) : Number(at);
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) throw new TypeError('Neplatný čas radarového požadavku.');
  return ms;
}

function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na radar byl zrušen.', 'AbortError');
}

/** Filename timestamps are UTC and denote this documented five-minute product. */
export function radarImageUrl(time) {
  const at = instant(time);
  if (at % STEP !== 0) throw new RangeError('Radarový čas musí odpovídat pětiminutovému UTC kroku.');
  const date = new Date(at);
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  return `${RADAR_DIRECTORY}pacz2gmaps3.z_cappi020.${day}.${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}.0.png`;
}

export function radarCandidates(time, frameLimit = LIMIT) {
  const at = instant(time);
  if (!Number.isInteger(frameLimit) || frameLimit < 1 || frameLimit > LIMIT) throw new RangeError('Radar může načíst 1–24 snímků.');
  const latest = Math.floor(at / STEP) * STEP;
  return Array.from({ length: frameLimit }, (_, index) => latest - index * STEP)
    .filter(value => value > at - WINDOW)
    .map(value => ({ url: radarImageUrl(value), observedAt: stamp(value) }));
}

/** No crossorigin attribute: this is display-only loading, not pixel access. */
export function loadRadarImage(url, { signal, timeoutMs = 8000, ImageClass = globalThis.Image } = {}) {
  checkAbort(signal);
  if (typeof ImageClass !== 'function') throw new Error('Prohlížeč nemá podporu načítání radarového obrazu.');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new RangeError('Neplatný limit načítání radarového snímku.');
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
    const abort = () => finish(signal.reason instanceof Error ? signal.reason : new DOMException('Požadavek na radar byl zrušen.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Načítání radarového snímku překročilo časový limit.')), timeoutMs);
    image.decoding = 'async';
    image.onload = () => finish(Number.isFinite(image.naturalWidth) && image.naturalWidth > 0 && Number.isFinite(image.naturalHeight) && image.naturalHeight > 0 ? null : new Error('Radarový obraz nemá platné rozměry.'));
    image.onerror = () => finish(new Error('Radarový snímek není dostupný.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    image.src = url;
  });
}

function retainedFrames(previous, nowMs) {
  const valid = (Array.isArray(previous?.frames) ? previous.frames : []).filter(frame => {
    const at = Date.parse(frame?.observedAt);
    const confirmedAt = Date.parse(frame?.retrievedAt);
    return frame?.confirmedBy === 'image-load' && Number.isFinite(confirmedAt) && confirmedAt <= nowMs &&
      Number.isFinite(at) && at <= nowMs && at % STEP === 0 && frame.url === radarImageUrl(at);
  });
  return [...new Map(valid.map(frame => [frame.observedAt, frame])).values()]
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).slice(-LIMIT);
}

function common(attemptedAt) {
  return {
    attemptedAt, checkedAt: attemptedAt,
    framesWindowHours: 2,
    bounds: [[48.047, 11.267], [52.167, 20.770]],
    dataBounds: [[48.047, 11.267], [51.458, 19.624]],
    legendUrl: 'https://opendata.chmi.cz/meteorology/weather/radar/scl/scl-dbz-mmh.png',
    sourceUrl: RADAR_DIRECTORY, documentationUrl: RADAR_DOCUMENTATION,
    product: 'PseudoCAPPI_2km',
    measurement: 'Radar reflectivity at 2 km AMSL; observed five-minute composite, not extrapolation',
    attribution: 'ČHMÚ / CZRAD · CC BY 4.0',
    discovery: 'bounded-image-load', displayOnly: true,
    imageDataUrl: null, imageObservedAt: null, imageRetrievedAt: null,
    imageAttemptedAt: attemptedAt, imageFetchStatus: 'unsupported-cors',
    imageError: EXPORT_NOTE, exportNote: EXPORT_NOTE,
  };
}

/**
 * At most two Image requests run concurrently. frameLimit:4 checks the current
 * slot plus 15 minutes of publication lag; default24 loads playback candidates.
 * loadImage resolves only after a successful load, and rejects missing frames.
 * Caller supplies cancellation/deadline and pauses calls while hidden/offline.
 */
export async function fetchRadar({ now = Date.now, signal, loadImage = loadRadarImage, previous = null, frameLimit = LIMIT, timeoutMs = 8000 } = {}) {
  checkAbort(signal);
  const nowMs = instant(now), attemptedAt = stamp(nowMs);
  const candidates = radarCandidates(nowMs, frameLimit);
  const frames = [], missing = [];
  let next = 0;
  async function worker() {
    while (next < candidates.length) {
      checkAbort(signal);
      const frame = candidates[next++];
      try {
        const image = await loadImage(frame.url, { signal, timeoutMs });
        checkAbort(signal);
        if (image === false) throw new Error('Radarový snímek nebyl potvrzen.');
        frames.push({ ...frame, retrievedAt: stamp(instant(now)), confirmedBy: 'image-load' });
      } catch (error) {
        checkAbort(signal);
        missing.push(frame.observedAt);
      }
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: Math.min(2, candidates.length) }, worker));
  checkAbort(signal);
  const rejected = workers.find(result => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  frames.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const base = { ...common(attemptedAt), candidateCount: candidates.length, missingFrames: missing.sort(), coverageComplete: missing.length === 0 };
  if (!frames.length) {
    const retained = retainedFrames(previous, nowMs);
    if (retained.length && Number.isFinite(Date.parse(previous.retrievedAt)) && Date.parse(previous.retrievedAt) <= nowMs) {
      const latest = retained.at(-1);
      return { ...base, status: 'stale', retrievedAt: previous.retrievedAt, observedAt: latest.observedAt, url: latest.url, frames: retained,
        framesFrom: retained[0].observedAt, framesTo: latest.observedAt, retained: true, coverageComplete: false,
        error: 'Obnova radaru selhala; zůstávají dříve potvrzené snímky s původními časy.' };
    }
    return { ...base, status: 'unavailable', retrievedAt: null, observedAt: null, url: null, frames: [], framesFrom: null, framesTo: null,
      error: 'Žádný z kontrolovaných radarových snímků se nepodařilo načíst. Neznamená to nepřítomnost srážek.' };
  }
  const latest = frames.at(-1);
  return { ...base, status: missing.length ? 'partial' : 'ok', retrievedAt: stamp(instant(now)), observedAt: latest.observedAt, url: latest.url, frames,
    framesFrom: frames[0].observedAt, framesTo: latest.observedAt,
    error: missing.length ? `${missing.length} snímků v kontrolovaném intervalu nebylo dostupných; mezery nejsou doplněny.` : null };
}

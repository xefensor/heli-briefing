import { escapeHtml as esc } from './charts.js';
import { haversineKm, formatTime, ageLabel, formatNumber } from './briefing.js';
import { CAMERA_IMAGE_SOURCES, fetchCameraImages, cameraImageInfo, isAllowedCameraImageUrl } from './camera-source.js';
const ids = new Set(['ceske_budejovice', 'churanov', 'kocelovice']);
export const MUNICIPAL_CAMERA = Object.freeze({
  id: 'municipal-radnice',
  name: 'České Budějovice · Radnice',
  provider: 'Statutární město České Budějovice',
  pageUrl: 'https://www.c-budejovice.cz/webove-kamery',
  viewerUrl: 'https://stream.c-budejovice.cz/webkamera-4-radnice.html',
  status: 'online-only',
  observedAt: null,
  captured: false,
  note: 'Samostatný městský pohled; přehrávač tomuto přehledu nepředává samostatný čas snímku. Video se do zachyceného briefingu neukládá.',
});
const browserCameras = CAMERA_IMAGE_SOURCES;

/** Initial state; an actual normal image load must confirm each view. */
export function createBrowserCameras() {
  return {
    schemaVersion: 1, delivery: 'browser-direct', status: 'not-loaded', retrievedAt: null,
    items: browserCameras.map(camera => ({
      ...camera, status: 'not-loaded', reason: 'not-loaded',
      error: 'Obraz kamery zatím nebyl načten.',
      observedAt: null, retrievedAt: null, imageDataUrl: null, attribution: 'ČHMÚ',
    })),
    onlineViewer: { ...MUNICIPAL_CAMERA },
  };
}

export async function fetchBrowserCameras(options = {}) {
  return { ...await fetchCameraImages(options), onlineViewer: { ...MUNICIPAL_CAMERA } };
}

export function validateCameras(data, { captured = false } = {}) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items) || data.items.length > 3 || new Set(data.items.map(item => item.id)).size !== data.items.length) throw new Error('Neplatný kamerový balíček.');
  for (const item of data.items) {
    if (!ids.has(item.id) || !Number.isFinite(item.lat) || Math.abs(item.lat) > 90 || !Number.isFinite(item.lon) || Math.abs(item.lon) > 180) throw new Error('Neznámá kamera.');
    if (item.alternatePageUrl !== undefined && item.alternatePageUrl !== browserCameras.find(camera => camera.id === item.id)?.alternatePageUrl) throw new Error('Neplatný alternativní odkaz kamery.');
    if (item.imageUrl || item.onlineImageUrl || item.displayOnly) {
      const known = browserCameras.find(camera => camera.id === item.id);
      if (data.delivery !== 'browser-direct' || item.displayOnly !== true || item.observedAt !== null || item.imageDataUrl || item.provider !== 'in-pocasi-ventusky' || item.author !== 'ČHMÚ' || item.pageUrl !== known.pageUrl || item.alternatePageUrl !== known.alternatePageUrl || item.mirrorId !== known.mirrorId) throw new Error('Přímá kamera nemá ověřitelný původ nebo předstírá čas či vložený obraz.');
      const url = item.imageUrl || item.onlineImageUrl;
      if (url) {
        const info = cameraImageInfo(url, item.id);
        if (!info || info.variant !== item.variant || info.fileBucketAt !== item.fileBucketAt || item.confirmedBy !== 'image-load' || !Number.isFinite(Date.parse(item.retrievedAt)) || !Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 100 || item.height < 100 || item.width > 4096 || item.height > 4096 || info.fileBucketAt && Date.parse(info.fileBucketAt) > Date.parse(item.retrievedAt)) throw new Error('Neplatný přímý kamerový obraz.');
      }
      if (item.onlineImageUrl && (!isAllowedCameraImageUrl(item.onlineImageUrl, item.id) || item.onlineOnly !== true)) throw new Error('Neplatný online odkaz kamery.');
      if (captured && item.imageUrl) throw new Error('Vzdálená kamera není vložený offline snímek.');
    }
    if (item.imageDataUrl && (!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/\r\n]*={0,2}$/.test(item.imageDataUrl) || item.imageDataUrl.length > 900_000 || !Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 100 || item.height < 100 || item.width > 4096 || item.height > 4096 || !Number.isFinite(Date.parse(item.observedAt)) || !Number.isFinite(Date.parse(item.retrievedAt)))) throw new Error('Kamera nemá ověřitelný snímek a čas.');
  }
  if (data.onlineViewer && (data.onlineViewer.id !== MUNICIPAL_CAMERA.id || data.onlineViewer.viewerUrl !== MUNICIPAL_CAMERA.viewerUrl || data.onlineViewer.pageUrl !== MUNICIPAL_CAMERA.pageUrl || data.onlineViewer.observedAt !== null || data.onlineViewer.captured !== false)) throw new Error('Neplatný odkaz městské kamery.');
  return data;
}
/** Freeze metadata/source links only. A cross-origin Image is not captured bytes. */
export function captureCameras(data) {
  if (!data) return null;
  validateCameras(data);
  const snapshot = structuredClone(data);
  for (const item of snapshot.items) if (item.displayOnly) {
    if (item.imageUrl) { item.onlineImageUrl = item.imageUrl; item.onlineOnly = true; }
    item.imageUrl = null; item.imageDataUrl = null;
  }
  return validateCameras(snapshot, { captured: true });
}
export function cameraState(item, now = Date.now()) {
  if (item?.displayOnly) {
    const url = item.imageUrl || item.onlineImageUrl;
    if (!isAllowedCameraImageUrl(url, item.id) || item.confirmedBy !== 'image-load' || item.status === 'unavailable') return 'unavailable';
    return item.status === 'stale' || now - Date.parse(item.retrievedAt) > 1800000 ? 'stale' : 'unverified';
  }
  if (!item?.imageDataUrl) return 'unavailable';
  const age = now - Date.parse(item.observedAt);
  return age < -300000 ? 'future' : item.status === 'stale' || age > 1800000 ? 'stale' : 'available';
}
export function renderCameras(data, { lat, lon, timezone = 'Europe/Prague', now = Date.now(), error = null, interactive = false } = {}) {
  const items = [...(data?.items || [])].sort((a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon));
  if (data?.delivery === 'browser-direct') {
    const cards = items.map(item => {
      const source = browserCameras.find(camera => camera.id === item.id);
      const alternate = source?.alternatePageUrl ? `<p class="camera-credit"><a href="${esc(source.alternatePageUrl)}" target="_blank" rel="noopener noreferrer">Stejný pohled u In-počasí ↗</a></p>` : '';
      const url = isAllowedCameraImageUrl(item.imageUrl, item.id) ? item.imageUrl : null;
      const online = isAllowedCameraImageUrl(item.onlineImageUrl || url, item.id) ? item.onlineImageUrl || url : null;
      const display = interactive && url && item.confirmedBy === 'image-load' && item.status !== 'unavailable';
      const loaded = Number.isFinite(Date.parse(item.retrievedAt)) ? `${formatTime(item.retrievedAt, timezone, true)} ${timezone === 'UTC' ? 'UTC' : 'CZ'}` : null;
      return `<article class="camera-card${display ? '' : ' source-unavailable'}"><h3>${esc(item.name)} · pohled ${esc(item.direction)}</h3><p>${formatNumber(haversineKm(lat, lon, item.lat, item.lon), 1)} km od vybraného bodu · ${item.lat.toFixed(5)}°, ${item.lon.toFixed(5)}°</p>${display ? `<p class="route-attention">Čas pořízení není ověřen; čti ho v obrazu.${item.status === 'stale' ? ' Obnova selhala.' : ''}</p><p>Poslední potvrzené načtení ${esc(loaded)}${item.variant === 'thumbnail' ? ' · malý náhled' : ''}.</p><button type="button" class="camera-enlarge" data-camera-enlarge="${item.id}" aria-label="Zvětšit kameru ${esc(item.name)}"><img data-camera-image="${item.id}" src="${esc(url)}" width="${item.width}" height="${item.height}" loading="lazy" referrerpolicy="no-referrer" alt="Kamera ČHMÚ ${esc(item.name)}, směr ${esc(item.direction)}; čas čti v obrazu"></button>` : `<p class="route-attention">${online ? 'Pouze online; žádný kamerový obraz nebyl vložen do uloženého briefingu.' : 'Snímek přímo v přehledu není dostupný.'}</p>${loaded ? `<p>Poslední potvrzené načtení ${esc(loaded)}; pořízení a aktuálnost nejsou tímto časem potvrzeny.</p>${item.variant === 'thumbnail' ? '<p>Zdrojový soubor: malý náhled.</p>' : item.fileBucketAt ? `<p>Hodinová složka souboru ${esc(formatTime(item.fileBucketAt, 'UTC', true))} UTC · není čas pořízení.</p>` : ''}` : ''}`}<p class="camera-credit">Autor ČHMÚ · ${item.displayOnly ? 'distribuce In-počasí / Ventusky · ' : ''}<a href="https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. ${display ? 'Obsah zdrojové adresy se může měnit.' : 'Čas snímku a jeho stáří nejsou načteny.'}</p>${item.error ? `<p class="${item.status === 'stale' ? 'feed-error' : 'section-note'}">${esc(item.error)}</p>` : ''}<a href="${esc(source?.pageUrl || 'https://www.chmi.cz/namerena-data/webkamery')}" target="_blank" rel="noopener noreferrer">Otevřít původní kameru ↗</a>${alternate}${!interactive && online ? `<p><a href="${esc(online)}" target="_blank" rel="noopener noreferrer">Online obraz u distributora ↗</a> · po otevření může zobrazovat jiný stav, nejde o zachycený snímek.</p>` : ''}</article>`;
    }).join('');
    const online = !interactive && data.onlineViewer ? `<article class="municipal-camera"><h3>${esc(MUNICIPAL_CAMERA.name)} · městská kamera</h3><p>${esc(MUNICIPAL_CAMERA.note)}</p><p class="route-attention">Pouze online odkaz; žádný snímek videa nebyl zachycen.</p><a href="${MUNICIPAL_CAMERA.viewerUrl}" target="_blank" rel="noopener noreferrer">Otevřít oficiální přehrávač ↗</a> · <a href="${MUNICIPAL_CAMERA.pageUrl}" target="_blank" rel="noopener noreferrer">Zdroj: město České Budějovice ↗</a></article>` : '';
    return `<p class="section-note">ČHMÚ · původní pohledy přes In-počasí / Ventusky. Čas pořízení a stáří nejsou ověřeny; zkontroluj hodiny v obrazu. Kamery mají vlastní čas, nezávislý na vybraném modelu a budoucí předpovědi.</p>${error ? `<p class="feed-error">${esc(error)}</p>` : ''}<div class="camera-grid">${cards}</div>${online}<p class="section-note">Kamera ukazuje jeden pohled, nikoli dohlednost nebo ceiling celé oblasti. Čas načtení ani hodinová složka souboru nejsou časem pořízení. Do offline briefingu se zachytí zdrojové odkazy. Městská kamera je samostatný zdroj.</p>`;
  }
  return `${error ? `<p class="feed-error">${esc(error)}</p>` : ''}<div class="camera-grid">${items.map(item => {
    const state = cameraState(item, now);
    return `<article class="camera-card"><h3>${esc(item.name)} · pohled ${esc(item.direction)}</h3><p>${formatNumber(haversineKm(lat, lon, item.lat, item.lon), 1)} km od vybraného bodu · ${item.lat.toFixed(5)}°, ${item.lon.toFixed(5)}°</p><p class="${state !== 'available' ? 'route-attention' : ''}">${item.observedAt ? `Rámec ${esc(formatTime(item.observedAt, timezone, true))} ${timezone === 'UTC' ? 'UTC' : 'CZ'} · ${esc(ageLabel(item.observedAt, now))}` : 'Čas snímku není dostupný'}${state === 'stale' ? ' · STARŠÍ / OBNOVA NEPOTVRZENA' : state === 'future' ? ' · BUDOUCÍ ČAS' : state === 'unavailable' ? ' · NEDOSTUPNÉ' : ''}</p>${item.imageDataUrl ? `${interactive ? `<button type="button" class="camera-enlarge" data-camera-enlarge="${item.id}" aria-label="Zvětšit kameru ${esc(item.name)}">` : '<div>'}<img data-camera-image="${item.id}" src="${esc(item.imageDataUrl)}" width="${item.width}" height="${item.height}" loading="${interactive ? 'lazy' : 'eager'}" alt="Kamera ${esc(item.name)}, směr ${esc(item.direction)}, inzerovaný rámec ${esc(item.observedAt)}">${interactive ? '</button>' : '</div>'}` : '<p>Snímek není dostupný. Žádný náhradní obraz.</p>'}<p class="camera-credit">ČHMÚ · CC BY 4.0 · ${item.retrievedAt ? `staženo ${esc(formatTime(item.retrievedAt, timezone, true))} ${timezone === 'UTC' ? 'UTC' : 'CZ'}` : 'stažení nepotvrzeno'} · <a href="https://www.chmi.cz/namerena-data/webkamery" target="_blank" rel="noopener noreferrer">Zdroj ↗</a></p></article>`;
  }).join('') || '<p>Kamerový balíček není dostupný.</p>'}</div><p class="section-note">Snímky jsou nezávislé na modelu a vybraném budoucím čase. Čas pochází z časové osy poskytovatele; EXIF není použit. Zachycený snímek se sám neobnovuje. Noční tma, zakrytý výhled nebo fotografie z jednoho místa neurčují dohlednost ani ceiling celé oblasti. <a href="https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti" target="_blank" rel="noopener noreferrer">Podmínky ČHMÚ / CC BY 4.0 ↗</a></p>`;
}
export const CAMERAS_PRINT_CSS = '.camera-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.camera-card{border:1px solid #bbb;padding:12px;break-inside:avoid}.camera-card img{max-width:100%;height:auto}.camera-card p{font-size:12px;line-height:1.5}.camera-card h3{font-size:16px}@media(max-width:650px){.camera-grid{grid-template-columns:1fr}}';

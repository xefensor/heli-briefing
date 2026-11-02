import { escapeHtml as esc } from './charts.js';
import { haversineKm, formatTime, ageLabel, formatNumber } from './briefing.js';
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
const browserCameras = [
  { id: 'ceske_budejovice', name: 'České Budějovice', direction: 'Z', lat: 48.952085, lon: 14.46982, pageUrl: 'https://www.chmi.cz/namerena-data/webkamera/ceske_budejovice-ceske-budejovice' },
  { id: 'churanov', name: 'Churáňov', direction: 'SV', lat: 49.068229, lon: 13.614786, pageUrl: 'https://www.chmi.cz/w/churanov-churanov' },
  { id: 'kocelovice', name: 'Kocelovice', direction: 'S–SZ', lat: 49.467246, lon: 13.837805, pageUrl: 'https://www.chmi.cz/w/kocelovice-kocelovice' },
];

/** Known source capability, not a failed request or a timestamped observation. */
export function createBrowserCameras() {
  return {
    schemaVersion: 1, delivery: 'browser-direct', status: 'unsupported', retrievedAt: null,
    items: browserCameras.map(camera => ({
      ...camera, status: 'unavailable', reason: 'cors',
      error: 'Zdroj nepovoluje přímé čtení snímku z této stránky (CORS).',
      observedAt: null, retrievedAt: null, imageDataUrl: null, attribution: 'ČHMÚ',
    })),
    onlineViewer: { ...MUNICIPAL_CAMERA },
  };
}

export function validateCameras(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items) || data.items.length > 3 || new Set(data.items.map(item => item.id)).size !== data.items.length) throw new Error('Neplatný kamerový balíček.');
  for (const item of data.items) {
    if (!ids.has(item.id) || !Number.isFinite(item.lat) || Math.abs(item.lat) > 90 || !Number.isFinite(item.lon) || Math.abs(item.lon) > 180) throw new Error('Neznámá kamera.');
    if (item.imageDataUrl && (!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/\r\n]*={0,2}$/.test(item.imageDataUrl) || item.imageDataUrl.length > 900_000 || !Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 100 || item.height < 100 || item.width > 4096 || item.height > 4096 || !Number.isFinite(Date.parse(item.observedAt)) || !Number.isFinite(Date.parse(item.retrievedAt)))) throw new Error('Kamera nemá ověřitelný snímek a čas.');
  }
  if (data.onlineViewer && (data.onlineViewer.id !== MUNICIPAL_CAMERA.id || data.onlineViewer.viewerUrl !== MUNICIPAL_CAMERA.viewerUrl || data.onlineViewer.pageUrl !== MUNICIPAL_CAMERA.pageUrl || data.onlineViewer.observedAt !== null || data.onlineViewer.captured !== false)) throw new Error('Neplatný odkaz městské kamery.');
  return data;
}
export function cameraState(item, now = Date.now()) {
  if (!item?.imageDataUrl) return 'unavailable';
  const age = now - Date.parse(item.observedAt);
  return age < -300000 ? 'future' : item.status === 'stale' || age > 1800000 ? 'stale' : 'available';
}
export function renderCameras(data, { lat, lon, timezone = 'Europe/Prague', now = Date.now(), error = null, interactive = false } = {}) {
  const items = [...(data?.items || [])].sort((a, b) => haversineKm(lat, lon, a.lat, a.lon) - haversineKm(lat, lon, b.lat, b.lon));
  if (data?.delivery === 'browser-direct') {
    const cards = items.map(item => `<article class="camera-card source-unavailable"><h3>${esc(item.name)} · pohled ${esc(item.direction)}</h3><p>${formatNumber(haversineKm(lat, lon, item.lat, item.lon), 1)} km od vybraného bodu · ${item.lat.toFixed(5)}°, ${item.lon.toFixed(5)}°</p><p class="route-attention">Snímek přímo v přehledu není dostupný.</p><p>${esc(item.error)}</p><p class="camera-credit">ČHMÚ · čas snímku a jeho stáří nejsou načteny.</p><a href="${esc(browserCameras.find(camera => camera.id === item.id)?.pageUrl || 'https://www.chmi.cz/namerena-data/webkamery')}" target="_blank" rel="noopener noreferrer">Otevřít původní kameru ↗</a></article>`).join('');
    const online = !interactive && data.onlineViewer ? `<article class="municipal-camera"><h3>${esc(MUNICIPAL_CAMERA.name)} · městská kamera</h3><p>${esc(MUNICIPAL_CAMERA.note)}</p><p class="route-attention">Pouze online odkaz; žádný snímek videa nebyl zachycen.</p><a href="${MUNICIPAL_CAMERA.viewerUrl}" target="_blank" rel="noopener noreferrer">Otevřít oficiální přehrávač ↗</a> · <a href="${MUNICIPAL_CAMERA.pageUrl}" target="_blank" rel="noopener noreferrer">Zdroj: město České Budějovice ↗</a></article>` : '';
    return `<p class="section-note">Původní kamery ČHMÚ se v tomto přehledu nenačítají. Aktuální obraz otevřeš přímo u zdroje.</p><div class="camera-grid">${cards}</div>${online}<p class="section-note">Kamera ukazuje jedno místo a směr pohledu; neurčuje dohlednost ani ceiling celé oblasti. Městský pohled je samostatný zdroj, nikoli náhrada některé z kamer ČHMÚ.</p>`;
  }
  return `${error ? `<p class="feed-error">${esc(error)}</p>` : ''}<div class="camera-grid">${items.map(item => {
    const state = cameraState(item, now);
    return `<article class="camera-card"><h3>${esc(item.name)} · pohled ${esc(item.direction)}</h3><p>${formatNumber(haversineKm(lat, lon, item.lat, item.lon), 1)} km od vybraného bodu · ${item.lat.toFixed(5)}°, ${item.lon.toFixed(5)}°</p><p class="${state !== 'available' ? 'route-attention' : ''}">${item.observedAt ? `Rámec ${esc(formatTime(item.observedAt, timezone, true))} ${timezone === 'UTC' ? 'UTC' : 'CZ'} · ${esc(ageLabel(item.observedAt, now))}` : 'Čas snímku není dostupný'}${state === 'stale' ? ' · STARŠÍ / OBNOVA NEPOTVRZENA' : state === 'future' ? ' · BUDOUCÍ ČAS' : state === 'unavailable' ? ' · NEDOSTUPNÉ' : ''}</p>${item.imageDataUrl ? `${interactive ? `<button type="button" class="camera-enlarge" data-camera-enlarge="${item.id}" aria-label="Zvětšit kameru ${esc(item.name)}">` : '<div>'}<img data-camera-image="${item.id}" src="${esc(item.imageDataUrl)}" width="${item.width}" height="${item.height}" loading="${interactive ? 'lazy' : 'eager'}" alt="Kamera ${esc(item.name)}, směr ${esc(item.direction)}, inzerovaný rámec ${esc(item.observedAt)}">${interactive ? '</button>' : '</div>'}` : '<p>Snímek není dostupný. Žádný náhradní obraz.</p>'}<p class="camera-credit">ČHMÚ · CC BY 4.0 · ${item.retrievedAt ? `staženo ${esc(formatTime(item.retrievedAt, timezone, true))} ${timezone === 'UTC' ? 'UTC' : 'CZ'}` : 'stažení nepotvrzeno'} · <a href="https://www.chmi.cz/namerena-data/webkamery" target="_blank" rel="noopener noreferrer">Zdroj ↗</a></p></article>`;
  }).join('') || '<p>Kamerový balíček není dostupný.</p>'}</div><p class="section-note">Snímky jsou nezávislé na modelu a vybraném budoucím čase. Čas pochází z časové osy poskytovatele; EXIF není použit. Zachycený snímek se sám neobnovuje. Noční tma, zakrytý výhled nebo fotografie z jednoho místa neurčují dohlednost ani ceiling celé oblasti. <a href="https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti" target="_blank" rel="noopener noreferrer">Podmínky ČHMÚ / CC BY 4.0 ↗</a></p>`;
}
export const CAMERAS_PRINT_CSS = '.camera-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.camera-card{border:1px solid #bbb;padding:12px;break-inside:avoid}.camera-card img{max-width:100%;height:auto}.camera-card p{font-size:12px;line-height:1.5}.camera-card h3{font-size:16px}@media(max-width:650px){.camera-grid{grid-template-columns:1fr}}';

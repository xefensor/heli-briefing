import { escapeHtml as esc } from './charts.js';
import { formatTime } from './briefing.js';
const pathPattern = /^\.\/data\/charts\/(?:swl|lowcloud)-\d{12}-[a-f0-9]{12}\.png$/;
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const stamp = (value, zone) => validTime(value) ? `${formatTime(value, zone, true)} ${zone === 'UTC' ? 'UTC' : 'CZ'}` : 'čas neposkytnut';
export function validateCharts(data, { captured = false } = {}) {
  if (!data || data.schemaVersion !== 1 || !data.swl || !data.lowCloud || !Array.isArray(data.lowCloud.frames || []) || (data.lowCloud.frames || []).length > 32) throw new Error('Neplatný balíček leteckých map.');
  for (const item of [data.swl, ...(data.lowCloud.frames || []), data.selectedLow].filter(Boolean)) {
    if (item.imagePath && !pathPattern.test(item.imagePath)) throw new Error('Neplatná cesta snímku mapy.');
    if (item.imageDataUrl && (!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(item.imageDataUrl) || item.imageDataUrl.length > 2_700_000)) throw new Error('Neplatný PNG mapy.');
    if ((item.imagePath || item.imageDataUrl) && (!Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 100 || item.height < 100 || item.width > 4096 || item.height > 4096 || !validTime(item.retrievedAt))) throw new Error('Neplatné rozměry nebo stažení mapy.');
    if (captured && item.imagePath && !item.imageDataUrl) throw new Error('Zachycená mapa vyžaduje vložený obraz.');
  }
  if ((data.swl.imagePath || data.swl.imageDataUrl) && (!validTime(data.swl.issuedAt) || !validTime(data.swl.validFrom) || !validTime(data.swl.validTo) || Date.parse(data.swl.validTo) <= Date.parse(data.swl.validFrom))) throw new Error('SWL nemá platný interval.');
  if ((data.lowCloud.frames || []).some((item, index, frames) => !validTime(item.validAt) || index && Date.parse(item.validAt) <= Date.parse(frames[index - 1].validAt)) || data.selectedLow && !validTime(data.selectedLow.validAt)) throw new Error('Nízká oblačnost nemá platné časy.');
  return data;
}
export function selectedLowCloud(data, time) {
  const frames = data?.lowCloud?.frames || [], instant = Date.parse(time);
  if (!frames.length || !Number.isFinite(instant) || instant < Date.parse(frames[0].validAt) || instant > Date.parse(frames.at(-1).validAt)) return null;
  const selected = frames.reduce((best, frame) => Math.abs(Date.parse(frame.validAt) - instant) < Math.abs(Date.parse(best.validAt) - instant) ? frame : best);
  return Math.abs(Date.parse(selected.validAt) - instant) <= 90 * 60000 ? selected : null;
}
export function imagePosition(lat, lon) {
  const [west, south, east, north] = [10.5, 47.766666666667, 20.316666666667, 51.366666666667];
  if (lat < south || lat > north || lon < west || lon > east) return null;
  const m = angle => Math.log(Math.tan(Math.PI / 4 + angle * Math.PI / 360));
  return { left: (lon - west) / (east - west) * 100, top: (m(north) - m(lat)) / (m(north) - m(south)) * 100 };
}
function geography(lat, lon) {
  const places = [['Praha',50.10,14.26],['Č. Budějovice',48.95,14.43],['Brno',49.20,16.61]];
  const point = imagePosition(lat,lon);
  return places.map(([name,latitude,longitude])=>{const p=imagePosition(latitude,longitude);return `<span class="map-place-label" style="left:${p.left.toFixed(3)}%;top:${p.top.toFixed(3)}%">${name}</span>`;}).join('')+(point?`<span class="lowcloud-point" style="left:${point.left.toFixed(3)}%;top:${point.top.toFixed(3)}%" title="Vybraný bod">+</span>`:'');
}
export function renderAviationCharts(data, { time, timezone = 'Europe/Prague', lat, lon, error = null, interactive = false, imageErrors = new Set() } = {}) {
  const swl = data?.swl, low = data?.selectedLow || selectedLowCloud(data, time), current = Date.parse(time), swlValid = swl && current >= Date.parse(swl.validFrom) && current < Date.parse(swl.validTo);
  const image = (item, alt, key) => item && (item.imageDataUrl || item.imagePath) && !imageErrors.has(item.imagePath) ? `<div class="aviation-chart-image"><img src="${esc(item.imageDataUrl || item.imagePath)}" data-chart-path="${esc(item.imagePath || '')}" width="${item.width}" height="${item.height}" loading="${interactive ? 'lazy' : 'eager'}" alt="${alt}">${key === 'lowCloud' ? geography(lat,lon) : ''}</div>${interactive ? `<button type="button" class="button button-quiet" data-chart-enlarge="${key}">Zvětšit původní mapu</button>` : ''}` : '<p class="route-attention">Snímek není dostupný. Platný čas sám nepotvrzuje načtení obrazu.</p>';
  const point = imagePosition(lat, lon);
  return `${error ? `<p class="feed-error">Obnova map nebyla potvrzena: ${esc(error)}</p>` : ''}<article class="aviation-chart"><h3>SWL · významné počasí mezi zemí a FL100</h3><p class="${swlValid ? 'section-note' : 'route-attention'}">Platnost ${esc(stamp(swl?.validFrom, timezone))} – ${esc(stamp(swl?.validTo, timezone))}${swlValid ? '' : ' · MAPA NEPOKRÝVÁ VYBRANÝ ČAS'}${swl?.status === 'stale' ? ' · STARŠÍ / OBNOVA SELHALA' : ''}</p><p class="section-note">Vydáno ${esc(stamp(swl?.issuedAt, timezone))} · staženo ${esc(stamp(swl?.retrievedAt, timezone))}. Všechny časy uvnitř původní mapy jsou UTC.</p>${image(swl, 'Původní SWL mapa ČHMÚ se zdrojovou legendou a časem', 'swl')}<p class="section-note">Výšky oblačnosti a hladina mrazu podle legendy v hFT AMSL (stovky stop nad mořem). Čti původní legendu, platnost a aktuální SIGMET.</p><a href="https://www.chmi.cz/letectvi/predpovedi-pro-letani/swl-mapa" target="_blank" rel="noopener noreferrer">Původní SWL a legenda ↗</a></article><article class="aviation-chart"><h3>Nízká oblačnost · ČHMÚ</h3><p class="${low?.imagePath || low?.imageDataUrl ? 'section-note' : 'route-attention'}">${low ? `Mapa pro ${esc(stamp(low.validAt, timezone))}` : 'Pro vybraný čas není mapa ve sběru dostupná.'}${data?.lowCloud?.status === 'stale' || low?.status === 'stale' ? ' · STARŠÍ / OBNOVA SELHALA' : ''}</p><p class="section-note">Nejbližší skutečný tříhodinový rámec; není přepočítán na přesný čas přehledu. Čas vydání není poskytován a není nahrazen stažením.</p><div class="lowcloud-geography">${image(low, 'Původní předpověď nízké oblačnosti ČHMÚ', 'lowCloud')}</div>${interactive ? '<button class="button button-quiet" type="button" id="lowcloud-map" aria-pressed="false">Nízká oblačnost v regionální mapě</button>' : ''}<p class="section-note">Výřez 10,5–20,3167° E / 47,7667–51,3667° N, Mercator. Zdroj ukazuje BKN/OVC s výškami základny ve stovkách ft AMSL; SKC/FEW/SCT podle legendy. Jde o samostatný produkt ČHMÚ, nikoli ceiling z vybraného modelu.</p><a href="https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti" target="_blank" rel="noopener noreferrer">Původní mapa a vysvětlení ↗</a></article><p class="section-note">Zdroj: Český hydrometeorologický ústav (ČHMÚ), <a href="https://www.chmi.cz/vylou%C4%8Den%C3%AD-odpov%C4%9Bdnosti" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Produkty zachovávají vlastní platnost a autora při změně hlavního modelu.</p>`;
}

export async function captureCharts(data, time, { fetcher = (...args) => fetch(...args) } = {}) {
  if (!data) return null;
  const snapshot = structuredClone(data), low = selectedLowCloud(data, time);
  snapshot.lowCloud = { ...snapshot.lowCloud, frames: [] }; snapshot.selectedLow = low ? structuredClone(low) : null;
  for (const item of [snapshot.swl, snapshot.selectedLow].filter(Boolean)) {
    if (!item.imagePath) continue;
    try {
      if (!pathPattern.test(item.imagePath)) throw new Error('Neplatná cesta');
      const response = await fetcher(item.imagePath, { signal: AbortSignal.timeout(18000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 24 || bytes.length > 2000000 || [137,80,78,71,13,10,26,10].some((value,index) => bytes[index] !== value)) throw new Error('Neplatný PNG');
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (header.getUint32(16) !== item.width || header.getUint32(20) !== item.height) throw new Error('Rozměry PNG neodpovídají metadatům');
      let binary = ''; for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      item.imageDataUrl = `data:image/png;base64,${btoa(binary)}`;
    } catch (failure) { item.status = 'unavailable'; item.error = 'Obraz nebyl zachycen do briefingu.'; item.imagePath = null; }
  }
  return snapshot;
}
export const CHARTS_PRINT_CSS = '.aviation-chart{margin:22px 0}.aviation-chart-image{position:relative}.aviation-chart-image img{display:block;width:100%;height:auto}.lowcloud-geography{position:relative}.map-place-label{position:absolute;background:#fff9;color:#192d3d;font:11px sans-serif}.lowcloud-point{position:absolute;font:bold 24px sans-serif;color:#e24130;transform:translate(-50%,-50%)}';

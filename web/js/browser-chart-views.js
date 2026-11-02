import { escapeHtml as esc } from './charts.js';
import { formatTime } from './briefing.js';
import { LOW_CLOUD_FRAME_BASE } from './lowcloud-file-source.js';
import { SIGMET_IMAGE_URL, SIGMET_DOCUMENTATION_URL } from './sigmet-image-source.js';

const LOW_PAGE = 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti';
const stamp = (time, zone) => time && Number.isFinite(Date.parse(time)) ? `${formatTime(time, zone, true)} ${zone === 'UTC' ? 'UTC' : 'CZ'}` : 'čas neposkytnut';
export const chartImageKey = item => item?.id || item?.imagePath || item?.sourceUrl || '';

/** This independently distributed graphic never changes structured warning coverage. */
export function renderSigmetChart(item, { interactive = false, timezone = 'Europe/Prague', imageErrors = new Set() } = {}) {
  if (!item) return interactive ? '<article class="aviation-chart" id="sigmet-image-panel"><h3>SIGMET / AIREP · mapa ŘLP</h3><p class="section-note">Načítám samostatnou zdrojovou mapu. Úplnost výstrah není tímto načtením ověřena.</p></article>' : '';
  const shown = interactive && item.imageUrl && !imageErrors.has(item.imageUrl);
  return `<article class="aviation-chart${shown ? '' : ' source-unavailable'}" id="sigmet-image-panel"><h3>SIGMET / AIREP · mapa ŘLP</h3>
    <p class="route-attention">Samostatná zdrojová mapa. Čas aktualizace čti v jejím záhlaví v UTC; není svázána s časem přehledu. Úplnost výstrah není tímto přehledem ověřena.</p>
    ${item.retrievedAt ? `<p class="section-note">Poslední potvrzené načtení ${esc(stamp(item.retrievedAt, timezone))}${item.status === 'stale' ? ' · obnova selhala' : ''}. Nejde o čas vydání ani platnost.</p>` : ''}
    ${shown ? `<div class="aviation-chart-image"><img src="${esc(item.imageUrl)}" data-chart-path="${esc(item.imageUrl)}" width="${item.width}" height="${item.height}" loading="lazy" referrerpolicy="no-referrer" alt="Mapa SIGMET a AIREP distribuovaná ŘLP; čas aktualizace a rozsah čti v původním obrazu"></div><button type="button" class="button button-quiet" data-chart-enlarge="sigmet">Zvětšit mapu SIGMET / AIREP</button>` : `<p class="section-note">${item.onlineOnly ? 'Pouze online · obraz nebyl vložen do zachyceného briefingu.' : 'Obraz se zatím nepodařilo načíst.'}</p>`}
    ${item.error ? `<p class="feed-error">${esc(item.error)}</p>` : ''}
    <p class="section-note">ŘLP ČR · meteorologická data ČHMÚ. Prázdná mapa ani úspěšné načtení nepotvrzují nepřítomnost výstrah. Do offline výstupu patří odkaz a metadata načtení.</p>
    <p><a href="${esc(item.onlineImageUrl || item.imageUrl || SIGMET_IMAGE_URL)}" target="_blank" rel="noopener noreferrer">Původní mapa SIGMET / AIREP ↗</a> · <a href="${SIGMET_DOCUMENTATION_URL}" target="_blank" rel="noopener noreferrer">Vysvětlivky ŘLP ↗</a></p></article>`;
}

/** Optional local attachment: file name is a user-supplied time claim, not verified publication metadata. */
export function renderBrowserLowCloud(data, frame, { interactive = false, time, timezone = 'Europe/Prague', imageErrors = new Set() } = {}) {
  const at = Date.parse(time), step = 3 * 3600000;
  const slot = Number.isFinite(at) ? new Date(Math.ceil(at / step - 0.5) * step).toISOString() : null;
  const reference = slot?.slice(0,16).replace(/[-T:]/g, '');
  const sourceLink = reference ? `${LOW_CLOUD_FRAME_BASE}${reference}` : null;
  const manual = data?.delivery === 'local-file';
  const shown = manual && frame?.imageDataUrl && !imageErrors.has(chartImageKey(frame));
  return `<article class="aviation-chart${shown ? '' : ' source-unavailable'}"><h3>Nízká oblačnost · ČHMÚ</h3>
    ${manual ? `<p class="route-attention" id="lowcloud-browser-note">Místní soubor · automaticky se neobnovuje. Platnost z názvu souboru není nezávisle ověřena.</p><p class="section-note">Importováno ${esc(stamp(frame?.importedAt || data.importedAt, timezone))}. Vydání, běh a původní čas stažení nejsou známy.</p>` : `<p class="route-attention" id="lowcloud-browser-note">Automatické načtení původní mapy není dostupné.</p><p>${esc(data?.error || 'Zdroj nepovoluje přímé čtení z tohoto přehledu (CORS).')}</p>`}
    ${frame ? `<p class="section-note">Uživatelem dodaný soubor ${esc(frame.originalFileName)} · uvedený rámec ${esc(stamp(frame.validAt, timezone))}. Nejde o předpověď přepočítanou na přesný čas přehledu.</p>` : manual ? '<p class="route-attention">Pro vybraný čas není mezi importovanými soubory mapa. Jiná hodina ji nenahrazuje.</p>' : ''}
    ${shown ? `<div class="lowcloud-geography aviation-chart-image"><img src="${esc(frame.imageDataUrl)}" data-chart-path="${esc(chartImageKey(frame))}" width="${frame.width}" height="${frame.height}" loading="${interactive ? 'lazy' : 'eager'}" alt="Místně importovaná mapa nízké oblačnosti ČHMÚ; čas vychází z neověřeného názvu souboru"></div>${interactive ? '<button type="button" class="button button-quiet" data-chart-enlarge="lowCloud">Zvětšit importovanou mapu</button>' : ''}` : ''}
    <p class="section-note">Původní produkt zobrazuje BKN / OVC a výšky základny v hft AMSL (stovkách stop nad mořem), do 70 hft. Bílá: OVC · šedá: BKN · tmavá: SKC / FEW / SCT. Samostatný produkt, nikoli ceiling vybraného modelu.</p>
    ${interactive ? `<div class="local-source-actions"><button class="button button-quiet" type="button" id="lowcloud-import">${manual ? 'Přidat / nahradit soubory' : 'Načíst stažený soubor ČHMÚ'}</button><button class="button button-quiet" type="button" id="lowcloud-map" aria-pressed="false" aria-describedby="lowcloud-browser-note"${shown ? '' : ' disabled'}>Importovaná mapa v regionu</button>${manual ? '<button class="button button-quiet" type="button" id="lowcloud-clear">Odebrat místní mapy</button>' : ''}</div><p class="section-note">${sourceLink ? `Volitelný postup: <a href="${esc(sourceLink)}" target="_blank" rel="noopener noreferrer">otevři data ČHMÚ pro ${esc(stamp(slot, timezone))} ↗</a> a ulož je (Ctrl+S) pod názvem <code>${reference}</code>, případně s .json. Dostupnost termínu není předem ověřena. Pak načti soubor zde.` : 'Načti původní soubor pod názvem YYYYMMDDHHMM, případně s .json / .png.'} Obsah zůstane v prohlížeči; do briefingu se zachytí jen zvolený rámec.</p>` : ''}
    ${data?.importError ? `<p class="feed-error" role="status">${esc(data.importError)}</p>` : ''}
    <p><a href="${LOW_PAGE}" target="_blank" rel="noopener noreferrer">Původní mapa a vysvětlení ↗</a>${frame?.sourceUrl ? ` · <a href="${esc(frame.sourceUrl)}" target="_blank" rel="noopener noreferrer">Datový soubor uvedeného rámce ↗</a>` : ''}</p>
    <p class="section-note">ČHMÚ · CC BY 4.0 · místní soubor vybral uživatel; přehled neověřuje jeho původ.</p>
    ${interactive ? '<p><a href="#clouds-panel">Samostatný automatický regionální ICON-EU CEILING ↓</a> · jiný produkt, metry MSL</p>' : ''}</article>`;
}

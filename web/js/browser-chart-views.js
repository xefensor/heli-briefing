import { escapeHtml as esc } from './charts.js';
import { formatTime } from './briefing.js';
import { LOW_CLOUD_FRAME_BASE } from './lowcloud-file-source.js';
import { SIGMET_IMAGE_URL, SIGMET_DOCUMENTATION_URL } from './sigmet-image-source.js';

const LOW_PAGE = 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti';
const stamp = (time, zone) => time && Number.isFinite(Date.parse(time)) ? `${formatTime(time, zone, true)} ${zone === 'UTC' ? 'UTC' : 'CZ'}` : 'čas neposkytnut';
const detail = (key, title, body, interactive) => `<details class="source-detail" data-source-detail="${key}"${interactive ? '' : ' open'}><summary>${title}</summary><div class="source-detail-body">${body}</div></details>`;
export const chartImageKey = item => item?.id || item?.imagePath || item?.sourceUrl || '';

/** This independently distributed graphic never changes structured warning coverage. */
export function renderSigmetChart(item, { interactive = false, timezone = 'Europe/Prague', imageErrors = new Set() } = {}) {
  if (!item) return interactive ? '<article class="aviation-chart source-workspace" id="sigmet-image-panel"><header class="source-product-header"><div><h3>SIGMET / AIREP</h3><p class="source-product-origin">ŘLP · meteorologická data ČHMÚ</p></div></header><p class="source-status route-attention">Načítám zdrojovou mapu. Úplnost výstrah není tímto načtením ověřena.</p></article>' : '';
  const shown = interactive && item.imageUrl && !imageErrors.has(item.imageUrl);
  return `<article class="aviation-chart source-workspace${shown ? '' : ' source-unavailable'}" id="sigmet-image-panel">
    <header class="source-product-header"><div><h3>SIGMET / AIREP</h3><p class="source-product-origin">ŘLP · meteorologická data ČHMÚ</p></div><a class="source-product-link" href="${esc(item.onlineImageUrl || item.imageUrl || SIGMET_IMAGE_URL)}" target="_blank" rel="noopener noreferrer">Původní mapa ↗</a></header>
    <p class="source-status route-attention"><strong>Čas aktualizace: záhlaví mapy v UTC.</strong> Není svázán s časem přehledu. Úplnost výstrah není ověřena; prázdná mapa nepotvrzuje jejich nepřítomnost.</p>
    ${item.retrievedAt ? `<p class="source-image-clock">Poslední potvrzené načtení <strong>${esc(stamp(item.retrievedAt, timezone))}</strong>${item.status === 'stale' ? ' · <strong class="source-clock-warning">obnova selhala</strong>' : ''}. Nejde o čas vydání ani platnost.</p>` : ''}
    ${shown ? `<div class="aviation-chart-image"><img src="${esc(item.imageUrl)}" data-chart-path="${esc(item.imageUrl)}" width="${item.width}" height="${item.height}" loading="lazy" referrerpolicy="no-referrer" alt="Mapa SIGMET a AIREP distribuovaná ŘLP; čas aktualizace a rozsah čti v původním obrazu"></div>` : `<p class="source-empty">${item.onlineOnly ? 'Pouze online · obraz nebyl vložen do zachyceného briefingu.' : 'Obraz se zatím nepodařilo načíst.'}</p>`}
    ${item.error ? `<p class="feed-error">${esc(item.error)}</p>` : ''}
    <div class="source-product-actions">${shown ? '<button type="button" class="button button-quiet" data-chart-enlarge="sigmet">Zvětšit mapu</button>' : ''}<a href="${SIGMET_DOCUMENTATION_URL}" target="_blank" rel="noopener noreferrer">Vysvětlivky ŘLP ↗</a></div>
    ${detail('sigmet-image-detail', 'Časy, pokrytí a offline výstup', '<p>Úspěšné načtení potvrzuje pouze zobrazení obrazu; nevytváří vydání ani platnost a nemění úplnost strukturovaného inventáře SIGMET. Rozsah a aktualizaci ověř v původní mapě.</p><p>Do offline výstupu patří odkaz a metadata načtení. Vzdálený obraz se automaticky nevkládá; jeho obsah se může na stejné adrese měnit.</p>', interactive)}
  </article>`;
}

/** Optional local attachment: file name is a user-supplied time claim, not verified publication metadata. */
export function renderBrowserLowCloud(data, frame, { interactive = false, time, timezone = 'Europe/Prague', imageErrors = new Set() } = {}) {
  const at = Date.parse(time), step = 3 * 3600000;
  const slot = Number.isFinite(at) ? new Date(Math.ceil(at / step - 0.5) * step).toISOString() : null;
  const reference = slot?.slice(0, 16).replace(/[-T:]/g, '');
  const sourceLink = reference ? `${LOW_CLOUD_FRAME_BASE}${reference}` : null;
  const manual = data?.delivery === 'local-file';
  const shown = manual && frame?.imageDataUrl && !imageErrors.has(chartImageKey(frame));
  const importHelp = `${sourceLink ? `<ol><li><a href="${esc(sourceLink)}" target="_blank" rel="noopener noreferrer">Otevři data ČHMÚ pro ${esc(stamp(slot, timezone))} ↗</a>. Dostupnost termínu není předem ověřena.</li><li>Ulož soubor (Ctrl+S) pod názvem <code>${reference}</code>, případně s <code>.json</code>.</li><li>Použij tlačítko „Načíst stažený soubor ČHMÚ“.</li></ol>` : '<p>Načti původní soubor pod názvem YYYYMMDDHHMM, případně s .json / .png.</p>'}<p>Obsah zůstane v prohlížeči; do briefingu se zachytí jen zvolený rámec. Místní soubory se samy neobnovují.</p>${!manual && data?.error ? `<p>Důvod nedostupnosti přímého načtení: ${esc(data.error)}</p>` : ''}`;
  return `<article class="aviation-chart source-workspace${shown ? '' : ' source-unavailable'}">
    <header class="source-product-header"><div><h3>Nízká oblačnost</h3><p class="source-product-origin">ČHMÚ · samostatná mapa · hft AMSL</p></div><a class="source-product-link" href="${LOW_PAGE}" target="_blank" rel="noopener noreferrer">Původní mapa a vysvětlení ↗</a></header>
    ${manual ? `<p class="source-status route-attention" id="lowcloud-browser-note"><strong>Místní soubor · automaticky se neobnovuje.</strong> Platnost z názvu souboru není nezávisle ověřena.</p>` : '<p class="source-status route-attention" id="lowcloud-browser-note"><strong>Automatické načtení původní mapy není dostupné.</strong> Lze přidat stažený soubor ČHMÚ.</p>'}
    ${frame ? `<dl class="source-time-grid source-file-clock"><div><dt>Uvedený rámec · neověřeno</dt><dd>${esc(stamp(frame.validAt, timezone))}</dd></div><div><dt>Místní import</dt><dd>${esc(stamp(frame.importedAt || data?.importedAt, timezone))}</dd></div></dl>` : manual ? '<p class="source-status route-attention">Pro vybraný čas není mezi importovanými soubory mapa. Jiná hodina ji nenahrazuje.</p>' : ''}
    <p class="source-reference"><strong>BKN / OVC · základny v hft AMSL</strong> (stovkách stop nad mořem), do 70 hft. Samostatný produkt, nikoli ceiling vybraného modelu.</p>
    ${shown ? `<div class="lowcloud-geography aviation-chart-image"><img src="${esc(frame.imageDataUrl)}" data-chart-path="${esc(chartImageKey(frame))}" width="${frame.width}" height="${frame.height}" loading="${interactive ? 'lazy' : 'eager'}" alt="Místně importovaná mapa nízké oblačnosti ČHMÚ; čas vychází z neověřeného názvu souboru"></div><div class="source-map-key"><span><i class="lowcloud-key-ovc"></i>Bílá: OVC</span><span><i class="lowcloud-key-bkn"></i>Šedá: BKN</span><span><i class="lowcloud-key-skc"></i>Tmavá: SKC / FEW / SCT</span></div>` : frame ? '<p class="source-empty">Importovaný obraz se v tomto zobrazení nepodařilo načíst.</p>' : ''}
    ${interactive ? `<div class="local-source-actions source-product-actions">${shown ? '<button type="button" class="button button-quiet" data-chart-enlarge="lowCloud">Zvětšit mapu</button>' : ''}<button class="button button-quiet" type="button" id="lowcloud-import">${manual ? 'Přidat / nahradit soubory' : 'Načíst stažený soubor ČHMÚ'}</button><button class="button button-quiet" type="button" id="lowcloud-map" aria-pressed="false" aria-describedby="lowcloud-browser-note"${shown ? '' : ' disabled'}>Mapa v regionu</button>${manual ? '<button class="button button-quiet" type="button" id="lowcloud-clear">Odebrat místní mapy</button>' : ''}</div>${detail('lowcloud-import-help', 'Jak získat a načíst soubor ČHMÚ', importHelp, true)}` : ''}
    ${data?.importError ? `<p class="feed-error" role="status">${esc(data.importError)}</p>` : ''}
    ${manual ? detail('lowcloud-file-detail', 'Původ souboru a neznámé časy', `${frame ? `<p>Uživatelem dodaný soubor <code>${esc(frame.originalFileName)}</code> · importováno ${esc(stamp(frame.importedAt || data?.importedAt, timezone))}.</p>` : `<p>Importováno ${esc(stamp(data?.importedAt, timezone))}.</p>`}<p>Vydání, běh a původní čas stažení nejsou známy. Uvedený rámec pochází z názvu souboru; nejde o předpověď přepočítanou na přesný čas přehledu. Přehled neověřuje původ místního souboru.</p>${frame?.sourceUrl ? `<p><a href="${esc(frame.sourceUrl)}" target="_blank" rel="noopener noreferrer">Datový soubor uvedeného rámce ↗</a></p>` : ''}`, interactive) : !interactive && data?.error ? `<p class="source-visual-note">${esc(data.error)}</p>` : ''}
    <p class="source-credit">ČHMÚ · CC BY 4.0${manual ? ' · místní soubor vybral uživatel; přehled neověřuje jeho původ' : ''}.</p>
    ${interactive ? '<p class="source-visual-note"><a href="#clouds-panel">Automatický ICON-EU CEILING ↓</a> · jiný produkt, metry MSL.</p>' : ''}
  </article>`;
}

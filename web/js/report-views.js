import { summarizeMetar, summarizeTaf, formatReportSummary } from './reports.js';
import { formatTime, formatNumber } from './briefing.js';
import { escapeHtml as esc } from './charts.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const measurement = (value) => formatNumber(value, Number.isInteger(value) ? 0 : 1);
const zoneLabel = (timezone) => timezone === 'UTC' ? 'UTC' : 'CZ';
const SHARED_TAF_NOTES = new Set([
  'Změnové skupiny zobrazují pouze výslovně uvedené položky. Neuvedené podmínky zde nejsou doplňovány; pro jejich návaznost čti celý TAF.',
  'BECMG označuje okno postupné změny, nikoli okamžik přepnutí; toto zobrazení nepočítá výsledný stav po skončení přechodu.',
]);
const TAF_GUIDANCE = 'Chybějící položky nejsou doplněny z předchozí skupiny; pro návaznost čti celý TAF. BECMG je okno postupné změny, nikoli okamžik přepnutí; výsledný stav po něm zde není dopočítán. TEMPO / PROB nejsou nepřetržitý jistý stav.';

function warningList(warnings) {
  return warnings.length ? `<ul class="report-warnings">${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul>` : '';
}

/** One visible reading key; longer definitions are secondary to the reports. */
export function renderReportGuide() {
  return `<div class="report-guide"><p class="report-guide-key"><span><strong>METAR</strong> pozorování letiště · výšky <strong>ft AGL nad letištěm</strong>.</span><span><strong>TAF</strong> jen uvedené položky · BECMG je okno změny, TEMPO přechodně, PROB pravděpodobnost.</span><span><strong>Originál zachovává UTC.</strong></span></p><p class="print-only report-guide-print-note">Ceiling METAR je nad letištěm, nikoli nad vybraným bodem. CAVOK není neomezená ani změřená výška ceilingu. ${TAF_GUIDANCE}</p><details class="report-guide-details" data-source-detail="report-interpretation-guide"><summary>Jak číst ceiling a změny TAF</summary><div class="report-guide-content"><p><strong>Pozorovaný ceiling.</strong> Nejnižší uvedená BKN/OVC nebo vertikální dohlednost VV, ve ft AGL nad letištěm. Není to výška nad vybraným bodem. CAVOK není neomezená ani změřená výška ceilingu.</p><p><strong>Výklad TAF.</strong> ${TAF_GUIDANCE}</p></div></details></div>`;
}

function ceilingText(summary) {
  const ceiling = summary.ceiling;
  if (ceiling.status === 'reported') return `${formatNumber(ceiling.valueFtAgl)} ft AGL${summary.clouds.some((cloud) => cloud.verticalVisibility) ? ' · VV' : ''}`;
  if (ceiling.status === 'cavok') return 'CAVOK · výška není číselně uvedena';
  if (ceiling.status === 'not-reported') return 'BKN / OVC / VV neuvedeno';
  return 'Výška neznámá';
}
function windText(wind) {
  return wind ? `${wind.variable ? 'VRB' : wind.direction === null ? 'směr neuveden' : `${formatNumber(wind.direction)}°`} / ${measurement(wind.speedKt)} kt${wind.gustKt === null ? '' : ` · nárazy ${measurement(wind.gustKt)} kt`}` : 'Neuvedeno';
}
function cloudText(clouds) {
  return clouds.map((cloud) => `${cloud.cover} ${cloud.baseFtAgl === null ? 'výška neznámá' : `${formatNumber(cloud.baseFtAgl)} ft AGL`}${cloud.type ? ` ${cloud.type}` : ''}`).join(' · ');
}

/** Summary only: the caller keeps the original bulletin visible in its RAW view. */
export function renderMetarSummary(item, { timezone = 'Europe/Prague', compact = false } = {}) {
  const summary = summarizeMetar(item);
  if (summary.status !== 'available') return `<div class="metar-summary${compact ? ' metar-summary--compact' : ''}"><p class="muted">${esc(formatReportSummary(summary))}</p>${warningList(summary.warnings)}</div>`;
  const layers = summary.clouds.length ? cloudText(summary.clouds) : summary.ceiling.status === 'cavok' ? 'CAVOK · oblačnost podle podmínek kódu' : 'Vrstvy nejsou uvedeny';
  const temperature = finite(summary.temperature) ? `${measurement(summary.temperature)} °C` : '—';
  const dewpoint = finite(summary.dewpoint) ? `${measurement(summary.dewpoint)} °C` : '—';
  const cells = [
    ['wind', 'Vítr', windText(summary.wind)],
    ['visibility', 'Dohlednost', summary.visibility.text],
    ['ceiling', 'Pozorovaný ceiling', ceilingText(summary)],
    ['clouds', 'Oblačnost / VV', layers],
    ['temperature', 'Teplota / rosný bod', `${temperature} / ${dewpoint}`],
    ['pressure', 'QNH', finite(summary.pressureHpa) ? `${formatNumber(summary.pressureHpa)} hPa` : 'Neuvedeno'],
  ];
  return `<div class="metar-summary${compact ? ' metar-summary--compact' : ''}"><dl class="metar-metrics">${cells.map(([key, label, value]) => `<div class="metar-metric metar-metric--${key}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${summary.wx.length ? `<p class="metar-weather">${summary.wx.map((weather) => `<strong>${esc(weather.code)}</strong> · ${esc(weather.description)}`).join(' · ')}</p>` : ''}${warningList(summary.warnings)}${compact ? '' : `${item.observedAt ? `<p class="report-observation">Pozorování ${esc(formatTime(item.observedAt, timezone, true))} ${zoneLabel(timezone)}.</p>` : ''}<details class="report-interpretation"><summary>Výšky a definice ceilingu</summary><p>Výšky oblačnosti jsou nad letištěm (ft AGL), nikoli nad vybraným bodem mapy. ${esc(summary.ceiling.definition)}</p></details>`}</div>`;
}

/** Keep omitted TAF fields absent: a wind-only change must not acquire prior cloud or visibility. */
function tafConditions(period) {
  const fields = [];
  if (period.wind) fields.push(['wind', 'Vítr', windText(period.wind)]);
  if (finite(period.visibility?.metres)) fields.push(['visibility', 'Dohlednost', period.visibility.text]);
  if (['reported', 'cavok'].includes(period.ceiling.status) || period.clouds.some(cloud => ['BKN', 'OVC', 'VV', 'OVX'].includes(cloud.cover))) fields.push(['ceiling', 'Ceiling', ceilingText(period)]);
  if (period.clouds.length) fields.push(['clouds', 'Vrstvy / VV', cloudText(period.clouds)]);
  else {
    const code = period.raw.match(/\b(?:SKC|CLR|NSC|NCD)\b/)?.[0];
    if (code) fields.push(['clouds', 'Oblačnost', code]);
  }
  if (period.wx.length) fields.push(['weather', 'Počasí', period.wx.map((weather) => `${weather.code} · ${weather.description}`).join(' · ')]);
  return fields.length ? `<dl class="taf-condition-list">${fields.map(([key, label, value]) => `<div class="taf-condition taf-condition--${key}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : '<p class="taf-empty-conditions">Žádné další rozpoznané položky; čti originál.</p>';
}

/** Every written group stays visible; this is not a reconstruction of prevailing conditions. */
export function renderTafPeriods(item, { selectedTime = null, timezone = 'Europe/Prague', compact = false } = {}) {
  const summary = summarizeTaf(item, { selectedTime });
  if (summary.status !== 'available' || !summary.periods.length) return `<div class="taf-periods${compact ? ' taf-periods--compact' : ''}"><p class="muted">Časové skupiny nejsou dostupné; ověř originální TAF.</p>${warningList(summary.warnings)}</div>`;
  const date = (iso) => iso && Number.isFinite(Date.parse(iso)) ? `${formatTime(iso, timezone, true)} ${zoneLabel(timezone)}` : 'čas neurčen';
  const time = (iso) => iso && Number.isFinite(Date.parse(iso)) ? `<time datetime="${esc(iso)}">${esc(date(iso))}</time>` : '<span>čas neurčen</span>';
  const warnings = summary.warnings.filter(warning => !SHARED_TAF_NOTES.has(warning));
  return `<div class="taf-periods${compact ? ' taf-periods--compact' : ''}"><p class="taf-scope-note">Jen výslovně uvedené položky; návaznost podmínek čti v originálu.</p><div class="taf-table-wrap"><table class="taf-table"><caption class="sr-only">Časové skupiny TAF s původním významem změn a pravděpodobnosti; časy ${zoneLabel(timezone)}</caption><thead><tr><th scope="col">Skupina</th><th scope="col">Interval · ${zoneLabel(timezone)}</th><th scope="col">Uvedené podmínky</th></tr></thead><tbody>${summary.periods.map((period) => `<tr class="taf-period" data-selected="${period.selected}" data-period-start="${esc(period.start || '')}" data-period-end="${esc(period.end || '')}"><th scope="row"><span class="source-badge">${esc(period.type === 'PROB' ? `PROB${period.probability}${period.raw.includes('TEMPO') ? ' TEMPO' : ''}` : period.type)}</span><span class="taf-period-label">${esc(period.label)}</span><span class="tag taf-selected-label"${period.selected ? '' : ' hidden'}>Čas přehledu</span></th><td class="taf-period-time"><span class="taf-mobile-label" aria-hidden="true">Interval</span><span class="taf-time-start">${time(period.start)}</span><span class="taf-time-separator" aria-hidden="true">–</span><span class="taf-time-end">${time(period.end)}</span></td><td class="taf-period-conditions">${tafConditions(period)}${period.unknownTokens.length ? `<p class="taf-unknown">Další původní skupiny: <code>${esc(period.unknownTokens.join(' '))}</code></p>` : ''}</td></tr>`).join('')}</tbody></table></div>${warningList(warnings)}${compact ? '' : `<details class="report-interpretation"><summary>Pravidla výkladu změnových skupin</summary><p>${TAF_GUIDANCE}</p></details>`}</div>`;
}

/** Self-contained report-helper styling for captured HTML, independent of the live panel ID. */
export const REPORT_VIEW_CSS = `
.report-guide{padding:12px 16px;border:1px solid var(--line,#cad4dc);background:var(--surface-alt,#f6f8fa)}
.report-guide .report-guide-key{display:flex;flex-wrap:wrap;gap:5px 16px;margin:0;font-size:12px;line-height:1.6;color:var(--muted,#556b7b)}
.report-guide .report-guide-key strong{color:var(--text,#172c3c)}
.report-guide .report-guide-print-note{display:none}
.report-guide .report-guide-details{margin-top:4px}
.report-guide .report-guide-details summary,.report-interpretation summary{display:list-item;padding:8px 0;cursor:pointer;color:var(--teal,#12657a);font-size:12px;font-weight:600}
.report-guide .report-guide-details summary:focus-visible,.report-interpretation summary:focus-visible{outline:2px solid var(--focus,#995900);outline-offset:3px}
.report-guide .report-guide-content{display:grid;grid-template-columns:1fr 1.35fr;gap:20px;padding:8px 0 4px}
.report-guide .report-guide-content p,.report-interpretation p{margin:0;font-size:13px;line-height:1.65;color:var(--muted,#556b7b)}
.metar-summary .metar-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 14px;margin:10px 0}
.metar-summary .metar-metric{min-width:0}
.metar-summary .metar-metric dt{font-size:12px;line-height:1.4;color:var(--muted,#556b7b)}
.metar-summary .metar-metric dd{margin:4px 0 0;font-size:14px;line-height:1.5;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.metar-summary .metar-metric--clouds{grid-column:1/-1;padding-top:8px;border-top:1px solid var(--line,#cad4dc)}
.metar-summary .metar-metric--clouds dd{font-size:13px;font-weight:400}
.metar-summary .metar-metric--temperature{grid-column:span 2}
.metar-summary .metar-weather{margin:10px 0;font-size:13px}
.metar-summary .report-observation{font-size:12px;color:var(--muted,#556b7b)}
.metar-summary .report-warnings,.taf-periods .report-warnings{margin:9px 0;padding-left:18px;color:var(--amber,#995900);font-size:12px;line-height:1.6}
.metar-summary .report-warnings li+li,.taf-periods .report-warnings li+li{margin-top:4px}
.metar-summary .report-interpretation,.taf-periods .report-interpretation{margin-top:8px;border-top:1px solid var(--line,#cad4dc)}
.metar-summary .report-interpretation p,.taf-periods .report-interpretation p{padding:4px 0 8px}
.taf-periods .taf-scope-note{margin:9px 0 7px;font-size:12px;line-height:1.6;color:var(--muted,#556b7b)}
.taf-periods .taf-table-wrap{overflow-x:auto;max-width:100%}
.taf-periods .taf-table{width:100%;table-layout:fixed;border-collapse:collapse;text-align:left;font-size:13px}
.taf-periods .taf-table th,.taf-periods .taf-table td{padding:9px 10px;vertical-align:top;border-bottom:1px solid var(--line,#cad4dc)}
.taf-periods .taf-table thead th{font-size:12px;line-height:1.5;font-weight:600;background:var(--surface-alt,#f6f8fa);color:var(--muted,#556b7b)}
.taf-periods .taf-table thead th:nth-child(1){width:21%}
.taf-periods .taf-table thead th:nth-child(2){width:26%}
.taf-periods .taf-table .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.taf-periods .taf-period>th{font-weight:400}
.taf-periods .taf-period[data-selected="true"]{background:var(--teal-soft,#e8f3f5);box-shadow:inset 2px 0 var(--teal,#12657a)}
.taf-periods .source-badge{display:inline-flex;padding:3px 6px;border:1px solid var(--line,#cad4dc);font-size:11px;font-weight:600;line-height:1.4}
.taf-periods .taf-period-label{display:block;margin:4px 0 0;font-size:12px;line-height:1.5;color:var(--muted,#556b7b)}
.taf-periods .taf-selected-label{display:table;margin-top:6px;font-size:11px;line-height:1.4;white-space:normal;color:var(--teal,#12657a)}
.taf-periods .taf-selected-label[hidden]{display:none!important}
.taf-periods .taf-period-time{min-width:0;font-size:12px;font-variant-numeric:tabular-nums;line-height:1.6}
.taf-periods .taf-time-start{display:block}
.taf-periods .taf-time-end,.taf-periods .taf-time-separator{display:inline}
.taf-periods .taf-time-separator{margin-right:4px;color:var(--muted,#556b7b)}
.taf-periods .taf-mobile-label{display:none}
.taf-periods .taf-condition-list{display:flex;flex-wrap:wrap;gap:5px 14px;margin:0}
.taf-periods .taf-condition{display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 7px;min-width:0}
.taf-periods .taf-condition dt{font-size:12px;line-height:1.5;color:var(--muted,#556b7b)}
.taf-periods .taf-condition dd{margin:0;font-size:13px;line-height:1.55;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.taf-periods .taf-condition--clouds,.taf-periods .taf-condition--weather{flex-basis:100%}
.taf-periods .taf-empty-conditions{margin:0;font-size:13px;color:var(--muted,#556b7b)}
.taf-periods .taf-unknown{margin:7px 0 0;font-size:12px;line-height:1.55;overflow-wrap:anywhere}
.taf-periods .taf-unknown code{font-family:var(--mono,monospace);font-size:12px}
@media screen and (max-width:650px){
 .report-guide .report-guide-key{display:block}
 .report-guide .report-guide-key>span{display:block;margin:3px 0}
 .report-guide .report-guide-content{grid-template-columns:1fr;gap:12px}
 .report-guide .report-guide-details summary,.report-interpretation summary{min-height:44px;padding:11px 0}
 .metar-summary .metar-metric--wind{grid-column:span 2}
 .metar-summary .metar-metric--ceiling{grid-column:1/-1}
 .taf-periods .taf-table,.taf-periods .taf-table tbody,.taf-periods .taf-table tr,.taf-periods .taf-table th,.taf-periods .taf-table td{display:block;width:100%;min-width:0}
 .taf-periods .taf-table thead{display:table-header-group;position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap}
 .taf-periods .taf-table tr{padding:10px 0;border-top:1px solid var(--line,#cad4dc);border-bottom:0}
 .taf-periods .taf-table th,.taf-periods .taf-table td{padding:4px 10px;border:0}
 .taf-periods .taf-period>th{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px}
 .taf-periods .taf-period-label,.taf-periods .taf-selected-label{margin:0}
 .taf-periods .taf-period-time{display:flex;align-items:baseline;flex-wrap:wrap;gap:3px 6px}
 .taf-periods .taf-time-start,.taf-periods .taf-time-end,.taf-periods .taf-time-separator{display:inline}
 .taf-periods .taf-mobile-label{display:inline;color:var(--muted,#556b7b);margin-right:2px}
 .taf-periods .taf-condition{flex-basis:100%}
}
@media print{
 .report-guide .report-guide-key{font-size:10px}
 .report-guide .report-guide-print-note{display:block;margin:7px 0 0;font-size:10px;line-height:1.5}
 .report-guide .report-guide-details{display:none}
 .metar-summary .report-interpretation::details-content,.taf-periods .report-interpretation::details-content{content-visibility:visible!important;block-size:auto!important}
 .metar-summary .report-interpretation>p,.taf-periods .report-interpretation>p{display:block!important;content-visibility:visible!important}
 .metar-summary .report-interpretation summary,.taf-periods .report-interpretation summary{font-size:10px}
 .metar-summary .metar-metric dt,.metar-summary .metar-metric dd,.metar-summary .report-warnings,.taf-periods .report-warnings,.taf-periods .taf-scope-note{font-size:10px}
 .taf-periods .taf-table-wrap{overflow:visible}
 .taf-periods .taf-table{font-size:10px}
 .taf-periods .taf-table th,.taf-periods .taf-table td{padding:6px}
 .taf-periods .taf-condition dt,.taf-periods .taf-condition dd,.taf-periods .taf-period-label,.taf-periods .taf-period-time{font-size:10px}
 .taf-periods .taf-period{break-inside:avoid}
 .taf-periods .taf-mobile-label{display:none}
}
`;

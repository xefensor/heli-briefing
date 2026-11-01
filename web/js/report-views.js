import { summarizeMetar, summarizeTaf, formatReportSummary } from './reports.js';
import { formatTime, formatNumber } from './briefing.js';
import { escapeHtml as esc } from './charts.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const zoneLabel = (timezone) => timezone === 'UTC' ? 'UTC' : 'CZ';
const SHARED_TAF_NOTES = new Set([
  'Změnové skupiny zobrazují pouze výslovně uvedené položky. Neuvedené podmínky zde nejsou doplňovány; pro jejich návaznost čti celý TAF.',
  'BECMG označuje okno postupné změny, nikoli okamžik přepnutí; toto zobrazení nepočítá výsledný stav po skončení přechodu.',
]);

function warningList(warnings) {
  return warnings.length ? `<ul class="report-warnings">${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul>` : '';
}

/** Render once beside compact station blocks; originals and exceptions stay local. */
export function renderReportGuide() {
  return `<div class="report-guide"><p><strong>METAR · pozorování na letišti.</strong> Ceiling je nejnižší uvedená BKN/OVC nebo vertikální dohlednost VV, ve ft AGL nad letištěm. Není to výška nad vybraným bodem. CAVOK není neomezená ani změřená výška ceilingu.</p><p><strong>TAF · výslovně uvedené podmínky.</strong> Chybějící položky nejsou doplněny z předchozí skupiny; pro návaznost čti celý TAF. BECMG je okno postupné změny, nikoli okamžik přepnutí; výsledný stav po něm zde není dopočítán. TEMPO / PROB nejsou nepřetržitý jistý stav. Původní zprávy zachovávají UTC.</p></div>`;
}

function ceilingText(summary) {
  const ceiling = summary.ceiling;
  if (ceiling.status === 'reported') return `${formatNumber(ceiling.valueFtAgl)} ft AGL${summary.clouds.some((cloud) => cloud.verticalVisibility) ? ' · VV' : ''}`;
  if (ceiling.status === 'cavok') return 'CAVOK · výška není číselně uvedena';
  if (ceiling.status === 'not-reported') return 'BKN / OVC / VV neuvedeno';
  return 'Výška neznámá';
}

/** Summary only: the caller retains the original bulletin in its RAW view. */
export function renderMetarSummary(item, { timezone = 'Europe/Prague', compact = false } = {}) {
  const summary = summarizeMetar(item);
  if (summary.status !== 'available') return `<div class="metar-summary${compact ? ' metar-summary--compact' : ''}"><p class="muted">${esc(formatReportSummary(summary))}</p>${warningList(summary.warnings)}</div>`;
  const wind = summary.wind;
  const windText = wind ? `${wind.variable ? 'VRB' : wind.direction === null ? 'směr neuveden' : `${formatNumber(wind.direction)}°`} / ${formatNumber(wind.speedKt, 1)} kt${wind.gustKt === null ? '' : ` · nárazy ${formatNumber(wind.gustKt, 1)} kt`}` : 'Neuvedeno';
  const cloudText = summary.clouds.length ? summary.clouds.map((cloud) => `${cloud.cover} ${cloud.baseFtAgl === null ? 'výška neznámá' : `${formatNumber(cloud.baseFtAgl)} ft AGL`}${cloud.type ? ` ${cloud.type}` : ''}`).join(' · ')
    : summary.ceiling.status === 'cavok' ? 'CAVOK · oblačnost podle podmínek kódu' : 'Vrstvy nejsou uvedeny';
  const temperature = finite(summary.temperature) ? `${formatNumber(summary.temperature, 1)} °C` : '—';
  const dewpoint = finite(summary.dewpoint) ? `${formatNumber(summary.dewpoint, 1)} °C` : '—';
  const cells = [
    ['wind', 'Vítr', windText],
    ['visibility', 'Dohlednost', summary.visibility.text],
    ['ceiling', 'Pozorovaný ceiling', ceilingText(summary)],
    ['clouds', 'Oblačnost / VV', cloudText],
    ['temperature', 'Teplota / rosný bod', `${temperature} / ${dewpoint}`],
    ['pressure', 'QNH', finite(summary.pressureHpa) ? `${formatNumber(summary.pressureHpa)} hPa` : 'Neuvedeno'],
  ];
  return `<div class="metar-summary${compact ? ' metar-summary--compact' : ''}"><dl class="metar-metrics">${cells.map(([key, label, value]) => `<div class="metar-metric metar-metric--${key}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${summary.wx.length ? `<p class="metar-weather">${summary.wx.map((weather) => `<strong>${esc(weather.code)}</strong> · ${esc(weather.description)}`).join(' · ')}</p>` : ''}${warningList(summary.warnings)}${compact ? '' : `<p class="chart-caption">${item.observedAt ? `Pozorování ${esc(formatTime(item.observedAt, timezone, true))} ${zoneLabel(timezone)}. ` : ''}Výšky oblačnosti jsou nad letištěm (ft AGL), nikoli nad vybraným bodem mapy. ${esc(summary.ceiling.definition)}</p>`}</div>`;
}

/** Explicit written TAF groups, not a reconstruction of inherited conditions. */
export function renderTafPeriods(item, { selectedTime = null, timezone = 'Europe/Prague', compact = false } = {}) {
  const summary = summarizeTaf(item, { selectedTime });
  if (summary.status !== 'available' || !summary.periods.length) return `<div class="taf-periods${compact ? ' taf-periods--compact' : ''}"><p class="muted">Časové skupiny nejsou dostupné; ověř originální TAF.</p>${warningList(summary.warnings)}</div>`;
  const date = (iso) => iso ? `${formatTime(iso, timezone, true)} ${zoneLabel(timezone)}` : 'čas neurčen';
  const warnings = compact ? summary.warnings.filter(warning => !SHARED_TAF_NOTES.has(warning)) : summary.warnings;
  return `<div class="taf-periods${compact ? ' taf-periods--compact' : ''}">${compact ? '' : '<p class="chart-caption taf-interpretation">Pouze výslovně uvedené podmínky každé skupiny. Chybějící položky nejsou doplněny z předchozí skupiny. BECMG je okno postupné změny; TEMPO a PROB nejsou nepřetržitý jistý stav.</p>'}<div class="taf-table-wrap"><table class="taf-table"><caption class="sr-only">Časové skupiny TAF s původním významem změn a pravděpodobnosti</caption><thead><tr><th scope="col">Skupina</th><th scope="col">Interval</th><th scope="col">Uvedené podmínky</th></tr></thead><tbody>${summary.periods.map((period) => `<tr class="taf-period" data-selected="${period.selected}" data-period-start="${esc(period.start || '')}" data-period-end="${esc(period.end || '')}"><th scope="row"><span class="source-badge">${esc(period.type === 'PROB' ? `PROB${period.probability}${period.raw.includes('TEMPO') ? ' TEMPO' : ''}` : period.type)}</span><span class="taf-period-label">${esc(period.label)}</span><span class="tag taf-selected-label"${period.selected ? '' : ' hidden'}>Překryv času přehledu</span></th><td class="taf-period-time">${esc(date(period.start))}<br>– ${esc(date(period.end))}</td><td class="taf-period-conditions">${esc(formatReportSummary(period))}${period.unknownTokens.length ? `<p class="taf-unknown">Další původní skupiny: <code>${esc(period.unknownTokens.join(' '))}</code></p>` : ''}</td></tr>`).join('')}</tbody></table></div>${warningList(warnings)}</div>`;
}

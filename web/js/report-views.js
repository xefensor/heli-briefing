import { summarizeMetar, summarizeTaf, formatReportSummary } from './reports.js';
import { formatTime, formatNumber } from './briefing.js';
import { escapeHtml as esc } from './charts.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const zoneLabel = (timezone) => timezone === 'UTC' ? 'UTC' : 'CZ';

function warningList(warnings) {
  return warnings.length ? `<ul class="report-warnings">${warnings.map((warning) => `<li>${esc(warning)}</li>`).join('')}</ul>` : '';
}

function ceilingText(summary) {
  const ceiling = summary.ceiling;
  if (ceiling.status === 'reported') return `${formatNumber(ceiling.valueFtAgl)} ft AGL${summary.clouds.some((cloud) => cloud.verticalVisibility) ? ' · VV' : ''}`;
  if (ceiling.status === 'cavok') return 'CAVOK · výška není číselně uvedena';
  if (ceiling.status === 'not-reported') return 'BKN / OVC / VV neuvedeno';
  return 'Výška neznámá';
}

/** Summary only: the caller retains the original bulletin in its RAW view. */
export function renderMetarSummary(item, { timezone = 'Europe/Prague' } = {}) {
  const summary = summarizeMetar(item);
  if (summary.status !== 'available') return `<div class="metar-summary"><p class="muted">${esc(formatReportSummary(summary))}</p>${warningList(summary.warnings)}</div>`;
  const wind = summary.wind;
  const windText = wind ? `${wind.variable ? 'VRB' : wind.direction === null ? 'směr neuveden' : `${formatNumber(wind.direction)}°`} / ${formatNumber(wind.speedKt, 1)} kt${wind.gustKt === null ? '' : ` · nárazy ${formatNumber(wind.gustKt, 1)} kt`}` : 'Neuvedeno';
  const cloudText = summary.clouds.length ? summary.clouds.map((cloud) => `${cloud.cover} ${cloud.baseFtAgl === null ? 'výška neznámá' : `${formatNumber(cloud.baseFtAgl)} ft AGL`}${cloud.type ? ` ${cloud.type}` : ''}`).join(' · ')
    : summary.ceiling.status === 'cavok' ? 'CAVOK · oblačnost podle podmínek kódu' : 'Vrstvy nejsou uvedeny';
  const temperature = finite(summary.temperature) ? `${formatNumber(summary.temperature, 1)} °C` : '—';
  const dewpoint = finite(summary.dewpoint) ? `${formatNumber(summary.dewpoint, 1)} °C` : '—';
  const cells = [
    ['Vítr', windText],
    ['Dohlednost', summary.visibility.text],
    ['Pozorovaný ceiling', ceilingText(summary)],
    ['Oblačnost / VV', cloudText],
    ['Teplota / rosný bod', `${temperature} / ${dewpoint}`],
    ['QNH', finite(summary.pressureHpa) ? `${formatNumber(summary.pressureHpa)} hPa` : 'Neuvedeno'],
  ];
  return `<div class="metar-summary"><dl class="metar-metrics">${cells.map(([label, value]) => `<div class="metar-metric"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${summary.wx.length ? `<p class="metar-weather">${summary.wx.map((weather) => `<strong>${esc(weather.code)}</strong> · ${esc(weather.description)}`).join(' · ')}</p>` : ''}${warningList(summary.warnings)}<p class="chart-caption">${item.observedAt ? `Pozorování ${esc(formatTime(item.observedAt, timezone, true))} ${zoneLabel(timezone)}. ` : ''}Výšky oblačnosti jsou nad letištěm (ft AGL), nikoli nad vybraným bodem mapy. ${esc(summary.ceiling.definition)}</p></div>`;
}

/** Explicit written TAF groups, not a reconstruction of inherited conditions. */
export function renderTafPeriods(item, { selectedTime = null, timezone = 'Europe/Prague' } = {}) {
  const summary = summarizeTaf(item, { selectedTime });
  if (summary.status !== 'available' || !summary.periods.length) return `<div class="taf-periods"><p class="muted">Časové skupiny nejsou dostupné; ověř originální TAF.</p>${warningList(summary.warnings)}</div>`;
  const date = (iso) => iso ? `${formatTime(iso, timezone, true)} ${zoneLabel(timezone)}` : 'čas neurčen';
  return `<div class="taf-periods"><p class="chart-caption taf-interpretation">Pouze výslovně uvedené podmínky každé skupiny. Chybějící položky nejsou doplněny z předchozí skupiny. BECMG je okno postupné změny; TEMPO a PROB nejsou nepřetržitý jistý stav.</p><div class="taf-table-wrap"><table class="taf-table"><caption class="sr-only">Časové skupiny TAF s původním významem změn a pravděpodobnosti</caption><thead><tr><th scope="col">Skupina</th><th scope="col">Interval</th><th scope="col">Uvedené podmínky</th></tr></thead><tbody>${summary.periods.map((period) => `<tr class="taf-period" data-selected="${period.selected}" data-period-start="${esc(period.start || '')}" data-period-end="${esc(period.end || '')}"><th scope="row"><span class="source-badge">${esc(period.type === 'PROB' ? `PROB${period.probability}${period.raw.includes('TEMPO') ? ' TEMPO' : ''}` : period.type)}</span><span class="taf-period-label">${esc(period.label)}</span><span class="tag taf-selected-label"${period.selected ? '' : ' hidden'}>Překryv času přehledu</span></th><td class="taf-period-time">${esc(date(period.start))}<br>– ${esc(date(period.end))}</td><td class="taf-period-conditions">${esc(formatReportSummary(period))}${period.unknownTokens.length ? `<p class="taf-unknown">Další původní skupiny: <code>${esc(period.unknownTokens.join(' '))}</code></p>` : ''}</td></tr>`).join('')}</tbody></table></div>${warningList(summary.warnings)}</div>`;
}

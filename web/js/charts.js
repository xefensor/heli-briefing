/** Small SVG charts for timestamped weather series. Missing samples stay missing. */

const WIDTH = 720;
const LEFT = 48;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 40;
const COLORS = ['#e7b76c', '#8cc7d4', '#a9b4ca', '#c4a7dc'];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const rounded = (value) => Number(value.toFixed(2));

/** Readable linear ticks. Explicit min/max on renderChart still bound the plot. */
export function niceTicks(minimum, maximum, count = 5) {
  if (!finite(minimum) || !finite(maximum) || maximum < minimum) return [];
  if (minimum === maximum) {
    const padding = Math.abs(minimum) * 0.05 || 1;
    minimum -= padding;
    maximum += padding;
  }
  const rawStep = (maximum - minimum) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
  const first = Math.ceil((minimum - step * 1e-9) / step) * step;
  const ticks = [];
  for (let value = first; value <= maximum + step * 1e-9 && ticks.length < 30; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

function timeFormatter(timezone, date = false) {
  return new Intl.DateTimeFormat('cs-CZ', date
    ? { timeZone: timezone, day: 'numeric', month: 'numeric' }
    : { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** Tick indices refer to original samples; a missing value never shifts time. */
export function buildTimeTicks(times, timezone = 'Europe/Prague', maxTicks = 7) {
  const valid = times.map((time, index) => ({ time, index, instant: Date.parse(time) }))
    .filter((item) => Number.isFinite(item.instant));
  if (!valid.length) return [];
  const clock = timeFormatter(timezone);
  const calendar = timeFormatter(timezone, true);
  const chosen = new Map();
  const count = Math.min(Math.max(2, Math.floor(maxTicks)), valid.length);
  const start = valid[0].instant;
  const end = valid.at(-1).instant;
  for (let tick = 0; tick < count; tick += 1) {
    const target = count === 1 ? start : start + (end - start) * tick / (count - 1);
    const sample = valid.reduce((best, item) => Math.abs(item.instant - target) < Math.abs(best.instant - target) ? item : best);
    chosen.set(sample.index, sample);
  }
  let previousDate = '';
  return [...chosen.values()].sort((a, b) => a.index - b.index).map((item) => {
    const date = calendar.format(item.instant);
    const result = {
      index: item.index,
      time: item.time,
      label: clock.format(item.instant),
      dateLabel: date !== previousDate ? date : '',
    };
    previousDate = date;
    return result;
  });
}

function color(value, index) {
  return typeof value === 'string' && /^(?:#[\da-f]{3,8}|var\(--[\w-]+\))$/i.test(value)
    ? value : COLORS[index % COLORS.length];
}

function dash(value) {
  if (value === true) return '5 4';
  return typeof value === 'string' && /^[\d. ,]+$/.test(value) ? value : '';
}

function valueLabel(value) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(value);
}

function emptySvg(height, message, label, width = WIDTH) {
  return `<svg class="weather-chart chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label || message)}"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-empty" fill="currentColor">${escapeHtml(message)}</text></svg>`;
}

/**
 * Render an SVG string. Series on one chart must share a scale/unit.
 * Consumers own selection events and accessible exact-value tables. Transparent
 * sample hit areas expose data-index/data-time; indexFromPointer supports SVG-
 * wide pointer listeners. No callback is serialized into generated markup.
 */
export function renderChart({
  times = [], series = [], selectedTime = null, timezone = 'Europe/Prague',
  width = 720, height = 190, yLabel = '', min, max,
} = {}) {
  const WIDTH = finite(width) ? Math.max(240, Math.min(1000, width)) : 720;
  height = finite(height) ? Math.max(140, Math.min(600, height)) : 190;
  const instants = times.map((time) => Date.parse(time));
  if (!instants.length) return emptySvg(height, 'Pro zvolené období nejsou data.', yLabel, WIDTH);
  if (instants.some((time, index) => !Number.isFinite(time) || (index && time <= instants[index - 1]))) {
    return emptySvg(height, 'Časovou osu nelze zobrazit.', yLabel, WIDTH);
  }
  const allValues = series.flatMap((item) => (item.values || []).slice(0, times.length)).filter(finite);
  if (!allValues.length) return emptySvg(height, 'Pro zvolené období nejsou data.', yLabel, WIDTH);

  let low = finite(min) ? min : Math.min(...allValues);
  let high = finite(max) ? max : Math.max(...allValues);
  if (high < low) return emptySvg(height, 'Neplatný rozsah grafu.', yLabel, WIDTH);
  if (low === high) {
    const padding = Math.abs(low) * 0.05 || 1;
    if (!finite(min)) low -= padding;
    if (!finite(max)) high += padding;
    if (low === high) high = low + padding;
  } else {
    const padding = (high - low) * 0.09;
    if (!finite(min)) low -= padding;
    if (!finite(max)) high += padding;
  }
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = height - TOP - BOTTOM;
  const start = instants[0];
  const end = instants.at(-1);
  const x = (time) => rounded(LEFT + (start === end ? 0.5 : (time - start) / (end - start)) * plotWidth);
  const y = (value) => rounded(TOP + (high - value) / (high - low) * plotHeight);
  const grid = niceTicks(low, high).map((value) => `<g class="chart-grid"><line x1="${LEFT}" y1="${y(value)}" x2="${WIDTH - RIGHT}" y2="${y(value)}" stroke="currentColor" opacity="0.12"/><text x="${LEFT - 9}" y="${y(value) + 4}" text-anchor="end" fill="currentColor">${escapeHtml(valueLabel(value))}</text></g>`).join('');
  const ticks = buildTimeTicks(times, timezone, WIDTH < 340 ? 3 : WIDTH < 480 ? 4 : 7).map((tick) => {
    const tickX = x(instants[tick.index]);
    const anchor = tick.index === 0 ? 'start' : tick.index === times.length - 1 ? 'end' : 'middle';
    return `<g class="chart-tick"><line x1="${tickX}" y1="${TOP}" x2="${tickX}" y2="${height - BOTTOM}" stroke="currentColor" opacity="0.07"/><text x="${tickX}" y="${height - 22}" text-anchor="${anchor}" fill="currentColor">${escapeHtml(tick.label)}</text>${tick.dateLabel ? `<text x="${tickX}" y="${height - 7}" text-anchor="${anchor}" fill="currentColor" opacity="0.6">${escapeHtml(tick.dateLabel)}</text>` : ''}</g>`;
  }).join('');

  const selected = selectedTime === null ? NaN : Date.parse(selectedTime);
  const selectedInRange = Number.isFinite(selected) && selected >= start && selected <= end;
  const selectedIndex = selectedInRange
    ? instants.reduce((best, instant, index) => Math.abs(instant - selected) < Math.abs(instants[best] - selected) ? index : best, 0)
    : -1;

  const lines = series.map((item, seriesIndex) => {
    const seriesColor = color(item.color, seriesIndex);
    if (item.pointsOnly) {
      const dots = times.map((_, index) => finite(item.values?.[index])
        ? `<circle class="chart-observation" cx="${x(instants[index])}" cy="${y(item.values[index])}" r="3" fill="${seriesColor}"/>` : '').join('');
      return `<g class="chart-series" data-series="${escapeHtml(item.key || seriesIndex)}"><title>${escapeHtml(item.label || item.key || '')}</title>${dots}</g>`;
    }
    const segments = [];
    let segment = [];
    for (let index = 0; index < times.length; index += 1) {
      const value = item.values?.[index];
      if (!finite(value)) {
        if (segment.length) segments.push(segment);
        segment = [];
      } else {
        segment.push({ x: x(instants[index]), y: y(value), index, value });
      }
    }
    if (segment.length) segments.push(segment);
    const strokeDash = dash(item.dash);
    const paths = segments.map((points) => {
      const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
      const fill = item.fill && points.length > 1
        ? `<path d="${path} L${points.at(-1).x},${height - BOTTOM} L${points[0].x},${height - BOTTOM} Z" fill="${seriesColor}" fill-opacity="0.09" stroke="none"/>` : '';
      const isolated = points.length === 1
        ? `<circle cx="${points[0].x}" cy="${points[0].y}" r="2.5" fill="${seriesColor}"/>` : '';
      return `${fill}<path class="chart-line" d="${path}" fill="none" stroke="${seriesColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${strokeDash ? ` stroke-dasharray="${strokeDash}"` : ''}/>${isolated}`;
    }).join('');
    const selectedValue = item.values?.[selectedIndex];
    const selectedDot = selectedIndex >= 0 && finite(selectedValue)
      ? `<circle class="chart-selected-point" cx="${x(instants[selectedIndex])}" cy="${y(selectedValue)}" r="3.5" fill="${seriesColor}" stroke="var(--panel, #202723)" stroke-width="1.5"/>` : '';
    return `<g class="chart-series" data-series="${escapeHtml(item.key || seriesIndex)}"><title>${escapeHtml(item.label || item.key || '')}</title>${paths}${selectedDot}</g>`;
  }).join('');

  const cursor = selectedInRange
    ? `<line class="chart-cursor" x1="${x(selected)}" y1="${TOP}" x2="${x(selected)}" y2="${height - BOTTOM}" stroke="currentColor" opacity="0.65" stroke-width="1" stroke-dasharray="3 3"/>` : '';
  const hitAreas = times.map((time, index) => {
    const left = index ? (x(instants[index - 1]) + x(instants[index])) / 2 : LEFT;
    const right = index === times.length - 1 ? WIDTH - RIGHT : (x(instants[index]) + x(instants[index + 1])) / 2;
    return `<rect class="chart-hit" data-index="${index}" data-time="${escapeHtml(time)}" x="${rounded(left)}" y="${TOP}" width="${rounded(Math.max(0, right - left))}" height="${plotHeight}" fill="transparent"><title>${escapeHtml(`${new Date(time).toISOString()} · ${series.map((item) => `${item.label || item.key}: ${finite(item.values?.[index]) ? valueLabel(item.values[index]) : 'bez dat'}${item.unit ? ` ${item.unit}` : ''}`).join(' · ')}`)}</title></rect>`;
  }).join('');
  const title = [yLabel, ...series.map((item) => item.label || item.key)].filter(Boolean).join(' · ');
  const missingCount = series.reduce((total, item) => total + times.reduce((count, _, index) => count + (!finite(item.values?.[index]) ? 1 : 0), 0), 0);
  const description = `${times.length} časových bodů, ${timezone}. Mezery označují chybějící data${missingCount ? ` (${missingCount} hodnot)` : ''}. Přesné hodnoty jsou dostupné v podrobnostech briefingu.`;

  return `<svg class="weather-chart chart-svg" data-chart="true" data-count="${times.length}" data-plot-top="${TOP}" data-plot-bottom="${height - BOTTOM}" data-plot-left="${LEFT}" data-plot-right="${WIDTH - RIGHT}" data-selected-index="${selectedIndex}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeHtml(title)}" style="display:block;width:100%;height:auto;overflow:visible;font:11px var(--font-mono,ui-monospace,monospace);color:var(--muted,#a4ada5)"><title>${escapeHtml(title)}</title><desc>${escapeHtml(description)}</desc>${grid}${ticks}${yLabel ? `<text x="${LEFT}" y="11" class="chart-unit" fill="currentColor">${escapeHtml(yLabel)}</text>` : ''}${lines}${cursor}${hitAreas}</svg>`;
}

/** Return the nearest original sample index from a pointer in the SVG viewport. */
export function indexFromPointer(event, svg, times) {
  if (!times?.length || !finite(event?.clientX)) return null;
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width) return null;
  const viewWidth = svg.viewBox?.baseVal?.width || WIDTH;
  const plotLeft = Number(svg.dataset?.plotLeft) || LEFT;
  const plotRight = Number(svg.dataset?.plotRight) || WIDTH - RIGHT;
  const position = (event.clientX - bounds.left) / bounds.width * viewWidth;
  const fraction = Math.max(0, Math.min(1, (position - plotLeft) / (plotRight - plotLeft)));
  const instants = times.map((time) => Date.parse(time));
  if (instants.some((time) => !Number.isFinite(time))) return null;
  const target = instants[0] + fraction * (instants.at(-1) - instants[0]);
  return instants.reduce((best, instant, index) => Math.abs(instant - target) < Math.abs(instants[best] - target) ? index : best, 0);
}

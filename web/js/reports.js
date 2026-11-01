/**
 * Literal METAR/TAF presentation. Raw text remains the authoritative report.
 * TAF change groups contain only fields explicitly written in that group: AWC's
 * decoded fcsts may already carry previous conditions forward, so they are not
 * used to present an omitted value as an explicit forecast.
 * References checked 2026-11-01:
 * https://aviationweather.gov/help/data/
 * https://www.faa.gov/air_traffic/publications/aim_html/chap7_section_1.html
 * https://www.weather.gov.hk/en/aviat/decode_metar.htm
 */

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const number = (value) => finite(value) ? value : null;
const nonnegative = (value) => finite(value) && value >= 0 ? value : null;
const SM_TO_M = 1609.344;
const HOUR = 3600000;
const DAY = HOUR * 24;
const CEILING_DEFINITION = 'Nejnižší uvedená vrstva BKN/OVC nebo vertikální dohlednost VV; výška nad letištěm v ft AGL.';
const WEATHER = {
  DZ: 'mrholení', RA: 'déšť', SN: 'sníh', SG: 'sněhová zrna', IC: 'ledové krystalky',
  PL: 'ledové krupky', GR: 'kroupy', GS: 'malé kroupy / sněhové krupky', UP: 'neurčené srážky',
  BR: 'kouřmo', FG: 'mlha', FU: 'kouř', VA: 'vulkanický popel', DU: 'rozptýlený prach',
  SA: 'písek', HZ: 'zákal', PY: 'vodní tříšť', PO: 'prachové / písečné víry', SQ: 'húlava',
  FC: 'nálevkovitý oblak', SS: 'písečná bouře', DS: 'prachová bouře',
};
const DESCRIPTORS = { MI: 'přízemní', PR: 'částečná', BC: 'chuchvalce', DR: 'nízko zvířený', BL: 'zvířený', SH: 'přeháňky', TS: 'bouřka', FZ: 'mrznoucí' };
const num = (value, digits = 0) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: digits }).format(value);
const rawBody = (raw) => String(raw || '').replace(/=/g, '').split(/\s+(?:RMK|NOSIG|BECMG|TEMPO)\b/)[0];

function availability(item) {
  if (!item || typeof item.raw !== 'string' || !item.raw.trim()) return 'unavailable';
  if (item.cancelled || /\bCNL\b/.test(item.raw)) return 'cancelled';
  if (item.nil || /\bNIL\b/.test(item.raw)) return 'nil';
  return 'available';
}

function windFrom(raw, fallback = null) {
  const match = raw.match(/(?:^|\s)(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)(?=\s|$)/);
  if (match) {
    if (match[1] !== 'VRB' && Number(match[1]) > 360) return null;
    const factor = match[4] === 'MPS' ? 1.9438444924406 : match[4] === 'KMH' ? 1 / 1.852 : 1;
    return { direction: match[1] === 'VRB' ? null : Number(match[1]), speedKt: Number(match[2]) * factor,
      gustKt: match[3] === undefined ? null : Number(match[3]) * factor, variable: match[1] === 'VRB', code: match[0].trim() };
  }
  if (fallback && nonnegative(fallback.wspd) !== null) return { direction: finite(fallback.wdir) && fallback.wdir >= 0 && fallback.wdir <= 360 ? fallback.wdir : null, speedKt: fallback.wspd,
    gustKt: nonnegative(fallback.wgst), variable: fallback.wdir === 'VRB', code: null };
  return null;
}

function visibilityValue(metres, qualifier, code, source) {
  const prefix = { 'at-least': '≥ ', 'greater-than': '> ', 'less-than': '< ', reported: '' }[qualifier] || '';
  return { metres, qualifier, code, source, text: `${prefix}${metres < 1000 ? `${num(metres)} m` : `${num(metres / 1000, 2)} km`}${code === 'CAVOK' ? ' · CAVOK' : ''}` };
}

function visibilityFrom(raw, fallback = null) {
  if (/\bCAVOK\b/.test(raw)) return visibilityValue(10000, 'at-least', 'CAVOK', 'raw');
  const metric = raw.split(/\s+/).find((token) => /^\d{4}(?:NDV)?$/.test(token));
  if (metric) {
    const code = metric.slice(0, 4);
    if (code === '9999') return visibilityValue(10000, 'at-least', code, 'raw');
    if (code === '0000') return visibilityValue(50, 'less-than', code, 'raw');
    return visibilityValue(Number(code), 'reported', code, 'raw');
  }
  const miles = raw.match(/(?:^|\s)([PM]?)(?:(\d+)\s+)?(\d+(?:\/\d+)?(?:\.\d+)?)SM(?=\s|$)/);
  if (miles) {
    const fraction = miles[3].split('/').map(Number);
    const amount = (miles[2] ? Number(miles[2]) : 0) + (fraction.length === 2 ? fraction[0] / fraction[1] : fraction[0]);
    if (Number.isFinite(amount) && amount >= 0) return visibilityValue(amount * SM_TO_M,
      miles[1] === 'M' ? 'less-than' : miles[1] === 'P' ? 'greater-than' : 'reported', miles[0].trim(), 'raw');
  }
  if (finite(fallback) && fallback >= 0) return visibilityValue(fallback * SM_TO_M, 'reported', String(fallback), 'AWC statute miles');
  if (typeof fallback === 'string') {
    const match = fallback.match(/^(\d+(?:\.\d+)?)(\+)?$/);
    if (match) return visibilityValue(Number(match[1]) * SM_TO_M, match[2] ? 'at-least' : 'reported', fallback, 'AWC statute miles');
  }
  return { text: '—', metres: null, qualifier: 'unknown', code: null, source: null };
}

function cloudsFrom(raw, fallback = null) {
  const matches = [...raw.matchAll(/(?:^|\s)(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?(?=\s|$)/g)];
  if (matches.length) return matches.map((match) => ({ cover: match[1], baseFtAgl: match[2] === '///' ? null : Number(match[2]) * 100,
    type: match[3] || null, verticalVisibility: match[1] === 'VV', code: match[0].trim() }));
  if (/\b(?:CAVOK|SKC|CLR|NSC|NCD)\b/.test(raw)) return [];
  if (Array.isArray(fallback)) return fallback.map((cloud) => ({ cover: String(cloud.cover || ''), baseFtAgl: nonnegative(cloud.base),
    type: typeof cloud.type === 'string' ? cloud.type : null, verticalVisibility: ['VV', 'OVX'].includes(cloud.cover), code: null }));
  return [];
}

function ceilingFrom(raw, clouds, fallbackVertical = null) {
  const layers = clouds.filter((cloud) => ['BKN', 'OVC', 'VV', 'OVX'].includes(cloud.cover));
  if (!layers.some((cloud) => cloud.verticalVisibility) && nonnegative(fallbackVertical) !== null) layers.push({ baseFtAgl: fallbackVertical });
  if (layers.some((cloud) => cloud.baseFtAgl === null)) return { valueFtAgl: null, status: 'unknown', definition: CEILING_DEFINITION };
  if (layers.length) return { valueFtAgl: Math.min(...layers.map((cloud) => cloud.baseFtAgl)), status: 'reported', definition: CEILING_DEFINITION };
  if (/\bCAVOK\b/.test(raw)) return { valueFtAgl: null, status: 'cavok', definition: 'CAVOK je soubor podmínek se stanoveným prahem oblačnosti, nikoli neomezená nebo změřená výška ceilingu.' };
  return { valueFtAgl: null, status: clouds.length || /\b(?:SKC|CLR|NSC|NCD)\b/.test(raw) ? 'not-reported' : 'unknown', definition: CEILING_DEFINITION };
}

function weatherDescription(code) {
  if (code === 'NSW') return 'bez významného počasí (NSW)';
  let token = code;
  const parts = [];
  if (/^[+-]/.test(token)) { parts.push(token[0] === '-' ? 'slabé' : 'silné'); token = token.slice(1); }
  if (token.startsWith('VC')) { parts.push('v okolí'); token = token.slice(2); }
  if (DESCRIPTORS[token.slice(0, 2)]) { parts.push(DESCRIPTORS[token.slice(0, 2)]); token = token.slice(2); }
  if (!token && parts.length) return parts.join(' ');
  while (token.length >= 2 && WEATHER[token.slice(0, 2)]) { parts.push(WEATHER[token.slice(0, 2)]); token = token.slice(2); }
  return token || !parts.length ? code : parts.join(' ');
}

function weatherFrom(raw, fallback = null) {
  const explicit = raw.split(/\s+/).filter((token) => token === 'NSW' || /^(?:[+-]|VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/.test(token) || /^(?:VC)?TS$/.test(token));
  const codes = explicit.length ? explicit : typeof fallback === 'string' ? fallback.split(/\s+/).filter(Boolean) : [];
  return codes.map((code) => ({ code, description: weatherDescription(code) }));
}

function explicitConditions(raw, fallback = null) {
  const clouds = cloudsFrom(raw, fallback?.clouds);
  return { wind: windFrom(raw, fallback), visibility: visibilityFrom(raw, fallback?.visib), clouds,
    ceiling: ceilingFrom(raw, clouds, fallback?.vertVis), wx: weatherFrom(raw, fallback?.wxString) };
}

function temperatureFrom(raw, source) {
  const match = raw.match(/(?:^|\s)(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)(?=\s|$)/);
  const decode = (token) => token === '//' ? null : Number(token.replace('M', '-'));
  return match ? { temperature: decode(match[1]), dewpoint: decode(match[2]) }
    : { temperature: number(source.temp), dewpoint: number(source.dewp) };
}

export function summarizeMetar(item) {
  const status = availability(item);
  const raw = status === 'available' ? rawBody(item.raw) : '';
  const source = status === 'available' && item.source && typeof item.source === 'object' ? item.source : {};
  const summary = { kind: 'METAR', status, raw: item?.raw || '', ...explicitConditions(raw, source), ...temperatureFrom(raw, source), pressureHpa: null, warnings: [] };
  const pressure = raw.match(/(?:^|\s)Q(\d{4})(?=\s|$)/);
  const inches = raw.match(/(?:^|\s)A(\d{4})(?=\s|$)/);
  summary.pressureHpa = pressure ? Number(pressure[1]) : inches ? Number(inches[1]) / 100 * 33.8638866667 : number(source.altim);
  if (summary.pressureHpa !== null && (summary.pressureHpa < 600 || summary.pressureHpa > 1200)) { summary.pressureHpa = null; summary.warnings.push('Neobvyklé nebo neplatné tlakové pole; ověř originál.'); }
  if (summary.ceiling.status === 'unknown' && summary.clouds.some((cloud) => ['BKN', 'OVC', 'VV', 'OVX'].includes(cloud.cover))) summary.warnings.push('Výška nejnižšího ceilingu není určitelná; některá relevantní vrstva má neznámou výšku.');
  if (status !== 'available') summary.warnings.push(status === 'nil' ? 'NIL: zpráva není dostupná.' : status === 'cancelled' ? 'CNL: zpráva byla zrušena.' : 'Zpráva není dostupná.');
  return summary;
}

function ms(iso) { const value = typeof iso === 'string' || iso instanceof Date ? new Date(iso).getTime() : NaN; return Number.isFinite(value) ? value : null; }

/** Resolve only against the report's normalized validity; never infer a current month. */
function resolveDdhh(code, validFrom, validTo, minuteIncluded = false) {
  const anchor = ms(validFrom);
  const bound = ms(validTo);
  if (anchor === null || bound === null || !/^\d+$/.test(code)) return null;
  const day = Number(code.slice(0, 2));
  const hour = Number(code.slice(2, 4));
  const minute = minuteIncluded ? Number(code.slice(4, 6)) : 0;
  if (day < 1 || day > 31 || hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null;
  const reference = new Date(anchor);
  const candidates = [];
  for (const offset of [-1, 0, 1]) {
    const candidate = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, day, 0));
    if (candidate.getUTCDate() !== day) continue;
    const instant = candidate.getTime() + hour * HOUR + minute * 60000;
    if (instant >= anchor - DAY && instant <= bound + DAY) candidates.push(instant);
  }
  if (!candidates.length) return null;
  const within = candidates.filter((value) => value >= anchor && value <= bound);
  return new Date((within.length ? within : candidates).sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor))[0]).toISOString();
}

function unknownTokens(raw) {
  return raw.split(/\s+/).filter(Boolean).filter((token) => !(
    /^(?:VRB|\d{3})\d{2,3}(?:G\d{2,3})?(?:KT|MPS|KMH)$/.test(token) ||
    /^\d{3}V\d{3}$/.test(token) || /^\d{4}(?:NDV)?$/.test(token) ||
    /^[PM]?\d+(?:\/\d+)?(?:\.\d+)?SM$/.test(token) || /^\d+$/.test(token) ||
    /^(?:FEW|SCT|BKN|OVC|VV)(?:\d{3}|\/\/\/)(?:CB|TCU)?$/.test(token) ||
    /^(?:CAVOK|SKC|CLR|NSC|NCD|NSW)$/.test(token) ||
    weatherFrom(token).length > 0
  ));
}

export function summarizeTaf(item, { selectedTime = null } = {}) {
  const status = availability(item);
  const result = { kind: 'TAF', status, raw: item?.raw || '', periods: [], warnings: [], interpretation: 'explicit-only' };
  if (status !== 'available') {
    result.warnings.push(status === 'cancelled' ? 'CNL: předpověď byla zrušena.' : status === 'nil' ? 'NIL: předpověď není dostupná.' : 'Předpověď není dostupná.');
    return result;
  }
  const raw = item.raw.replace(/=/g, '').replace(/\s+/g, ' ').trim();
  const validity = raw.match(/\b\d{4}\/\d{4}\b/);
  if (!validity) { result.warnings.push('Časové skupiny nelze bezpečně rozdělit; použij originální TAF.'); return result; }
  const body = raw.slice(validity.index + validity[0].length).split(/\s+RMK\b/)[0].trim();
  const markerPattern = /\b(?:PROB(?:30|40)(?:\s+TEMPO)?\s+\d{4}\/\d{4}|(?:BECMG|TEMPO)\s+\d{4}\/\d{4}|FM\d{6})\b/g;
  const markers = [...body.matchAll(markerPattern)];
  const segments = [];
  const initialEnd = markers.length ? markers[0].index : body.length;
  if (body.slice(0, initialEnd).trim()) segments.push({ marker: '', text: body.slice(0, initialEnd).trim() });
  markers.forEach((marker, index) => segments.push({ marker: marker[0], text: body.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? body.length).trim() }));
  const selected = ms(selectedTime);
  result.periods = segments.map(({ marker, text }, index) => {
    const type = marker.startsWith('FM') ? 'FM' : marker.startsWith('BECMG') ? 'BECMG' : marker.startsWith('TEMPO') ? 'TEMPO' : marker.startsWith('PROB') ? 'PROB' : 'BASE';
    const probability = type === 'PROB' ? Number(marker.slice(4, 6)) : null;
    const labels = { BASE: 'Základní podmínky', FM: 'Od uvedeného času', BECMG: 'Postupná změna v intervalu', TEMPO: 'Přechodné podmínky', PROB: `Pravděpodobnost ${probability} %${marker.includes('TEMPO') ? ' · přechodně' : ''}` };
    let start = type === 'BASE' ? item.validFrom || null : null;
    let end = type === 'BASE' || type === 'FM' ? item.validTo || null : null;
    if (type === 'FM') start = resolveDdhh(marker.slice(2), item.validFrom, item.validTo, true);
    else if (type !== 'BASE') {
      const group = marker.match(/(\d{4})\/(\d{4})$/);
      start = resolveDdhh(group[1], item.validFrom, item.validTo);
      end = resolveDdhh(group[2], item.validFrom, item.validTo);
    }
    if (type === 'BASE' || type === 'FM') {
      const next = segments.slice(index + 1).find((segment) => /^(?:FM|BECMG)/.test(segment.marker));
      if (next) {
        const nextCode = next.marker.startsWith('FM') ? next.marker.slice(2) : next.marker.match(/(\d{4})\//)[1];
        end = resolveDdhh(nextCode, item.validFrom, item.validTo, next.marker.startsWith('FM'));
      }
    }
    const conditions = explicitConditions(text);
    const validInterval = ms(start) !== null && ms(end) !== null && ms(end) > ms(start);
    const unknown = unknownTokens(text);
    return { type, label: labels[type], start: validInterval ? start : null, end: validInterval ? end : null, raw: `${marker}${marker && text ? ' ' : ''}${text}`,
      ...conditions, probability, selected: selected === null || !validInterval ? false : ms(start) <= selected && selected < ms(end),
      unknownTokens: unknown, interpretation: 'explicit-only', transition: type === 'BECMG' };
  });
  if (result.periods.some((period) => !period.start || !period.end)) result.warnings.push('Některé intervaly nemají ověřitelnou platnost; zkontroluj originál.');
  if (result.periods.some((period) => period.type !== 'BASE' && period.type !== 'FM')) result.warnings.push('Změnové skupiny zobrazují pouze výslovně uvedené položky. Neuvedené podmínky zde nejsou doplňovány; pro jejich návaznost čti celý TAF.');
  if (result.periods.some((period) => period.transition)) result.warnings.push('BECMG označuje okno postupné změny, nikoli okamžik přepnutí; toto zobrazení nepočítá výsledný stav po skončení přechodu.');
  if (result.periods.some((period) => period.unknownTokens.length)) result.warnings.push('Některé doplňkové skupiny zůstávají pouze v originálním textu.');
  return result;
}

/** Human-readable present fields only; callers must HTML-escape the returned text. */
export function formatReportSummary(summary) {
  if (!summary || ['nil', 'cancelled', 'unavailable'].includes(summary.status)) return 'Podmínky nelze shrnout; ověř originální zprávu.';
  const parts = [];
  if (summary.wind) parts.push(`Vítr ${summary.wind.variable ? 'VRB' : summary.wind.direction === null ? 'směr neuveden' : `${num(summary.wind.direction)}°`} / ${num(summary.wind.speedKt, 1)} kt${summary.wind.gustKt === null ? '' : `, nárazy ${num(summary.wind.gustKt, 1)} kt`}`);
  if (summary.visibility?.metres !== null && summary.visibility?.metres !== undefined) parts.push(`Dohlednost ${summary.visibility.text}`);
  if (summary.ceiling?.status === 'reported') parts.push(`Ceiling ${num(summary.ceiling.valueFtAgl)} ft AGL${summary.clouds?.some((cloud) => cloud.verticalVisibility) ? ' (VV)' : ''}`);
  else if (summary.ceiling?.status === 'cavok') parts.push('Výška ceilingu není číselně uvedena');
  else if (summary.ceiling?.status === 'not-reported') parts.push(summary.kind === 'METAR' ? 'Ceiling není uveden (žádná uvedená BKN/OVC/VV)' : 'Uvedené vrstvy bez BKN/OVC/VV');
  else if (summary.clouds?.some((cloud) => ['BKN', 'OVC', 'VV', 'OVX'].includes(cloud.cover))) parts.push('Ceiling: neznámá výška');
  if (summary.clouds?.length) parts.push(`Oblačnost ${summary.clouds.map((cloud) => `${cloud.cover} ${cloud.baseFtAgl === null ? 'výška neznámá' : `${num(cloud.baseFtAgl)} ft AGL`}${cloud.type ? ` ${cloud.type}` : ''}`).join(', ')}`);
  if (finite(summary.temperature)) parts.push(`T ${num(summary.temperature, 1)} °C${finite(summary.dewpoint) ? ` / Td ${num(summary.dewpoint, 1)} °C` : ''}`);
  if (finite(summary.pressureHpa)) parts.push(`QNH ${num(summary.pressureHpa)} hPa`);
  if (summary.wx?.length) parts.push(summary.wx.map((wx) => `${wx.code} · ${wx.description}`).join(', '));
  return parts.length ? parts.join(' · ') : 'V této skupině nejsou shrnutelné položky; viz originální text.';
}

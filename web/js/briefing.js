const ZONES = new Set(['UTC', 'Europe/Prague']);
const formatters = new Map();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function instant(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function dateParts(ms, timezone) {
  if (!ZONES.has(timezone) || !Number.isFinite(ms)) return null;
  if (!formatters.has(timezone)) {
    formatters.set(timezone, new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return Object.fromEntries(formatters.get(timezone).formatToParts(new Date(ms))
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function utcFromParts(year, month, day, hour = 0, minute = 0, second = 0) {
  // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

export function formatNumber(value, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const places = Number.isInteger(digits) ? Math.max(0, Math.min(10, digits)) : 0;
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: places, maximumFractionDigits: places,
  }).format(Object.is(value, -0) ? 0 : value);
}

export function formatTime(iso, timezone = 'Europe/Prague', withDate = false) {
  const ms = instant(iso);
  const parts = ms === null ? null : dateParts(ms, timezone);
  if (!parts) return '—';
  const time = `${parts.hour}:${parts.minute}`;
  return withDate ? `${Number(parts.day)}.${Number(parts.month)}. ${time}` : time;
}

/** A future timestamp is visible; it is never silently clamped to zero age. */
export function ageLabel(iso, nowMs = Date.now()) {
  const ms = instant(iso);
  if (ms === null || !Number.isFinite(nowMs)) return 'čas nedostupný';
  const age = nowMs - ms;
  if (age < -5 * MINUTE) return 'budoucí čas';
  const future = age < 0;
  const distance = Math.abs(age);
  if (distance < MINUTE) return future ? 'za méně než min' : 'právě teď';
  const prefix = future ? 'za' : 'před';
  if (distance < HOUR) return `${prefix} ${Math.floor(distance / MINUTE)} min`;
  if (distance < DAY) return `${prefix} ${Math.floor(distance / HOUR)} h`;
  return `${prefix} ${Math.floor(distance / DAY)} d`;
}

/** Report availability and validity, never a flight-permission judgement. */
export function reportState(item, nowMs = Date.now()) {
  if (!item || typeof item !== 'object') return { label: 'Zpráva nedostupná', tone: 'warn' };
  const raw = typeof item.raw === 'string' ? item.raw : '';
  if (item.cancelled === true || /\bCNL\b/.test(raw)) return { label: 'CNL · zrušeno', tone: 'bad' };
  if (item.nil === true || /\bNIL\b/.test(raw)) return { label: 'NIL · nedostupné', tone: 'warn' };
  if (!raw.trim()) return { label: 'Zpráva nedostupná', tone: 'warn' };

  const observed = instant(item.observedAt);
  const issued = instant(item.issuedAt);
  const start = instant(item.validFrom);
  const end = instant(item.validTo);
  const reportTime = observed ?? issued;
  if (reportTime !== null && reportTime > nowMs + 5 * MINUTE) {
    return { label: 'Budoucí čas zprávy', tone: 'warn' };
  }
  if (start !== null && end !== null && end <= start) {
    return { label: 'Neplatný časový interval', tone: 'warn' };
  }
  if (end !== null && end <= nowMs) return { label: 'Po platnosti', tone: 'bad' };
  if (start !== null && start > nowMs) return { label: 'Platí později', tone: 'warn' };
  if (start !== null && end !== null) return { label: 'V platnosti', tone: 'neutral' };
  // A forecast without an explicit validity interval cannot be called valid.
  const forecast = /^taf:|^sigmet:/.test(item.id || '') ||
    item.kind === 'taf' || item.kind === 'sigmet' || /^TAF\b/.test(raw);
  if (forecast || start !== null || end !== null) {
    return { label: 'Platnost nedostupná', tone: 'warn' };
  }
  if (observed === null) return { label: 'Čas pozorování nedostupný', tone: 'warn' };
  return { label: ageLabel(item.observedAt, nowMs), tone: 'neutral' };
}

export function toDateTimeInput(iso, timezone = 'Europe/Prague') {
  const ms = instant(iso);
  const parts = ms === null ? null : dateParts(ms, timezone);
  return parts ? `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` : '';
}

/**
 * Resolve a minute-precision civil input to an absolute ISO instant.
 * Reject invalid dates and nonexistent Prague spring-transition times.
 * A repeated fall-transition time deliberately selects its earliest occurrence
 * (summer-time occurrence); consumers should explain that convention near input.
 */
export function fromDateTimeInput(value, timezone = 'Europe/Prague') {
  if (typeof value !== 'string' || !ZONES.has(timezone)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const naive = utcFromParts(year, month, day, hour, minute);
  // Reject overflowing dates (including February 29 outside leap years).
  if (toDateTimeInput(naive, 'UTC') !== value) return null;
  if (timezone === 'UTC') return new Date(naive).toISOString();

  const offsets = new Set();
  // Sampling both sides of the date captures both offsets at DST transitions.
  for (const delta of [-DAY, 0, DAY]) {
    const sample = naive + delta;
    const p = dateParts(sample, timezone);
    offsets.add(utcFromParts(+p.year, +p.month, +p.day, +p.hour, +p.minute, +p.second) - sample);
  }
  const candidates = [...offsets].map(offset => naive - offset)
    .filter(ms => toDateTimeInput(ms, timezone) === value).sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]).toISOString() : null;
}

function coordinate(value, min, max) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

/** Only recognized, valid URL fields are returned; coordinates form one pair. */
export function parseSharedState(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  const result = {};
  const lat = coordinate(params.get('lat'), -90, 90);
  const lon = coordinate(params.get('lon'), -180, 180);
  if (lat !== null && lon !== null) Object.assign(result, { lat, lon });
  const model = params.get('model');
  if (['aladin', 'icon', 'ecmwf'].includes(model)) result.model = model;
  const compare = params.get('compare');
  if (['aladin', 'icon', 'ecmwf'].includes(compare) && compare !== result.model) result.compare = compare;
  const timezone = params.get('timezone');
  if (ZONES.has(timezone)) result.timezone = timezone;
  const hours = params.get('hours');
  if (['24', '48', '72'].includes(hours)) result.hours = Number(hours);
  const time = params.get('time');
  if (time && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(time)) {
    const ms = instant(time);
    // Date.parse normalizes impossible dates in some engines; validate the
    // literal civil components before accepting an offset-bearing instant.
    if (ms !== null && fromDateTimeInput(time.slice(0, 16), 'UTC') !== null) result.time = new Date(ms).toISOString();
  }
  const name = params.get('name');
  if (name !== null) {
    const plain = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
    if (plain) result.name = plain;
  }
  return result;
}

export function haversineKm(aLat, aLon, bLat, bLon) {
  const values = [aLat, aLon, bLat, bLon];
  if (!values.every(value => typeof value === 'number' && Number.isFinite(value)) ||
      Math.abs(aLat) > 90 || Math.abs(bLat) > 90 || Math.abs(aLon) > 180 || Math.abs(bLon) > 180) return null;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

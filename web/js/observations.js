import { summarizeMetar } from './reports.js';

/** Actual station reports, never interpolated or relabelled as point weather. */
export function observationSeries(aviation, station, nowMs = Date.now()) {
  const byTime = new Map();
  for (const item of aviation?.metar?.history || []) {
    const time = Date.parse(item.observedAt);
    if (item.station !== station || !Number.isFinite(time) || time > nowMs + 300000 || item.nil || item.cancelled) continue;
    const old = byTime.get(time);
    if (!old || item.corrected || Date.parse(item.receivedAt || item.issuedAt) > Date.parse(old.receivedAt || old.issuedAt)) byTime.set(time, item);
  }
  const items = [...byTime.values()].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const summaries = items.map(summarizeMetar);
  return {
    station, items, times: items.map(item => item.observedAt),
    visibility: summaries.map(item => item.visibility?.metres ?? null),
    visibilityQualifiers: summaries.map(item => item.visibility?.qualifier ?? 'unknown'),
    ceiling: summaries.map(item => item.ceiling?.valueFtAgl ?? null),
    wind: summaries.map(item => item.wind?.speedKt ?? null),
    latest: summaries.at(-1) || null,
  };
}

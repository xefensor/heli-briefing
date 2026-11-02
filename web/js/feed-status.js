const HOUR = 60 * 60 * 1000;

function timestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

/** Transport/coverage summary only; bulletin age and validity are separate checks. */
export function summarizeFeedState(feed, { now = Date.now() } = {}) {
  const items = Array.isArray(feed?.items) ? feed.items : [];
  const retained = Boolean(feed?.restoredFromCache || feed?.status === 'stale' || feed?.transportStatus === 'stale'
    || items.some(item => item?.restoredFromCache || item?.transportStatus === 'stale'));
  const unavailable = !feed || feed.status === 'unavailable';
  const transportPartial = feed?.transportStatus === 'partial';
  const missing = Boolean(feed?.coverageComplete === false || feed?.coverageStatus === 'partial' || feed?.status === 'partial'
    || Array.isArray(feed?.missingStations) && feed.missingStations.length
    || Array.isArray(feed?.missingFirs) && feed.missingFirs.length);
  const retrievedAt = timestamp(feed?.retrievedAt), nowMs = timestamp(now);
  const old = !Number.isFinite(retrievedAt) || !Number.isFinite(nowMs) || nowMs - retrievedAt > HOUR;
  const label = unavailable ? 'Nedostupný zdroj'
    : retained ? 'Místní kopie · obnova nepotvrzena'
    : transportPartial ? 'Část obnovy selhala'
    : old ? 'Aktuálnost načtení neověřena'
    : missing ? 'Neúplné pokrytí'
    : 'Načteno';
  return { label, attention: unavailable || retained || transportPartial || old || missing, missing, retained, old, unavailable, transportPartial };
}

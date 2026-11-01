import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber, formatTime, ageLabel, reportState, toDateTimeInput,
  fromDateTimeInput, parseSharedState, sharedSearch, formatCoordinates, haversineKm,
} from '../web/js/briefing.js';

const now = Date.parse('2026-11-01T12:00:00Z');

test('formatting distinguishes zero and missing values', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(12.34, 1), '12,3');
  for (const value of [null, undefined, NaN, Infinity, '0']) assert.equal(formatNumber(value), '—');
  assert.equal(formatTime(null), '—');
  assert.equal(formatTime('bad'), '—');
});

test('time formatting uses explicit Prague summer/winter offsets', () => {
  assert.equal(formatTime('2026-06-21T12:34:00Z'), '14:34');
  assert.equal(formatTime('2026-12-21T12:34:00Z'), '13:34');
  assert.equal(formatTime('2026-12-21T12:34:00Z', 'UTC', true), '21.12. 12:34');
  assert.equal(toDateTimeInput('2026-10-24T23:30:00Z', 'Europe/Prague'), '2026-10-25T01:30');
  assert.equal(toDateTimeInput(null), '');
});

test('age labels show elapsed and future times without zero-clamping', () => {
  assert.equal(ageLabel('2026-11-01T11:48:00Z', now), 'před 12 min');
  assert.equal(ageLabel('2026-11-01T10:00:00Z', now), 'před 2 h');
  assert.equal(ageLabel('2026-11-01T12:03:00Z', now), 'za 3 min');
  assert.equal(ageLabel('2026-11-01T12:06:00Z', now), 'budoucí čas');
  assert.equal(ageLabel(null, now), 'čas nedostupný');
});

test('Prague datetime parsing rejects DST gap and selects earliest fall occurrence', () => {
  assert.equal(fromDateTimeInput('2026-03-29T02:30', 'Europe/Prague'), null);
  assert.equal(fromDateTimeInput('2026-03-29T03:30', 'Europe/Prague'), '2026-03-29T01:30:00.000Z');
  assert.equal(fromDateTimeInput('2026-10-25T02:30', 'Europe/Prague'), '2026-10-25T00:30:00.000Z');
  assert.equal(fromDateTimeInput('2026-10-25T03:30', 'Europe/Prague'), '2026-10-25T02:30:00.000Z');
});

test('datetime parsing validates leap days, field ranges and UTC round trips', () => {
  assert.equal(fromDateTimeInput('2024-02-29T12:34', 'UTC'), '2024-02-29T12:34:00.000Z');
  for (const value of ['2026-02-29T12:34', '2026-04-31T12:34', '2026-12-01T24:00', '2026-12-01T12:60', 'bad']) {
    assert.equal(fromDateTimeInput(value, 'UTC'), null);
  }
  const expected = '2026-06-21T12:34';
  assert.equal(toDateTimeInput(fromDateTimeInput(expected, 'Europe/Prague'), 'Europe/Prague'), expected);
});

test('NIL/CNL and expired or future TAFs keep distinct states', () => {
  const taf = { id: 'taf:LKPR:x', raw: 'TAF LKPR 011100Z 0112/0212 24005KT CAVOK',
    issuedAt: '2026-11-01T11:00:00Z', validFrom: '2026-11-01T12:00:00Z', validTo: '2026-11-02T12:00:00Z' };
  assert.equal(reportState(taf, now).label, 'V platnosti');
  assert.equal(reportState({ ...taf, cancelled: true }, now).label, 'CNL · zrušeno');
  assert.equal(reportState({ ...taf, raw: 'TAF LKPR NIL' }, now).label, 'NIL · nedostupné');
  assert.equal(reportState({ ...taf, validTo: '2026-11-01T12:00:00Z', validFrom: '2026-11-01T06:00:00Z' }, now).label, 'Po platnosti');
  assert.equal(reportState({ ...taf, validFrom: '2026-11-01T13:00:00Z' }, now).label, 'Platí později');
  assert.equal(reportState({ ...taf, validFrom: null, validTo: null }, now).label, 'Platnost nedostupná');
});

test('METAR state reports real observation age, missing time and future clock anomaly', () => {
  const metar = { id: 'metar:LKCS:x', raw: 'LKCS 011150Z 24005KT CAVOK', observedAt: '2026-11-01T11:50:00Z' };
  assert.deepEqual(reportState(metar, now), { label: 'před 10 min', tone: 'neutral' });
  assert.equal(reportState({ ...metar, observedAt: null }, now).label, 'Čas pozorování nedostupný');
  assert.equal(reportState({ ...metar, observedAt: '2026-11-01T12:06:00Z' }, now).label, 'Budoucí čas zprávy');
  assert.equal(reportState(null, now).tone, 'warn');
});

test('shared state accepts only validated fields and a coordinate pair', () => {
  const parsed = parseSharedState('?lat=0&lon=0&model=icon&timezone=UTC&hours=48&time=2026-11-01T12%3A00%3A00Z&name=Null%20Island&admin=true');
  assert.deepEqual(parsed, { lat: 0, lon: 0, model: 'icon', timezone: 'UTC', hours: 48,
    time: '2026-11-01T12:00:00.000Z', name: 'Null Island' });
  assert.deepEqual(parseSharedState('?lat=91&lon=14&model=invalid&timezone=bad&hours=100&time=invalid'), {});
  assert.deepEqual(parseSharedState('?lat=49&lon=&time=2026-02-29T12%3A00Z'), {});
  assert.equal(parseSharedState('?name=' + 'a'.repeat(150)).name.length, 100);
  assert.deepEqual(parseSharedState('?lat=NaN&lon=Infinity'), {});
});

test('haversine handles coincidence, geography, dateline and invalid coordinates', () => {
  assert.equal(haversineKm(49, 14, 49, 14), 0);
  const equatorDegree = haversineKm(0, 0, 0, 1);
  assert.ok(equatorDegree > 111 && equatorDegree < 112);
  assert.ok(haversineKm(0, 179.9, 0, -179.9) < 23);
  assert.equal(haversineKm(null, 14, 49, 14), null);
  assert.equal(haversineKm(91, 14, 49, 14), null);
});

test('shared comparison accepts supported models and omits self-comparison', () => {
  assert.deepEqual(parseSharedState('?model=aladin&compare=icon'), { model: 'aladin', compare: 'icon' });
  assert.deepEqual(parseSharedState('?model=ecmwf&compare=ecmwf'), { model: 'ecmwf' });
  assert.deepEqual(parseSharedState('?model=icon&compare=invalid'), { model: 'icon' });
  assert.deepEqual(parseSharedState('?model=invalid&compare=ecmwf'), { compare: 'ecmwf' });
  assert.deepEqual(parseSharedState('?compare='), {});
});

test('live navigation reloads without a pinned instant while preserving context', () => {
  const state = { lat: 48.9463, lon: 14.4294, name: 'Planá', model: 'icon', compare: 'ecmwf', hours: 72, timezone: 'UTC', time: '2026-11-01T12:00:00Z' };
  const live = parseSharedState(sharedSearch(state, { live: true }));
  assert.equal(live.time, undefined);
  assert.equal(live.model, state.model);
  assert.equal(live.compare, state.compare);
  assert.equal(live.hours, state.hours);
  assert.equal(live.lat, state.lat);
  assert.equal(live.timezone, state.timezone);
  const copied = parseSharedState(sharedSearch(state));
  assert.equal(copied.time, '2026-11-01T12:00:00.000Z');
  assert.deepEqual({ ...copied, time: undefined }, { ...live, time: undefined });
});

test('pinned links preserve the second repeated Prague hour as an absolute instant', () => {
  const state = { lat: 49, lon: 14, name: '<Bod & světlo>', model: 'aladin', compare: '', hours: 48, timezone: 'Europe/Prague', time: '2026-10-25T02:30:00+01:00' };
  const read = parseSharedState(sharedSearch(state));
  assert.equal(read.time, '2026-10-25T01:30:00.000Z');
  assert.equal(read.name, state.name);
});

test('coordinate labels retain the hemisphere without negative north/east labels', () => {
  assert.equal(formatCoordinates(-33.9, -70.7), '33.9000° S, 70.7000° W');
  assert.equal(formatCoordinates(0, 0), '0.0000° N, 0.0000° E');
  assert.equal(formatCoordinates(null, 14), '—');
  assert.equal(formatCoordinates(91, 14), '—');
});

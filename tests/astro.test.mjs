import test from 'node:test';
import assert from 'node:assert/strict';
import { getAstronomy, phaseLabel } from '../web/js/astro.js';

const base = { lat: 48.9463, lon: 14.4294 };
const at = (iso, location = base) => getAstronomy({ ...location, date: new Date(iso) });

test('Czech summer and winter daylight have realistic duration and event order', () => {
  const summer = at('2026-06-21T12:00:00Z');
  const winter = at('2026-12-21T12:00:00Z');
  assert.ok(summer.dayLengthHours > 15.8 && summer.dayLengthHours < 16.4);
  assert.ok(winter.dayLengthHours > 8 && winter.dayLengthHours < 8.5);
  for (const day of [summer, winter]) {
    const order = [day.dawn, day.sunrise, day.solarNoon, day.sunset, day.dusk];
    assert.ok(order.every(value => value instanceof Date && Number.isFinite(+value)));
    assert.ok(order.every((value, index) => index === 0 || value > order[index - 1]));
    assert.equal(day.alwaysUp, false);
    assert.equal(day.alwaysDown, false);
  }
});

test('same UTC date retains events while selected-instant positions change', () => {
  const morning = at('2026-06-21T06:00:00Z');
  const noon = at('2026-06-21T12:00:00Z');
  assert.equal(+morning.sunrise, +noon.sunrise);
  assert.equal(+morning.sunset, +noon.sunset);
  assert.notEqual(morning.sunAltitude, noon.sunAltitude);
  assert.notEqual(morning.moonAltitude, noon.moonAltitude);
  assert.notEqual(morning.moonPhase, noon.moonPhase);
  assert.equal(noon.dayTimeZone, 'UTC');
  assert.equal(noon.dayStart.toISOString(), '2026-06-21T00:00:00.000Z');
  assert.equal(noon.dayEnd.toISOString(), '2026-06-22T00:00:00.000Z');
});

test('UTC day selection remains explicit across Prague midnight and DST dates', () => {
  const date = at('2026-10-24T23:30:00Z'); // already Oct 25 in Prague
  assert.equal(date.dayStart.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(date.dayEnd - date.dayStart, 86_400_000);
  const next = at('2026-10-25T00:30:00Z');
  assert.equal(next.dayStart.toISOString(), '2026-10-25T00:00:00.000Z');
  assert.notEqual(+date.sunrise, +next.sunrise);
});

test('polar sun states keep absent events null instead of invented times', () => {
  const polar = { lat: 80, lon: 15 };
  const summer = at('2026-06-21T12:00:00Z', polar);
  const winter = at('2026-12-21T12:00:00Z', polar);
  assert.equal(summer.sunrise, null);
  assert.equal(summer.sunset, null);
  assert.equal(summer.alwaysUp, true);
  assert.equal(summer.alwaysDown, false);
  assert.equal(summer.dayLengthHours, 24);
  assert.equal(winter.sunrise, null);
  assert.equal(winter.sunset, null);
  assert.equal(winter.alwaysDown, true);
  assert.equal(winter.alwaysUp, false);
  assert.equal(winter.dayLengthHours, 0);
});

test('lunar values stay bounded and absent rise/set states are honest', () => {
  let absentEventFound = false;
  for (let day = 1; day <= 31; day++) {
    const result = at(`2026-01-${String(day).padStart(2, '0')}T12:00:00Z`);
    assert.ok(result.moonFraction >= 0 && result.moonFraction <= 1);
    assert.ok(result.moonPhase >= 0 && result.moonPhase < 1);
    assert.ok(result.moonAltitude >= -90 && result.moonAltitude <= 90);
    for (const event of [result.moonrise, result.moonset]) {
      if (event === null) { absentEventFound = true; continue; }
      assert.ok(event >= result.dayStart && event < result.dayEnd);
    }
    assert.ok(!(result.moonAlwaysUp && result.moonAlwaysDown));
  }
  assert.equal(absentEventFound, true, 'a missing event is expected over a lunar cycle');
});

test('phase names wrap and invalid inputs are rejected', () => {
  assert.equal(phaseLabel(0), 'nov');
  assert.equal(phaseLabel(1), 'nov');
  assert.equal(phaseLabel(0.5), 'úplněk');
  assert.equal(phaseLabel(null), 'neznámá fáze');
  assert.equal(phaseLabel(NaN), 'neznámá fáze');
  assert.throws(() => getAstronomy({ ...base, date: new Date('invalid') }), RangeError);
  assert.throws(() => getAstronomy({ lat: 91, lon: 14, date: new Date() }), RangeError);
  assert.throws(() => getAstronomy({ lat: null, lon: 14, date: new Date() }), RangeError);
});


test('two-day calculated profile preserves UTC chronology and selected-instant context',()=>{
 const a=at('2026-10-25T02:30:00Z');
 assert.equal(a.profile.times.length,97);
 assert.equal(a.profile.times[0],'2026-10-25T00:00:00.000Z');
 assert.equal(a.profile.times.at(-1),'2026-10-27T00:00:00.000Z');
 assert.equal(a.profile.sunAltitude[5],a.sunAltitude);
 assert.equal(a.profile.moonAltitude[5],a.moonAltitude);
 assert.ok(a.profile.sunAltitude.every(value=>Number.isFinite(value)&&Math.abs(value)<=90));
});

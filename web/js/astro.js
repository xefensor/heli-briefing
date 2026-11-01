import * as SunCalc from '../vendor/suncalc.js';

const HOUR_MS = 3_600_000;
const PHASE_NAMES = [
  'nov', 'dorůstající srpek', 'první čtvrť', 'dorůstající Měsíc',
  'úplněk', 'ubývající Měsíc', 'poslední čtvrť', 'ubývající srpek',
];

function validDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
}

function requireLocation(lat, lon) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError('Astronomický výpočet vyžaduje platnou zeměpisnou polohu.');
  }
}

/** Czech name of the nearest of the eight conventional lunar phases. */
export function phaseLabel(phase) {
  if (!Number.isFinite(phase) || phase < 0 || phase > 1) return 'neznámá fáze';
  return PHASE_NAMES[Math.round(phase * 8) % PHASE_NAMES.length];
}

/**
 * Calculated astronomy for the selected location and instant.
 *
 * Event times belong to the UTC calendar day containing `date`, independent of
 * the browser timezone. They are absolute Date instants; formatting them in
 * Europe/Prague does not change that day-selection convention. `dayTimeZone`
 * and day bounds make the convention explicit to consumers.
 *
 * Positions and phase use the selected instant, never the actual clock time.
 * SunCalc v2 angles are already degrees. Standard sunrise/sunset uses the
 * library's apparent horizon convention, with no observer-height correction.
 * Missing events remain null. Lunar disc illumination is not ground lighting.
 */
export function getAstronomy({ lat, lon, date = new Date() }) {
  requireLocation(lat, lon);
  if (!validDate(date)) throw new RangeError('Astronomický výpočet vyžaduje platný čas.');

  const instant = new Date(date.getTime());
  const dayStart = new Date(Date.UTC(
    instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate(),
  ));
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR_MS);
  const sunTimes = SunCalc.getTimes(instant, lat, lon, 0, 0);
  const moonTimes = SunCalc.getMoonTimes(instant, lat, lon, 0);
  const sunPosition = SunCalc.getPosition(instant, lat, lon);
  const moonPosition = SunCalc.getMoonPosition(instant, lat, lon);
  const moon = SunCalc.getMoonIllumination(instant);
  const sunrise = validDate(sunTimes.sunrise);
  const sunset = validDate(sunTimes.sunset);
  const alwaysUp = sunTimes.alwaysUp === true;
  const alwaysDown = sunTimes.alwaysDown === true;

  return {
    selectedInstant: instant,
    dayTimeZone: 'UTC',
    dayStart,
    dayEnd,
    dawn: validDate(sunTimes.dawn),
    sunrise,
    solarNoon: validDate(sunTimes.solarNoon),
    sunset,
    dusk: validDate(sunTimes.dusk),
    dayLengthHours: sunrise && sunset ? (sunset - sunrise) / HOUR_MS :
      alwaysUp ? 24 : alwaysDown ? 0 : null,
    sunAltitude: sunPosition.altitude,
    sunAzimuth: sunPosition.azimuth,
    moonAltitude: moonPosition.altitude,
    moonAzimuth: moonPosition.azimuth,
    moonFraction: moon.fraction,
    moonPhase: moon.phase,
    phaseLabel: phaseLabel(moon.phase),
    moonrise: validDate(moonTimes.rise),
    moonset: validDate(moonTimes.set),
    alwaysUp,
    alwaysDown,
    moonAlwaysUp: moonTimes.alwaysUp === true,
    moonAlwaysDown: moonTimes.alwaysDown === true,
    source: 'SunCalc 2.1.1 · místní astronomický výpočet',
  };
}

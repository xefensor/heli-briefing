import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVE_KEY, ARCHIVE_MAX_ITEMS, ArchiveError, createBriefingSnapshot, renderBriefingHtml, briefingFilename, listBriefings, saveBriefing, loadBriefing, deleteBriefing } from '../web/js/archive.js';

const state = { name: 'Planá · České Budějovice', lat: 48.9463, lon: 14.4294, model: 'aladin', compare: 'icon', time: '2026-11-01T14:30:00.000Z', hours: 24, timezone: 'UTC' };
const times = ['2026-11-01T14:00:00.000Z', '2026-11-01T15:00:00.000Z', '2026-11-01T16:00:00.000Z'];
function forecast(model = 'aladin') {
  return {
    model, label: model === 'aladin' ? 'ALADIN' : 'ICON-D2', provider: model === 'aladin' ? 'ČHMÚ · Open-Meteo' : 'DWD · Open-Meteo', requestedLocation: { lat: state.lat, lon: state.lon },
    grid: { lat: 48.95, lon: 14.43, elevation: 425 }, times: [...times],
    hourly: { wind: [0, 5, null], gust: [3, 8, null], visibility: [1000, null, 10000], cloudLow: [0, 100, null], temperature: [5, 6, null], dewpoint: [3, 5, null], pressure: [1025, 1024, null], precipitation: [0, 1.2, null], cloudMid: [10, 20, null], cloudHigh: [80, 50, null], wind925: [10, 12, null], height925: [780, 785, null], humidity: [70, 90, null] },
    retrievedAt: '2026-11-01T14:20:00.000Z', runTime: null, validFrom: times[0], validTo: times.at(-1),
    sourceUrl: 'https://api.open-meteo.com/v1/forecast?latitude=48.9463&apikey=SECRET_API_KEY&models=chmi_aladin_central_europe_2km',
    docsUrl: 'https://open-meteo.com/en/docs/chmi-api', transport: { status: 'live', stale: false },
  };
}
function aviation() {
  return {
    schemaVersion: 1, generatedAt: '2026-11-01T14:10:00.000Z',
    metar: { status: 'ok', retrievedAt: '2026-11-01T14:10:00.000Z', sourceUrl: 'https://aviationweather.gov/api/data/metar', items: [{ id: 'metar:LKPR:1', station: 'LKPR', observedAt: '2026-11-01T14:00:00.000Z', raw: 'METAR LKPR 011400Z 00000KT 9999 BKN012 08/02 Q1029', source: { wspd: 0, wdir: 0, temp: 8, dewp: 2, altim: 1029, clouds: [{ cover: 'BKN', base: 1200 }] } }], missingStations: ['LKCS'] },
    taf: { status: 'ok', retrievedAt: '2026-11-01T14:10:00.000Z', sourceUrl: 'https://aviationweather.gov/api/data/taf', items: [{ id: 'taf:LKPR:1', station: 'LKPR', issuedAt: '2026-11-01T11:00:00.000Z', validFrom: '2026-11-01T12:00:00.000Z', validTo: '2026-11-02T12:00:00.000Z', raw: 'TAF LKPR 011100Z 0112/0212 04007KT 9999 SCT016 BKN035 TEMPO 0118/0120 4000 BR BKN008', source: {} }] },
    sigmet: { status: 'empty', retrievedAt: '2026-11-01T14:10:00.000Z', sourceUrl: 'https://aviationweather.gov/api/data/sigmet', items: [] },
    radar: { status: 'ok', retrievedAt: '2026-11-01T14:10:00.000Z', observedAt: '2026-11-01T14:05:00.000Z', url: 'https://opendata.chmi.cz/radar.png' },
  };
}
const base = () => ({ state: { ...state }, forecast: forecast(), comparison: forecast('icon'), aviation: aviation(), astronomy: { dawn: new Date('2026-11-01T05:16:00Z'), sunrise: new Date('2026-11-01T05:49:00Z'), sunset: new Date('2026-11-01T15:41:00Z'), dusk: new Date('2026-11-01T16:15:00Z'), dayStart: new Date('2026-11-01T00:00:00Z'), selectedInstant: new Date(state.time), dayLengthHours: 9.9, sunAltitude: 11.3, moonAltitude: -7, moonFraction: 0.5, phaseLabel: 'poslední čtvrť', source: 'SunCalc' }, notes: 'Nízká oblačnost.\nOvěřit lokální situaci.', createdAt: '2026-11-01T14:30:10.000Z' });
function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

test('snapshot is immutable, preserves null/zero and source times instead of creation time', () => {
  const input = base();
  const snapshot = createBriefingSnapshot(input);
  input.forecast.hourly.wind[0] = 40;
  input.aviation.metar.items[0].raw = 'changed';
  input.astronomy.sunrise.setUTCFullYear(2030);
  assert.equal(snapshot.forecast.hourly.wind[0], 0);
  assert.equal(snapshot.forecast.hourly.wind[2], null);
  assert.equal(snapshot.forecast.runTime, null);
  assert.equal(snapshot.forecast.retrievedAt, '2026-11-01T14:20:00.000Z');
  assert.equal(snapshot.aviation.radar.observedAt, '2026-11-01T14:05:00.000Z');
  assert.equal(snapshot.astronomy.sunrise, '2026-11-01T05:49:00.000Z');
  assert.throws(() => { snapshot.forecast.hourly.wind[0] = 10; }, TypeError);
});

test('snapshot rejects mismatched place/model and malformed context or time axes', () => {
  let input = base(); input.forecast.requestedLocation.lat = 49;
  assert.throws(() => createBriefingSnapshot(input), (error) => error instanceof ArchiveError && error.code === 'context');
  input = base(); input.forecast.model = 'icon';
  assert.throws(() => createBriefingSnapshot(input), /modelu/);
  input = base(); input.state.lat = 91;
  assert.throws(() => createBriefingSnapshot(input), /platné místo/);
  input = base(); input.state.time = 'bad';
  assert.throws(() => createBriefingSnapshot(input), /neplatný čas/);
  input = base(); input.forecast.times.reverse();
  assert.throws(() => createBriefingSnapshot(input), /uspořádaná/);
});

test('frozen HTML embeds charts, all forecasts, reports, astronomy, notes and no live resources', () => {
  const snapshot = createBriefingSnapshot(base());
  const html = renderBriefingHtml(snapshot);
  assert.equal((html.match(/<svg\b/g) || []).length, 8);
  assert.match(html, /Přesné hodnoty · ALADIN/);
  assert.match(html, /Přesné hodnoty · ICON-D2/);
  assert.match(html, /METAR LKPR 011400Z 00000KT 9999 BKN012/);
  assert.match(html, /TAF LKPR 011100Z/);
  assert.match(html, /nízká|Nízká/);
  assert.match(html, /SunCalc/);
  assert.match(html, /01T|1\.11\./);
  assert.match(html, /sám se neaktualizuje/);
  assert.doesNotMatch(html, /<script\b|<iframe\b|<link\b|<img[^>]+src=["']https?:|\bonclick=/i);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /nejsou v tomto souboru vložené/);
});

test('notes, labels and report text cannot inject HTML; provider credentials are stripped', () => {
  const input = base();
  input.notes = '</style><img src=x onerror=alert(1)><script>alert(1)</script>';
  input.state.name = '<svg onload=alert(1)>';
  input.aviation.metar.items[0].raw += '</pre><script>leak()</script>';
  input.forecast.authorization = 'SECRET_AUTH';
  const snapshot = createBriefingSnapshot(input);
  const html = renderBriefingHtml(snapshot);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;\/pre&gt;&lt;script&gt;leak/);
  assert.doesNotMatch(html, /<script\b|<img src=x|<svg onload|SECRET_API_KEY|SECRET_AUTH/i);
  assert.equal(snapshot.forecast.authorization, undefined);
  assert.match(snapshot.forecast.sourceUrl, /models=/);
  assert.doesNotMatch(snapshot.forecast.sourceUrl, /apikey/i);
});

test('missing datasets and failed/stale products stay explicit in export', () => {
  const input = base(); input.forecast = null; input.comparison = null; input.aviation.sigmet = { status: 'unavailable', retrievedAt: null, error: 'upstream failure', items: [] };
  const html = renderBriefingHtml(createBriefingSnapshot(input));
  assert.match(html, /Předpověď v okamžiku uložení nebyla dostupná/);
  assert.match(html, /Aktuálnost zdroje nebyla při uložení potvrzena/);
  assert.match(html, /upstream failure/);
  assert.doesNotMatch(html, /VFR|CAVOK/);
});

test('archive retains at most ten snapshots and returns separate immutable loaded data', () => {
  const storage = memoryStorage();
  assert.deepEqual(listBriefings(storage), []);
  for (let index = 0; index < 12; index += 1) saveBriefing(createBriefingSnapshot({ ...base(), createdAt: `2026-11-01T14:${String(index).padStart(2, '0')}:00.000Z` }), storage);
  const records = listBriefings(storage);
  assert.equal(records.length, ARCHIVE_MAX_ITEMS);
  assert.equal(records[0].createdAt, '2026-11-01T14:11:00.000Z');
  assert.equal(records.at(-1).createdAt, '2026-11-01T14:02:00.000Z');
  const loaded = loadBriefing(records[0].id, storage);
  assert.equal(loaded.forecast.hourly.wind[0], 0);
  assert.throws(() => { loaded.notes = 'mutate'; }, TypeError);
  records[0].state.name = 'mutated metadata';
  assert.equal(loadBriefing(loaded.id, storage).state.name, state.name);
  assert.equal(deleteBriefing(loaded.id, storage).length, 9);
  assert.equal(loadBriefing(loaded.id, storage), null);
});

test('archive corruption and blocked/quota writes are explicit and do not overwrite old data', () => {
  const storage = memoryStorage();
  storage.setItem(ARCHIVE_KEY, '{broken');
  assert.throws(() => saveBriefing(createBriefingSnapshot(base()), storage), (error) => error.code === 'corrupt');
  assert.equal(storage.getItem(ARCHIVE_KEY), '{broken');
  const quota = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  assert.throws(() => saveBriefing(createBriefingSnapshot(base()), quota), (error) => error.code === 'storage-write');
  const blocked = { getItem: () => { throw new Error('SecurityError'); } };
  assert.throws(() => listBriefings(blocked), (error) => error.code === 'storage');
});

test('byte budget evicts older snapshots and rejects an oversized single record without overwrite', () => {
  const storage = memoryStorage();
  for (let index = 0; index < 4; index += 1) {
    saveBriefing(createBriefingSnapshot({ ...base(), notes: 'x'.repeat(700_000), createdAt: `2026-11-01T14:0${index}:00.000Z` }), storage);
  }
  const before = storage.getItem(ARCHIVE_KEY);
  assert.equal(listBriefings(storage).length, 3);
  assert.ok(before.length * 2 <= 5_000_000);
  const huge = createBriefingSnapshot({ ...base(), notes: 'x'.repeat(2_600_000) });
  assert.throws(() => saveBriefing(huge, storage), (error) => error.code === 'too-large');
  assert.equal(storage.getItem(ARCHIVE_KEY), before);
});

test('saved file names are plain safe paths and invalid raster content is not embedded', () => {
  const input = base(); input.state.name = '../../Planá / <test>'; input.radarImageDataUrl = 'data:image/svg+xml,<svg onload=alert(1)>';
  const snapshot = createBriefingSnapshot(input);
  const name = briefingFilename(snapshot);
  assert.match(name, /^heli-briefing-[a-z\d-]+-202611011430Z\.html$/);
  assert.doesNotMatch(name, /\.\.|\/|<|>/);
  assert.equal(snapshot.radarImageDataUrl, null);
});

test('independent native cloud export preserves ICON-D2 run, sample, MSL units and missing values', () => {
  const input = base();
  input.clouds = {
    status: 'available', valueMsl: 960, model: 'ICON-D2', product: 'CEILING', units: 'm MSL',
    cell: { lat: 48.947, lon: 14.425, elevationMsl: 424 }, distanceKm: 0.4,
    validAt: times[0], runTime: '2026-11-01T12:00:00.000Z', retrievedAt: '2026-11-01T14:25:00.000Z',
    sourceUrl: 'https://opendata.dwd.de/weather/nwp/CEILING/test.grib2.bz2',
    stale: true, error: 'Část běhu není dostupná.', series: { times, values: [960, null, 0] },
  };
  const snapshot = createBriefingSnapshot(input);
  const html = renderBriefingHtml(snapshot);
  assert.equal(snapshot.clouds.series.values[1], null);
  assert.equal(snapshot.clouds.series.values[2], 0);
  assert.equal(snapshot.clouds.runTime, '2026-11-01T12:00:00.000Z');
  assert.match(html, /DWD ICON-D2 CEILING/);
  assert.match(html, /960 m MSL/);
  assert.match(html, /nikoli AGL/);
  assert.match(html, /povrchové předpovědi ALADIN/);
  assert.match(html, /1\.11\.2026 12:00 UTC/);
  assert.match(html, /Část běhu není dostupná/);
  assert.equal((html.match(/<svg\b/g) || []).length, 9);
  assert.doesNotMatch(html, /960 ft AGL/);
});

test('history export renders real station observations with bounded visibility and null ceiling', () => {
  const input = base();
  const first = input.aviation.metar.items[0];
  input.aviation.metar.history = [
    { ...first, id: 'metar:LKPR:older', observedAt: '2026-11-01T13:00:00.000Z', raw: 'METAR LKPR 011300Z VRB02KT 4000 BR SCT006 07/06 Q1029', source: { wspd: 2, temp: 7, dewp: 6, clouds: [{ cover: 'SCT', base: 600 }] } },
    first,
  ];
  input.aviation.metar.historyStatus = 'stale';
  input.aviation.metar.historyRetrievedAt = '2026-11-01T14:10:00.000Z';
  input.aviation.metar.historyHours = 12;
  input.aviation.metar.historyError = 'Chyba obnovy historie';
  const html = renderBriefingHtml(createBriefingSnapshot(input));
  assert.match(html, /Historie pozorování METAR · 12 h/);
  assert.match(html, /LKPR · 2 skutečných pozorování/);
  assert.match(html, /Ceiling · ft AGL/);
  assert.match(html, /1\.11\.2026 13:00 UTC/);
  assert.match(html, /Chyba obnovy historie/);
  assert.match(html, /Mezi pozorováními nejsou dopočítána data/);
  assert.match(html, /nenahlášen/);
  assert.match(html, /≥|&gt;=/);
});

test('embedded radar is a genuine PNG data URL with its own saved observation time', () => {
  const input = base();
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6g0gAAAAASUVORK5CYII=';
  input.radarImageDataUrl = png;
  input.aviation.radar.imageDataUrl = png;
  input.aviation.radar.imageObservedAt = input.aviation.radar.observedAt;
  input.aviation.radar.imageUrl = input.aviation.radar.url;
  const snapshot = createBriefingSnapshot(input);
  const html = renderBriefingHtml(snapshot);
  assert.equal(snapshot.aviation.radar.imageDataUrl, undefined);
  assert.equal(snapshot.radarImageDataUrl, png);
  assert.match(html, /Vložený snímek: 1\.11\.2026 14:05 UTC/);
  assert.ok(html.includes(`src="${png}"`));
  assert.equal((html.match(/data:image\/png;base64/g) || []).length, 1);
  input.radarImageDataUrl = 'data:image/png;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+';
  assert.equal(createBriefingSnapshot(input).radarImageDataUrl, null);
});

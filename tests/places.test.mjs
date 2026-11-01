import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACE_KEY, MAX_PLACES, normalizePlace, readPlaces, savePlace, removePlace } from '../web/js/places.js';
const point = { name: 'Pracovní bod', lat: 48.9463, lon: 14.4294 };
function storage(initial = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, PLACE_KEY); raw = value; } };
}
test('decimal Czech input is accepted, numeric zero retained and unsafe coercions rejected', () => {
  assert.equal(normalizePlace({ ...point, lat: '48,94630', lon: '+14.4294' }).lat, point.lat);
  assert.equal(normalizePlace({ ...point, lat: 0, lon: '0' }).lon, 0);
  for (const lat of ['', ' ', null, false, [], Infinity, '0x31', '48 56', 90.01]) assert.equal(normalizePlace({ ...point, lat }), null);
  assert.equal(normalizePlace({ ...point, lon: -180.01 }), null);
  assert.equal(normalizePlace({ ...point, name: '\n\t' }), null);
});
test('local points persist only named coordinates and update duplicates without growing the list', () => {
  const db = storage();
  assert.equal(savePlace(db, { ...point, model: 'icon', time: 'old', weather: 5 }).ok, true);
  assert.equal(savePlace(db, { ...point, name: 'Nový název' }).places.length, 1);
  const saved = readPlaces(db).places[0];
  assert.deepEqual(Object.keys(saved).sort(), ['id', 'lat', 'lon', 'name']);
  assert.equal(saved.name, 'Nový název');
});
test('editing coordinates replaces the original point but cannot overwrite a different saved point', () => {
  const db = storage();
  const first = savePlace(db, point).places[0];
  savePlace(db, { ...point, lat: 49 });
  const before = db.getItem();
  assert.equal(savePlace(db, { ...point, lat: 49 }, first.id).ok, false);
  assert.equal(db.getItem(), before);
  assert.equal(savePlace(db, { ...point, lat: 50 }, first.id).places.length, 2);
  assert.equal(savePlace(db, point, first.id).ok, false);
});
test('full collection refuses a new point without evicting existing locations', () => {
  const db = storage();
  for (let lat = 0; lat < MAX_PLACES; lat++) assert.equal(savePlace(db, { ...point, lat }).ok, true);
  const before = db.getItem();
  assert.equal(savePlace(db, { ...point, lat: 30 }).ok, false);
  assert.equal(db.getItem(), before);
});
test('invalid, future-version and duplicate stored records remain untouched', () => {
  for (const raw of ['invalid', '{"schemaVersion":2,"places":[]}', JSON.stringify({ schemaVersion: 1, places: [point, point] }), JSON.stringify({ schemaVersion: 1, places: [{ ...point, lat: null }] })]) {
    const db = storage(raw);
    assert.equal(readPlaces(db).ok, false);
    assert.equal(savePlace(db, point).ok, false);
    assert.equal(db.getItem(), raw);
  }
});
test('storage denial and write quota failures report failure, never a successful save', () => {
  assert.equal(readPlaces({ getItem() { throw new Error('blocked'); } }).ok, false);
  const db = storage();
  db.setItem = () => { throw new Error('quota'); };
  assert.equal(savePlace(db, point).ok, false);
  assert.equal(db.getItem(), null);
});
test('removal returns an exact point for undo and does not affect other points', () => {
  const db = storage();
  const first = savePlace(db, point).places[0];
  savePlace(db, { ...point, lat: 49 });
  const removed = removePlace(db, first.id);
  assert.deepEqual(removed.removed, first);
  assert.equal(removed.places.length, 1);
  assert.equal(savePlace(db, removed.removed).places.length, 2);
  assert.equal(removePlace(db, 'missing').ok, false);
});

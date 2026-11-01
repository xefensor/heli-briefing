// User-named coordinates only: no provider data, weather or inspection times.
export const PLACE_KEY = 'heli-places-v1';
export const MAX_PLACES = 20;
const fail = message => ({ ok: false, message });
export function normalizePlace(value) {
  if (!value || typeof value !== 'object') return null;
  const name = typeof value.name === 'string' ? value.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) : '';
  const number = input => typeof input === 'number' ? input : typeof input === 'string' && /^[-+]?\d+(?:[.,]\d+)?$/.test(input.trim()) ? Number(input.trim().replace(',', '.')) : NaN;
  const lat = number(value.lat), lon = number(value.lon);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const point = { name, lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
  return { ...point, id: placeId(point) };
}
export function placeId(point) { return `point:${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`; }
export function readPlaces(storage) {
  try {
    const raw = storage.getItem(PLACE_KEY);
    if (raw === null) return { ok: true, places: [] };
    if (raw.length > 64_000) return fail('Uložená místa nelze přečíst. Původní záznam nebyl přepsán.');
    const data = JSON.parse(raw);
    if (data?.schemaVersion !== 1 || !Array.isArray(data.places) || data.places.length > MAX_PLACES) throw new Error();
    const places = data.places.map(normalizePlace);
    if (places.some(point => !point) || new Set(places.map(point => point.id)).size !== places.length) throw new Error();
    return { ok: true, places };
  } catch { return fail('Místní úložiště není dostupné nebo obsahuje nečitelná místa. Nic nebylo přepsáno; bod můžeš použít bez uložení.'); }
}
function writePlaces(storage, places) {
  try { storage.setItem(PLACE_KEY, JSON.stringify({ schemaVersion: 1, places })); return { ok: true, places }; }
  catch { return fail('Bod se nepodařilo uložit do tohoto prohlížeče. Můžeš jej použít bez uložení.'); }
}
export function savePlace(storage, value, previousId = null) {
  const point = normalizePlace(value);
  if (!point) return fail('Zadej název a platné souřadnice ve stupních (šířka −90 až 90, délka −180 až 180).');
  const read = readPlaces(storage);
  if (!read.ok) return read;
  const places = [...read.places];
  const index = places.findIndex(item => item.id === (previousId || point.id));
  if (previousId && index < 0) return fail('Upravovaný bod už není uložen. Znovu otevři jeho úpravu.');
  if (places.some((item, i) => item.id === point.id && i !== index)) return fail('Na těchto souřadnicích už máš uložený jiný bod. Uprav jej v seznamu.');
  if (index < 0 && places.length >= MAX_PLACES) return fail(`Je uloženo všech ${MAX_PLACES} bodů. Před přidáním odeber některý ze seznamu.`);
  if (index < 0) places.push(point); else places[index] = point;
  return writePlaces(storage, places);
}
export function removePlace(storage, id) {
  const read = readPlaces(storage);
  if (!read.ok) return read;
  const removed = read.places.find(point => point.id === id);
  if (!removed) return fail('Bod už není uložen.');
  const result = writePlaces(storage, read.places.filter(point => point.id !== id));
  return result.ok ? { ...result, removed } : result;
}

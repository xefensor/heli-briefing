import { normalizePlace, placeId, readPlaces, savePlace, removePlace } from './places.js';

export function mountPlaceControls({ getCurrent, onChoose }) {
  const $ = id => document.getElementById(id);
  const select = $('location'), dialog = $('places-dialog'), form = $('place-form');
  // Keep disabled/private storage failure inside the adapter, including its getter.
  const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
  let editingId = null, removed = null, signature = null;
  function feedback(message = '') { $('places-feedback').textContent = message; }
  function fill(point, id = null) {
    editingId = id;
    $('point-name').value = point.name;
    $('point-lat').value = String(point.lat);
    $('point-lon').value = String(point.lon);
    $('place-save').textContent = id ? 'Uložit změny a použít' : 'Uložit a použít';
  }
  function update() {
    const result = readPlaces(storage), points = result.ok ? result.places : [];
    const next = JSON.stringify(points);
    if (next !== signature) {
      const group = $('saved-places');
      group.replaceChildren(...points.map(point => new Option(point.name, point.id)));
      group.hidden = points.length === 0;
      signature = next;
    }
    const current = getCurrent(), saved = points.find(point => point.id === placeId(current) && point.name === current.name);
    select.querySelector('[value="custom"]').hidden = Boolean(saved) || current.place !== 'custom';
    select.querySelector('[value="custom"]').textContent = current.name;
    select.value = saved?.id || current.place;
  }
  function renderList() {
    const result = readPlaces(storage);
    const list = $('places-list');
    list.replaceChildren();
    if (!result.ok) { feedback(result.message); return; }
    $('places-count').textContent = `${result.places.length} / 20 bodů · jen v tomto prohlížeči`;
    if (!result.places.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Zatím nemáš uložený žádný vlastní bod.'; list.append(p); }
    for (const point of result.places) {
      const row = document.createElement('div'); row.className = 'saved-point';
      const text = document.createElement('div'), name = document.createElement('strong'), coords = document.createElement('small');
      name.textContent = point.name; coords.textContent = `${point.lat.toFixed(5)}°, ${point.lon.toFixed(5)}°`;
      text.append(name, coords);
      const actions = document.createElement('div'); actions.className = 'saved-point-actions';
      for (const [label, action] of [['Použít', () => { onChoose(point.lat, point.lon, point.name); dialog.close(); }], ['Upravit', () => { fill(point, point.id); feedback('Uprav název nebo souřadnice a ulož změny.'); $('point-name').focus(); }], ['Odebrat', () => {
        const result = removePlace(storage, point.id);
        if (result.ok) { removed = result.removed; $('place-undo').hidden = false; if (editingId === point.id) fill(getCurrent()); renderList(); update(); $('place-undo').focus(); }
        feedback(result.ok ? `Bod „${point.name}“ byl odebrán. Můžeš jej vrátit.` : result.message);
      }]]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'button button-quiet'; button.textContent = label;
        button.setAttribute('aria-label', `${label} bod ${point.name}`); button.addEventListener('click', action); actions.append(button);
      }
      row.append(text, actions); list.append(row);
    }
  }
  function open() { fill(getCurrent(), readPlaces(storage).places?.find(point => point.id === placeId(getCurrent()))?.id || null); feedback(); removed = null; $('place-undo').hidden = true; renderList(); dialog.showModal(); }
  $('places-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', update);
  $('place-current').addEventListener('click', () => { fill(getCurrent()); feedback('Vybraný bod načten do formuláře.'); });
  $('place-undo').addEventListener('click', () => {
    if (!removed) return;
    const result = savePlace(storage, removed);
    if (result.ok) { removed = null; $('place-undo').hidden = true; renderList(); update(); $('point-name').focus(); }
    feedback(result.ok ? 'Bod byl vrácen.' : result.message);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const point = normalizePlace({ name: $('point-name').value, lat: $('point-lat').value, lon: $('point-lon').value });
    if (!point) { feedback('Vyplň název a platné souřadnice. Použij desetinné stupně, například 48,94630 a 14,42940.'); return; }
    if (event.submitter?.id === 'place-save') {
      const result = savePlace(storage, point, editingId);
      if (!result.ok) { feedback(result.message); return; }
      update();
    }
    onChoose(point.lat, point.lon, point.name); dialog.close();
  });
  window.addEventListener('storage', () => { update(); if (dialog.open) renderList(); });
  return { update, open, choose(id) {
    const point = readPlaces(storage).places?.find(point => point.id === id);
    if (point) onChoose(point.lat, point.lon, point.name); else update();
  } };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNativeCeilingMap, validateNativeCeilingRegional, nativeCeilingColour } from '../web/js/native-ceiling-map.js';

function field() {
  return { model: 'ICON-EU', product: 'CEILING', units: 'm MSL', gridUuid: '832c1507fbc73eb384139890094d2c60',
    runTime: '2026-11-02T00:00:00Z', validAt: '2026-11-02T12:00:00Z', retrievedAt: '2026-11-02T11:30:00Z',
    bounds: [[48, 13], [50, 16]], totalCells: 4, subset: false,
    nodes: [{ lat: 48.5, lon: 13.5, index: 1, valueMsl: 0 }, { lat: 49, lon: 14, index: 2, valueMsl: null },
      { lat: 49.5, lon: 15, index: 3, valueMsl: 1500 }, { lat: 48.9, lon: 14.45, index: 4, valueMsl: 3750 }],
    selectedCell: { lat: 48.9, lon: 14.45, index: 4, valueMsl: 3750 } };
}

test('regional map renders actual native centres, numeric zero and null gaps without creating coverage', () => {
  const data = field(); validateNativeCeilingRegional(data);
  const html = renderNativeCeilingMap(data, { lat: 48.9464, lon: 14.4275, timezone: 'UTC', width: 720 });
  assert.equal((html.match(/class="native-ceiling-node"/g) || []).length, 3);
  assert.equal((html.match(/native-ceiling-node--missing/g) || []).length, 1);
  assert.match(html, /0 m MSL/); assert.match(html, /hodnota chybí/);
  assert.match(html, /4 \/ 4 skutečných buněk/);
  assert.match(html, /native-ceiling-selected-cell/); assert.match(html, /native-ceiling-selected-location/);
  assert.match(html, /bez konvektivní složky/); assert.match(html, /nikoli AGL/);
  assert.match(html, /2\. 11\. 2026 12:00 UTC/);
  assert.doesNotMatch(html, /<polygon|<image|<img|<iframe|src=|href=|javascript:|ICON-D2/);
});

test('native geometry and provenance validation rejects mismatched fields, indices, quantities and dates', () => {
  for (const mutate of [
    d => { d.model = 'ICON-D2'; }, d => { d.units = 'm AGL'; }, d => { d.product = 'CLCL'; },
    d => { d.gridUuid = '<script>'; }, d => { d.bounds = [[50, 13], [48, 16]]; },
    d => { d.bounds[0][0] = NaN; }, d => { d.nodes[0].lat = 47; },
    d => { d.nodes[1].index = 1; }, d => { d.nodes[0].valueMsl = NaN; },
    d => { d.nodes[0].valueMsl = undefined; }, d => { d.nodes[0].valueMsl = 2e38; },
    d => { d.validAt = '2026-02-31T12:00:00Z'; }, d => { d.validAt = '2026-11-01T12:00:00Z'; },
    d => { d.totalCells = 2; }, d => { d.totalCells = 5; },
    d => { d.selectedCell.lat = 51; },
  ]) {
    const data = field(); mutate(data);
    assert.throws(() => validateNativeCeilingRegional(data), /ověřitelný/);
    const html = renderNativeCeilingMap(data);
    assert.match(html, /není pro tento čas dostupné/); assert.doesNotMatch(html, /<svg|<script/);
  }
});

test('an actual subset remains explicitly incomplete and never gains invented cells', () => {
  const data = field(); data.totalCells = 20; data.subset = true;
  const html = renderNativeCeilingMap(data, { lat: 46, lon: 12 });
  assert.equal((html.match(/data-cell-index=/g) || []).length, 4);
  assert.match(html, /4 \/ 20/); assert.match(html, /podvýběr skutečných středů, bez interpolace/);
  assert.match(html, /Vybraný bod leží mimo/);
  assert.doesNotMatch(html, /class="native-ceiling-selected-location"/);
});

test('mobile axes retain native text size and malformed geometry cannot produce unsafe SVG', () => {
  const data = field();
  const html = renderNativeCeilingMap(data, { width: 305, timezone: 'UTC', idPrefix: '"><script>alert(1)</script>' });
  assert.match(html, /viewBox="0 0 305 330"/);
  assert.match(html, /font-size="12"/);
  assert.match(html, /aria-labelledby="native-ceiling-map-title native-ceiling-map-title-description"/);
  assert.doesNotMatch(html, /<script|alert\(1\)|NaN|Infinity/);
  assert.equal(nativeCeilingColour(null), null); assert.equal(nativeCeilingColour(NaN), null);
  assert.notEqual(nativeCeilingColour(0), nativeCeilingColour(3750));
});

test('an empty true crop and unknown point do not create a selected model sample', () => {
  const empty = field(); empty.nodes = []; empty.totalCells = 0; delete empty.selectedCell;
  assert.match(renderNativeCeilingMap(empty), /není pro tento čas dostupné/);
  const data = field(); delete data.selectedCell;
  const html = renderNativeCeilingMap(data, { lat: 48.95, lon: 14.43 });
  assert.match(html, /native-ceiling-selected-location/); assert.doesNotMatch(html, /native-ceiling-selected-cell/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeProcessedGeoTiff, rasterCell, cropRaster } from '../web/js/processed-geotiff.js';
import { fixtureTiff, fixtureCell, changeTiffTag } from './processed-geotiff-fixtures.mjs';

test('processed GeoTIFF preserves tiled float values, real zero and NaN in either byte order', async () => {
  for (const littleEndian of [true, false]) {
    const values = Array.from({ length: 40 * 35 }, (_, i) => i === 0 ? 0 : i === 36 ? NaN : i / 4);
    const decoded = await decodeProcessedGeoTiff(fixtureTiff({ width: 40, height: 35, values, littleEndian }));
    assert.equal(decoded.width, 40); assert.equal(decoded.height, 35);
    assert.ok(decoded.values instanceof Float32Array);
    assert.equal(decoded.grid.crs, 'EPSG:3857'); assert.equal(decoded.grid.type, 'processed-raster');
    assert.equal(decoded.values[0], 0); assert.ok(Number.isNaN(decoded.values[36]));
    assert.equal(decoded.values.at(-1), values.at(-1));
    assert.deepEqual(Array.from(decoded.values), values);
  }
});

test('raster query uses its projected pixel centre and preserves missing as null', async () => {
  const raster = await decodeProcessedGeoTiff(fixtureTiff());
  const p = fixtureCell(0, 0), cell = rasterCell(raster, p.lat, p.lon);
  assert.equal(cell.index, 0); assert.equal(cell.row, 0); assert.equal(cell.col, 0); assert.equal(cell.valueAglFt, 0);
  assert.ok(Math.abs(cell.lat - p.lat) < 1e-8); assert.ok(Math.abs(cell.lon - p.lon) < 1e-8); assert.ok(cell.distanceKm < 1e-5);
  const missing = fixtureCell(0, 2); assert.equal(rasterCell(raster, missing.lat, missing.lon).valueAglFt, null);
  assert.equal(rasterCell(raster, 80, 0), null);
});

test('regional crop contains actual raster indices and declares bounded sampling', async () => {
  const raster = await decodeProcessedGeoTiff(fixtureTiff({ width: 40, height: 35 }));
  const p = fixtureCell(13, 17), crop = cropRaster(raster, p.lat, p.lon, { maxCells: 19, latRadius: 2, lonRadius: 2 });
  assert.equal(crop.totalCells, 1400); assert.ok(crop.nodes.length <= 19); assert.equal(crop.subset, true);
  assert.ok(crop.nodes.some(x => x.index === 13 * 40 + 17));
  for (const cell of crop.nodes) {
    const expected = fixtureCell(cell.row, cell.col);
    assert.equal(cell.index, cell.row * 40 + cell.col);
    assert.ok(Math.abs(cell.lat - expected.lat) < 1e-8); assert.ok(Math.abs(cell.lon - expected.lon) < 1e-8);
    assert.equal(cell.valueAglFt, Number.isFinite(raster.values[cell.index]) ? raster.values[cell.index] : null);
  }
});

test('GeoTIFF reader refuses unsupported interpretation, malformed offsets and oversized geometry', async () => {
  for (const options of [{ compression: 5 }, { predictor: 3 }, { sampleFormat: 1 }, { crs: 4326 }, { pixelIsArea: 2 }, { nodata: '-9999' }, { bits: 16 }, { samples: 2 }, { magic: 43 }]) {
    await assert.rejects(decodeProcessedGeoTiff(fixtureTiff(options)));
  }
  for (const value of [Infinity, -1, 200001]) {
    await assert.rejects(decodeProcessedGeoTiff(fixtureTiff({ values: [value, ...Array(15).fill(100)] })));
  }
  const fixture = fixtureTiff();
  for (const broken of [fixture.subarray(0, 10), changeTiffTag(fixture, 256, { value: 2_000_001 }), changeTiffTag(fixture, 324, { value: 0xffffffff }), changeTiffTag(fixture, 325, { value: 0xffffffff }), changeTiffTag(fixture, 33550, { value: 0xffffffff })]) {
    await assert.rejects(decodeProcessedGeoTiff(broken));
  }
  const checksum = fixture.slice(); checksum[checksum.length - 1] ^= 255;
  await assert.rejects(decodeProcessedGeoTiff(checksum));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(decodeProcessedGeoTiff(fixture, { signal: controller.signal }), { name: 'AbortError' });
});

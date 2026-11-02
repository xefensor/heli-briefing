import { deflateSync } from 'node:zlib';

const R = 6378137;
export const project = (lat, lon) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
export const unproject = (x, y) => [Math.atan(Math.sinh(y / R)) * 180 / Math.PI, x / R * 180 / Math.PI];
export const defaultGrid = { originX: project(50, 14)[0], originY: project(50, 14)[1], pixelWidth: 2226.3898158654715, pixelHeight: 3540.460917427248 };
export function fixtureCell(row = 0, col = 0, grid = defaultGrid) {
  const [lat, lon] = unproject(grid.originX + (col + 0.5) * grid.pixelWidth, grid.originY - (row + 0.5) * grid.pixelHeight);
  return { lat, lon, row, col };
}

// A small, independently written TIFF producer for deterministic transport/format
// tests. These values are synthetic and are not retained provider weather.
export function fixtureTiff({ width = 4, height = 4, tileWidth = 16, tileHeight = 16, values = Array.from({ length: width * height }, (_, i) => i === 2 ? NaN : i * 10), littleEndian = true, grid = defaultGrid, compression = 8, predictor = 1, sampleFormat = 3, crs = 3857, pixelIsArea = 1, nodata = 'nan', bits = 32, samples = 1, magic = 42 } = {}) {
  const tiles = [], offsets = [], counts = [];
  const across = Math.ceil(width / tileWidth), down = Math.ceil(height / tileHeight);
  for (let ty = 0; ty < down; ty++) for (let tx = 0; tx < across; tx++) {
    const tile = new Uint8Array(tileWidth * tileHeight * 4), view = new DataView(tile.buffer);
    for (let y = 0; y < tileHeight; y++) for (let x = 0; x < tileWidth; x++) {
      const row = ty * tileHeight + y, col = tx * tileWidth + x;
      view.setFloat32((y * tileWidth + x) * 4, row < height && col < width ? values[row * width + col] : NaN, littleEndian);
    }
    const bytes = new Uint8Array(deflateSync(tile)); tiles.push(bytes); counts.push(bytes.length); offsets.push(0);
  }
  const entries = [
    [256, 4, [width]], [257, 4, [height]], [258, 3, [bits]], [259, 3, [compression]], [262, 3, [1]],
    [277, 3, [samples]], [284, 3, [1]], [317, 3, [predictor]], [322, 4, [tileWidth]], [323, 4, [tileHeight]],
    [324, 4, offsets], [325, 4, counts], [33550, 12, [grid.pixelWidth, grid.pixelHeight, 0]],
    [33922, 12, [0, 0, 0, grid.originX, grid.originY, 0]], [339, 3, [sampleFormat]],
    [34735, 3, [1, 1, 0, 3, 1024, 0, 1, 1, 1025, 0, 1, pixelIsArea, 3072, 0, 1, crs]],
    [42113, 2, [...Array.from(nodata, c => c.charCodeAt(0)), 0]],
  ].sort((a, b) => a[0] - b[0]);
  const sizes = { 2: 1, 3: 2, 4: 4, 12: 8 };
  let cursor = 8 + 2 + entries.length * 12 + 4;
  for (const entry of entries) {
    const bytes = entry[2].length * sizes[entry[1]];
    if (bytes > 4) { entry[3] = cursor; cursor += bytes; }
  }
  for (let i = 0; i < tiles.length; i++) { offsets[i] = cursor; cursor += tiles[i].length; }
  const bytes = new Uint8Array(cursor), v = new DataView(bytes.buffer);
  bytes.set(littleEndian ? [73, 73] : [77, 77]); v.setUint16(2, magic, littleEndian); v.setUint32(4, 8, littleEndian);
  v.setUint16(8, entries.length, littleEndian);
  for (let i = 0; i < entries.length; i++) {
    const [tag, type, data, external] = entries[i], o = 10 + i * 12;
    v.setUint16(o, tag, littleEndian); v.setUint16(o + 2, type, littleEndian); v.setUint32(o + 4, data.length, littleEndian);
    const p = external ?? o + 8;
    if (external !== undefined) v.setUint32(o + 8, external, littleEndian);
    data.forEach((value, j) => {
      if (type === 2) v.setUint8(p + j, value);
      else if (type === 3) v.setUint16(p + j * 2, value, littleEndian);
      else if (type === 4) v.setUint32(p + j * 4, value, littleEndian);
      else v.setFloat64(p + j * 8, value, littleEndian);
    });
  }
  tiles.forEach((tile, i) => bytes.set(tile, offsets[i]));
  return bytes;
}

export function changeTiffTag(bytes, tag, { type, count, value } = {}) {
  const result = bytes.slice(), v = new DataView(result.buffer), little = result[0] === 73;
  const ifd = v.getUint32(4, little), n = v.getUint16(ifd, little);
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    if (v.getUint16(o, little) !== tag) continue;
    if (type !== undefined) v.setUint16(o + 2, type, little);
    if (count !== undefined) v.setUint32(o + 4, count, little);
    if (value !== undefined) v.setUint32(o + 8, value, little);
    return result;
  }
  throw new Error(`No TIFF tag ${tag}`);
}

// Narrow reader for the provider's processed CEILING raster. This is deliberately
// not a general GeoTIFF implementation and never assigns native-grid provenance.
const R = 6378137;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 2_000_000;
const fail = message => { throw new Error(`GeoTIFF: ${message}`); };
const abort = signal => { if (signal?.aborted) throw new DOMException('Zrušeno', 'AbortError'); };

async function inflate(bytes, expected, signal) {
  if (typeof DecompressionStream !== 'function') fail('prohlížeč nepodporuje Deflate');
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const out = new Uint8Array(expected);
  let offset = 0;
  try {
    while (true) {
      abort(signal);
      const {done, value} = await reader.read();
      if (done) break;
      if (offset + value.byteLength > expected) fail('rozbalená dlaždice překročila rozměry');
      out.set(value, offset); offset += value.byteLength;
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  if (offset !== expected) fail('neúplná dlaždice');
  return out;
}

export async function decodeProcessedGeoTiff(input, {signal} = {}) {
  abort(signal);
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 8 || bytes.length > MAX_BYTES) fail('nepovolená velikost souboru');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const marker = view.getUint16(0, true);
  if (marker !== 0x4949 && marker !== 0x4d4d) fail('chybí TIFF hlavička');
  const little = marker === 0x4949;
  const bound = (offset, length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) fail('offset mimo soubor');
  };
  const u16 = offset => { bound(offset, 2); return view.getUint16(offset, little); };
  const u32 = offset => { bound(offset, 4); return view.getUint32(offset, little); };
  if (u16(2) !== 42) fail('nepodporovaná TIFF verze');
  const ifd = u32(4), count = u16(ifd);
  if (count < 10 || count > 64) fail('nepovolený adresář');
  bound(ifd + 2, count * 12 + 4);
  const sizes = {1:1, 2:1, 3:2, 4:4, 5:8, 11:4, 12:8};
  const tags = new Map(), tagTypes = new Map();
  for (let i = 0; i < count; i++) {
    const offset = ifd + 2 + i * 12;
    const tag = u16(offset), type = u16(offset + 2), length = u32(offset + 4);
    if (tags.has(tag) || !sizes[type] || length > 4096) fail('neplatné TIFF položky');
    const size = length * sizes[type], start = size <= 4 ? offset + 8 : u32(offset + 8);
    bound(start, size);
    const values = [];
    for (let j = 0; j < length; j++) {
      const p = start + j * sizes[type];
      values.push(type === 3 ? u16(p) : type === 4 ? u32(p) : type === 12 ? view.getFloat64(p, little) : view.getUint8(p));
    }
    tags.set(tag, values); tagTypes.set(tag,type);
  }
  const scalar = (tag, fallback) => {
    const value = tags.get(tag);
    if (!value && fallback !== undefined) return fallback;
    if (!value || value.length !== 1 || ![3,4].includes(tagTypes.get(tag))) fail(`chybí položka ${tag}`);
    return value[0];
  };
  const width = scalar(256), height = scalar(257), tileWidth = scalar(322), tileHeight = scalar(323);
  if (![width,height,tileWidth,tileHeight].every(x => Number.isInteger(x) && x > 0) || width * height > MAX_PIXELS || tileWidth > 512 || tileHeight > 512) fail('nepovolené rozměry');
  if (scalar(258) !== 32 || scalar(259) !== 8 || scalar(339) !== 3 || scalar(277,1) !== 1 || scalar(317,1) !== 1 || scalar(262) !== 1 || ![1,2].includes(scalar(284,1))) fail('nepodporované kódování rastru');
  if (scalar(274,1) !== 1) fail('nepodporovaná orientace');
  const offsets = tags.get(324), sizesBytes = tags.get(325);
  const across = Math.ceil(width / tileWidth), tileCount = across * Math.ceil(height / tileHeight);
  if (tileCount > 256 || offsets?.length !== tileCount || sizesBytes?.length !== tileCount || tagTypes.get(324)!==4 || tagTypes.get(325)!==4) fail('neúplný seznam dlaždic');
  const scale = tags.get(33550), tie = tags.get(33922), keys = tags.get(34735);
  if (tagTypes.get(33550)!==12 || tagTypes.get(33922)!==12 || scale?.length !== 3 || tie?.length !== 6 || !scale.every(Number.isFinite) || !tie.every(Number.isFinite) || scale[0] <= 0 || scale[1] <= 0 || tie.slice(0,3).some(x => x !== 0)) fail('neplatná georeference');
  if (tagTypes.get(34735)!==3 || keys?.length < 4 || keys[0] !== 1 || keys.length !== 4 + keys[3] * 4) fail('chybí GeoKeys');
  const geo = new Map();
  for (let i = 4; i < keys.length; i += 4) {
    if (geo.has(keys[i])) fail('duplicitní GeoKey');
    if (keys[i+1] === 0 && keys[i+2] === 1) geo.set(keys[i],keys[i+3]);
  }
  if (geo.get(1024) !== 1 || geo.get(1025) !== 1 || geo.get(3072) !== 3857) fail('vyžadován EPSG:3857 PixelIsArea');
  const nodata = tags.get(42113);
  if (tagTypes.get(42113)!==2 || !nodata || String.fromCharCode(...nodata).replace(/\0+$/, '').trim().toLowerCase() !== 'nan') fail('nepotvrzený chybějící údaj');
  const grid = {type:'processed-raster', crs:'EPSG:3857', originX:tie[3], originY:tie[4], pixelWidth:scale[0], pixelHeight:scale[1]};
  if (Math.abs(grid.originX) > Math.PI * R || Math.abs(grid.originY) > Math.PI * R || Math.abs(grid.originX + width * scale[0]) > Math.PI * R || Math.abs(grid.originY - height * scale[1]) > Math.PI * R) fail('rastr mimo Mercator');
  const values = new Float32Array(width * height);
  for (let i = 0; i < tileCount; i++) {
    abort(signal);
    const start = offsets[i], length = sizesBytes[i];
    if (!length || length > MAX_BYTES) fail('neplatná velikost dlaždice');
    bound(start,length);
    const tile = await inflate(bytes.subarray(start,start+length),tileWidth*tileHeight*4,signal);
    const data = new DataView(tile.buffer,tile.byteOffset,tile.byteLength);
    const x = (i % across) * tileWidth, y = Math.floor(i / across) * tileHeight;
    for (let row = 0; row < tileHeight && y + row < height; row++) {
      for (let col = 0; col < tileWidth && x + col < width; col++) {
        const value = data.getFloat32((row*tileWidth+col)*4,little);
        if (!Number.isNaN(value) && (!Number.isFinite(value) || value < 0 || value > 200000)) fail('neplatná hodnota AGL');
        values[(y+row)*width+x+col] = value;
      }
    }
  }
  return {width,height,values,grid,nodata:null};
}

const inverse = (x,y) => ({lon:x/R*180/Math.PI, lat:(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI});
function centre(raster,row,col) {
  const g = raster.grid;
  const point = inverse(g.originX+(col+0.5)*g.pixelWidth,g.originY-(row+0.5)*g.pixelHeight);
  const index = row*raster.width+col, value = raster.values[index];
  return {...point,row,col,index,valueAglFt:Number.isFinite(value)?value:null};
}
function distance(lat,lon,point) {
  const d = Math.PI/180, a = Math.sin((point.lat-lat)*d/2)**2 + Math.cos(lat*d)*Math.cos(point.lat*d)*Math.sin((point.lon-lon)*d/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
export function rasterCell(raster,lat,lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) >= 85.05112878 || Math.abs(lon) > 180) return null;
  const g = raster.grid, x = R*lon*Math.PI/180, y = R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
  const col = Math.floor((x-g.originX)/g.pixelWidth), row = Math.floor((g.originY-y)/g.pixelHeight);
  if (col < 0 || col >= raster.width || row < 0 || row >= raster.height) return null;
  const point = centre(raster,row,col);
  return {...point,distanceKm:distance(lat,lon,point)};
}
export function cropRaster(raster,lat,lon,{maxCells=1500,latRadius=0.9,lonRadius=1.5}={}) {
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > 2048 || !Number.isFinite(latRadius) || !Number.isFinite(lonRadius) || latRadius <= 0 || latRadius > 2 || lonRadius <= 0 || lonRadius > 3) throw new Error('Neplatný region rastru');
  const selected = rasterCell(raster,lat,lon);
  if (!selected) return {bounds:[[lat,lon],[lat,lon]],nodes:[],totalCells:0,subset:false};
  const g = raster.grid;
  const edgesSW = inverse(g.originX,g.originY-raster.height*g.pixelHeight), edgesNE = inverse(g.originX+raster.width*g.pixelWidth,g.originY);
  const south = Math.max(edgesSW.lat,Math.min(lat-latRadius,selected.lat)), north = Math.min(edgesNE.lat,Math.max(lat+latRadius,selected.lat)), west = Math.max(edgesSW.lon,Math.min(lon-lonRadius,selected.lon)), east = Math.min(edgesNE.lon,Math.max(lon+lonRadius,selected.lon));
  const found = [];
  for (let row=0;row<raster.height;row++) {
    const rowLat=centre(raster,row,selected.col).lat;
    if (rowLat<south || rowLat>north) continue;
    for (let col=0;col<raster.width;col++) {
      const point=centre(raster,row,col);
      if (point.lon>=west && point.lon<=east) found.push(point);
    }
  }
  const totalCells=found.length, step=Math.max(1,Math.ceil(totalCells/maxCells));
  const nodes=found.filter((_,i)=>i%step===0).slice(0,maxCells);
  if (!nodes.some(node=>node.index===selected.index)) {
    if (nodes.length===maxCells) nodes.pop();
    const {distanceKm:_,...point}=selected; nodes.push(point); nodes.sort((a,b)=>a.index-b.index);
  }
  return {bounds:[[south,west],[north,east]],nodes,totalCells,subset:nodes.length<totalCells};
}

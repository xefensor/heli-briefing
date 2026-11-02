// Optional user-downloaded ČHMÚ frames. This adapter never fetches weather.
export const LOW_CLOUD_FRAME_BASE = 'https://data-provider.chmi.cz/api/data/letectvi/img-forecast/oblacnost/';
export const LOW_CLOUD_PAGE = 'https://www.chmi.cz/letectvi/predpovedi-pro-letani/predpoved-nizke-oblacnosti';
export const LOW_CLOUD_FILE_LIMITS = Object.freeze({ frames: 12, rawBytes: 8 * 1024 * 1024, imageBytes: 2 * 1024 * 1024, minDimension: 100, maxDimension: 4096 });

const BOUNDS = [[47.766666666667, 10.5], [51.366666666667, 20.316666666667]];
const PNG_PREFIX = 'data:image/png;base64,';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function fail(message) { throw new Error(message); }

function filenameSlot(name) {
  const match = typeof name === 'string' && /^(\d{12})(?:\.(json|png))?$/.exec(name);
  if (!match) fail('Zachovejte původní název souboru YYYYMMDDHHMM.json nebo YYYYMMDDHHMM.png (případně bez přípony).');
  const ref = match[1], iso = `${ref.slice(0, 4)}-${ref.slice(4, 6)}-${ref.slice(6, 8)}T${ref.slice(8, 10)}:${ref.slice(10, 12)}:00.000Z`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== iso || Number(ref.slice(8, 10)) % 3 || ref.slice(10, 12) !== '00') {
    fail('Název souboru musí obsahovat skutečný UTC termín YYYYMMDDHHMM v tříhodinovém kroku a s minutami 00.');
  }
  return { ref, validAt: iso, extension: match[2] || null };
}

function isUtcInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value), canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString() === canonical;
}

function importClock(now) {
  const value = typeof now === 'function' ? now() : now ?? new Date();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail('Čas místního importu není platný.');
  return date.toISOString();
}

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngInfo(bytes) {
  const limit = LOW_CLOUD_FILE_LIMITS;
  if (!(bytes instanceof Uint8Array) || bytes.length > limit.imageBytes || bytes.length < 57 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    fail('Obraz musí být skutečný PNG soubor o velikosti nejvýše 2 MiB.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8, width = 0, height = 0, hasData = false, ended = false, afterData = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail('PNG má poškozené nebo neúplné bloky.');
    const length = view.getUint32(offset), end = offset + 12 + length;
    if (end > bytes.length) fail('PNG má poškozené nebo neúplné bloky.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes, offset + 4, offset + 8 + length) !== view.getUint32(offset + 8 + length)) fail('PNG má neplatný typ nebo kontrolní součet bloku.');
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) fail('PNG nezačíná platným blokem IHDR.');
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) fail('PNG obsahuje neplatný nebo opakovaný IHDR.');
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      const bitDepth = bytes[offset + 16], colour = bytes[offset + 17];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (width < limit.minDimension || height < limit.minDimension || width > limit.maxDimension || height > limit.maxDimension || !depths[colour]?.includes(bitDepth) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] > 1) {
        fail('PNG má nepodporované záhlaví nebo rozměry mimo 100–4096 px.');
      }
    } else if (type === 'IDAT') {
      if (afterData) fail('PNG obsahuje nesouvislé obrazové bloky.');
      hasData ||= length > 0;
    } else if (hasData) afterData = true;
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) fail('Animovaný PNG není jednotlivý předpovědní rámec.');
    if (type === 'IEND') {
      if (length !== 0 || !hasData || end !== bytes.length) fail('PNG nemá platné ukončení IEND nebo obsahuje dodatečná data.');
      ended = true; break;
    }
    offset = end;
  }
  if (!ended) fail('PNG nemá úplný ukončovací blok IEND.');
  return { width, height, imageBytes: bytes.length };
}

function bytesFromDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > PNG_PREFIX.length + 4 * Math.ceil(LOW_CLOUD_FILE_LIMITS.imageBytes / 3) || !dataUrl.startsWith(PNG_PREFIX)) fail('JSON musí obsahovat pouze PNG obraz v poli img.');
  const encoded = dataUrl.slice(PNG_PREFIX.length);
  if (!encoded.length || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail('PNG obraz v JSON nemá platné base64 kódování.');
  let binary;
  try { binary = atob(encoded); } catch { fail('PNG obraz v JSON nemá platné base64 kódování.'); }
  if (btoa(binary) !== encoded) fail('PNG obraz v JSON nemá jednoznačné base64 kódování.');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function dataUrlFromBytes(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return PNG_PREFIX + btoa(binary);
}

async function decodeBrowserImage(bytes, { dataUrl }) {
  if (typeof createImageBitmap === 'function' && typeof Blob === 'function') {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    try { return { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); }
  }
  if (typeof Image !== 'function') fail('Tento prohlížeč neumí ověřit místní PNG obraz.');
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error('Dekódování PNG obrazu překročilo časový limit.')), 15000);
    function finish(error) {
      clearTimeout(timer); image.onload = null; image.onerror = null;
      if (error) { image.src = ''; reject(error); } else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    }
    image.onload = () => finish(); image.onerror = () => finish(new Error('Prohlížeč nedokáže PNG obraz dekódovat.'));
    image.src = dataUrl;
  });
}

// Synchronous revalidation for untrusted frozen briefings. This validates the PNG
// envelope; a new local file additionally requires native browser decoding below.
export function validateLocalLowCloudFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) fail('Místní rámec nízké oblačnosti není platný.');
  const slot = filenameSlot(frame.originalFileName);
  if (frame.source !== 'chmi-low-cloud' || frame.product !== 'low-cloud' || frame.id !== `chmi-low-cloud-${slot.ref}` || frame.status !== 'manual' || frame.delivery !== 'local-file' || frame.timeBasis !== 'filename-unverified' || frame.validityConfirmed !== false || frame.validAt !== slot.validAt || frame.issuedAt !== null || frame.retrievedAt !== null || !isUtcInstant(frame.importedAt)) {
    fail('Místní rámec nemá zachované neověřené časové údaje a původ souboru.');
  }
  if (frame.sourceUrl !== LOW_CLOUD_FRAME_BASE + slot.ref || frame.sourcePage !== LOW_CLOUD_PAGE || frame.author !== 'ČHMÚ' || frame.license !== 'CC BY 4.0' || frame.licenseUrl !== LICENSE_URL || frame.mime !== 'image/png' || frame.units !== 'hft AMSL' || frame.projection !== 'EPSG:3857' || !Array.isArray(frame.bounds) || frame.bounds.length !== 2 || frame.bounds.some((row, index) => !Array.isArray(row) || row.length !== 2 || row.some((value, column) => value !== BOUNDS[index][column]))) {
    fail('Místní rámec nemá správnou identitu zdroje, licenci, legendu nebo zeměpisný rozsah.');
  }
  const info = pngInfo(bytesFromDataUrl(frame.imageDataUrl));
  if (frame.width !== info.width || frame.height !== info.height || frame.imageBytes !== info.imageBytes) fail('Rozměry nebo velikost místního PNG neodpovídají vloženému obrazu.');
  return frame;
}

export async function parseLowCloudFiles(files, { now, decodeImage = decodeBrowserImage, timeoutMs = 15000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) fail('Neplatný časový limit místního importu.');
  if (!files || typeof files[Symbol.iterator] !== 'function' || typeof decodeImage !== 'function') fail('Vyberte původní soubory JSON nebo PNG z ČHMÚ.');
  const pending = [], slots = new Set();
  let totalRawBytes = 0;
  for (const file of files) {
    if (pending.length >= LOW_CLOUD_FILE_LIMITS.frames) fail('Najednou lze importovat nejvýše 12 rámců.');
    const slot = filenameSlot(file?.name);
    if (slots.has(slot.ref)) fail('Dva soubory mají stejný UTC termín. Vyberte pro každý termín pouze jeden rámec.');
    if (!Number.isSafeInteger(file?.size) || file.size <= 0 || typeof file.arrayBuffer !== 'function') fail('Vybraný soubor nemá platnou velikost nebo jej nelze přečíst.');
    totalRawBytes += file.size;
    if (totalRawBytes > LOW_CLOUD_FILE_LIMITS.rawBytes) fail('Celková velikost souborů nesmí překročit 8 MiB.');
    slots.add(slot.ref); pending.push({ file, slot });
  }
  if (!pending.length) fail('Vyberte alespoň jeden původní soubor ČHMÚ.');
  const frames = [];
  for (const { file, slot } of pending) {
    let buffer;
    try { buffer = await file.arrayBuffer(); } catch { fail('Vybraný soubor se nepodařilo přečíst.'); }
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== file.size) fail('Přečtená velikost souboru neodpovídá vybranému souboru.');
    const importedAt = importClock(now), raw = new Uint8Array(buffer);
    const isPng = PNG_SIGNATURE.every((value, index) => raw[index] === value);
    if (slot.extension === 'png' && !isPng || slot.extension === 'json' && isPng) fail('Přípona souboru neodpovídá jeho skutečnému obsahu.');
    let bytes, imageDataUrl;
    if (isPng) { bytes = raw; imageDataUrl = dataUrlFromBytes(bytes); }
    else {
      let data;
      try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { fail('Soubor není platný původní JSON s PNG obrazem.'); }
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 1 || !Object.hasOwn(data, 'img')) fail('Původní JSON musí obsahovat právě jedno pole img s PNG obrazem.');
      imageDataUrl = data.img; bytes = bytesFromDataUrl(imageDataUrl);
    }
    const info = pngInfo(bytes);
    let decoded, timer;
    try { decoded = await Promise.race([decodeImage(bytes, { dataUrl: imageDataUrl, ...info }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Časový limit PNG')), timeoutMs); })]); }
    catch { fail('Prohlížeč nedokáže PNG obraz dekódovat v časovém limitu; soubor nebyl importován.'); }
    finally { clearTimeout(timer); }
    if (decoded?.width !== info.width || decoded?.height !== info.height) fail('Dekódovaný PNG obraz neodpovídá rozměrům v záhlaví.');
    frames.push({
      id: `chmi-low-cloud-${slot.ref}`, source: 'chmi-low-cloud', product: 'low-cloud', status: 'manual',
      validAt: slot.validAt, delivery: 'local-file', timeBasis: 'filename-unverified', validityConfirmed: false,
      issuedAt: null, retrievedAt: null, importedAt, sourceUrl: LOW_CLOUD_FRAME_BASE + slot.ref, sourcePage: LOW_CLOUD_PAGE,
      author: 'ČHMÚ', license: 'CC BY 4.0', licenseUrl: LICENSE_URL, originalFileName: file.name,
      imageDataUrl, ...info, mime: 'image/png', bounds: BOUNDS.map(row => [...row]), projection: 'EPSG:3857', units: 'hft AMSL',
    });
  }
  const importedAt = frames.at(-1).importedAt;
  frames.sort((a, b) => Date.parse(a.validAt) - Date.parse(b.validAt));
  return { frames, importedAt, totalRawBytes };
}

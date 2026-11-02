/** Small synthetic GRIB fixtures for failure/metadata tests, never application data. */
const ids = { CEILING: [6, 13, 2, 101], CLAT: [191, 1, 1, 255], CLON: [191, 2, 1, 255], HSURF: [3, 6, 1, 101] };
const signed = number => number < 0 ? 0x8000 - number : number;
export function fixtureGrib(field = 'CEILING', { runTime = '2026-11-02T06:00:00.000Z', leadHours = 0, count = 1, reference = 3000, binaryScale = 0, decimalScale = 0, bitmap = null, vector = null } = {}) {
  const a = new Date(runTime), parameter = ids[field], lengths = [21, 35, 34, 25, 6 + (bitmap ? Math.ceil(count / 8) : 0), 5 + (vector ? Buffer.from(vector.encoded, 'base64').length : 0)];
  const total = 16 + lengths.reduce((x, y) => x + y, 0) + 4, bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  bytes.set([71,82,73,66,255,255,0,2]); view.setBigUint64(8, BigInt(total));
  let at = 16; const sections = {};
  [1,3,4,5,6,7].forEach((number, i) => { const v = new DataView(bytes.buffer, at, lengths[i]); v.setUint32(0, lengths[i]); v.setUint8(4, number); sections[number] = v; at += lengths[i]; });
  const s1 = sections[1]; s1.setUint16(5, 78); s1.setUint8(7, 0); s1.setUint8(8, 255); s1.setUint8(9, 19); s1.setUint8(10, 1); s1.setUint8(11, 1); s1.setUint16(12, a.getUTCFullYear());
  [a.getUTCMonth()+1,a.getUTCDate(),a.getUTCHours(),a.getUTCMinutes(),a.getUTCSeconds()].forEach((v,i)=>s1.setUint8(14+i,v));
  const s3 = sections[3]; s3.setUint32(6,count);s3.setUint16(12,101);s3.setUint8(14,6);s3.setUint8(17,62);s3.setUint8(18,1);s3.setUint8(34,1);
  const s4=sections[4];s4.setUint8(9,parameter[0]);s4.setUint8(10,parameter[1]);s4.setUint8(11,2);s4.setUint8(13,2);s4.setUint8(17,0);s4.setUint32(18,leadHours*60);s4.setUint8(22,parameter[2]);s4.setUint8(28,parameter[3]);
  const s5=sections[5];s5.setUint32(5,bitmap?bitmap.reduce((a,b)=>a+b,0):count);s5.setUint16(9,42);s5.setFloat32(11,reference);s5.setUint16(15,signed(binaryScale));s5.setUint16(17,signed(decimalScale));s5.setUint8(19,vector?.bitsPerSample||0);s5.setUint8(21,vector?.flags??14);s5.setUint8(22,vector?.blockSize||32);s5.setUint16(23,vector?.rsi||128);
  const s6=sections[6];s6.setUint8(5,bitmap?0:255);if(bitmap)bitmap.forEach((v,i)=>{if(v)s6.setUint8(6+(i>>3),s6.getUint8(6+(i>>3))|1<<(7-i%8));});
  if(vector)bytes.set(Buffer.from(vector.encoded,'base64'),sections[7].byteOffset+5);
  bytes.fill(55,total-4);return bytes;
}
export function mutateSection(bytes, number, mutate) {
  const copy = bytes.slice(), view = new DataView(copy.buffer);let at=16;
  while(at<copy.length-4){const length=view.getUint32(at);if(copy[at+4]===number){mutate(new DataView(copy.buffer,at,length));return copy;}at+=length;}
  throw new Error('Missing fixture section');
}

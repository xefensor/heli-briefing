import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decodeNativeGrib, assertSameNativeGrid } from '../web/js/native-grib.js';
import { fixtureGrib, mutateSection } from './native-grib-fixtures.mjs';

test('native GRIB keeps explicit field/grid identity, signed scales and minute-based validity', () => {
  const field = decodeNativeGrib(fixtureGrib('CEILING', { leadHours: 6, reference: 12.5, binaryScale: -2, decimalScale: -1 }), { expectedField: 'CEILING' });
  assert.equal(field.values[0], 125); assert.equal(field.runTime, '2026-11-02T06:00:00.000Z'); assert.equal(field.validAt, '2026-11-02T12:00:00.000Z');
  assert.equal(field.units, 'm MSL'); assert.equal(field.grid.number, 62); assert.equal(field.grid.uuid, '00000000000000000000000000000001');
  assert.equal(field.packing.binaryScale, -2); assert.equal(field.packing.decimalScale, -1);
  assert.throws(() => decodeNativeGrib(fixtureGrib('CLAT'), { expectedField: 'CEILING' }), /parametr/);
});

test('native GRIB bitmap determines missing values rather than numerical zero or large finite heights', () => {
  const result = decodeNativeGrib(fixtureGrib('CEILING', { count: 3, reference: 0, bitmap: [1,0,1] }), { expectedField: 'CEILING' });
  assert.equal(result.values[0], 0); assert.ok(Number.isNaN(result.values[1])); assert.equal(result.values[2], 0);
  assert.equal(decodeNativeGrib(fixtureGrib('CEILING', { reference: 16000 }), { expectedField: 'CEILING' }).values[0], 16000);
  assert.throws(() => decodeNativeGrib(mutateSection(fixtureGrib('CEILING', {count:3,bitmap:[1,0,1]}),6,v=>v.setUint8(6,161)), {expectedField:'CEILING'}), /doplnění/);
  assert.throws(() => decodeNativeGrib(mutateSection(fixtureGrib('CEILING', {count:3,bitmap:[1,0,1]}),5,v=>v.setUint32(5,3)), {expectedField:'CEILING'}), /zarovnány/);
});

test('native GRIB CCSDS values match independent libaec golden integers through the whole parser', async () => {
  const vectors=JSON.parse(await readFile(new URL('./aec-goldens.json',import.meta.url),'utf8')).vectors;
  const vector=vectors.find(v=>v.name==='pp_u16_bs32_zero5');
  const result=decodeNativeGrib(fixtureGrib('CEILING',{count:vector.samples,reference:0,vector}),{expectedField:'CEILING'});
  const serialized=new Uint8Array(result.values.length*4),view=new DataView(serialized.buffer);result.values.forEach((v,i)=>view.setUint32(i*4,v,true));
  assert.equal(createHash('sha256').update(serialized).digest('hex'),vector.sha256);
});

test('native GRIB rejects malformed lengths, dates, authority, product, packing and inherited masks', () => {
  const good=fixtureGrib();
  for(const bytes of [good.subarray(0,good.length-1),Uint8Array.from([1,2,3]),mutateSection(good,1,v=>v.setUint16(5,7)),mutateSection(good,1,v=>v.setUint8(15,31)),mutateSection(good,3,v=>v.setUint16(12,0)),mutateSection(good,3,v=>v.setUint32(6,2000000)),mutateSection(good,4,v=>v.setUint8(28,1)),mutateSection(good,4,v=>v.setUint8(17,255)),mutateSection(good,5,v=>v.setUint16(9,0)),mutateSection(good,5,v=>v.setFloat32(11,NaN)),mutateSection(good,6,v=>v.setUint8(5,254))])assert.throws(()=>decodeNativeGrib(bytes,{expectedField:'CEILING'}));
  const field=decodeNativeGrib(good,{expectedField:'CEILING'});
  assert.throws(()=>assertSameNativeGrid(field,{...field,grid:{...field.grid,uuid:'other'}}),/stejné/);
  assert.throws(()=>assertSameNativeGrid(field,{...field,grid:{...field.grid,count:2}}),/stejné/);
});

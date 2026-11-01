import test from 'node:test';
import assert from 'node:assert/strict';
import {satelliteState,renderSatellite} from '../web/js/satellite.js';
const now=Date.parse('2026-11-01T15:00:00Z');
function data(){const bytes=Buffer.alloc(40);Buffer.from('\x89PNG\r\n\x1a\n','binary').copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(1000,16);bytes.writeUInt32BE(500,20);return {schemaVersion:1,layer:'mtg_fd:rgb_geocolour',bounds:[47,10,52,20],status:'ok',observedAt:'2026-11-01T14:40:00Z',retrievedAt:'2026-11-01T14:50:00Z',imageDataUrl:'data:image/png;base64,'+bytes.toString('base64')};}
test('satellite freshness uses observation time and rejects future or unqualified products',()=>{
 assert.equal(satelliteState(data(),now).status,'available');assert.equal(satelliteState(data(),now+2*3600000).status,'stale');
 assert.equal(satelliteState({...data(),observedAt:'2026-11-02T00:00:00Z'},now).image,null);
 assert.equal(satelliteState({...data(),bounds:[10,47,20,52]},now).image,null);
});
test('image content cannot become arbitrary SVG, remote requests or incorrect geometry',()=>{
 assert.equal(satelliteState({...data(),imageDataUrl:'https://evil.test/image'},now).image,null);
 assert.equal(satelliteState({...data(),imageDataUrl:'data:image/svg+xml;base64,PHN2Zz4='},now).image,null);
 const d=data();const b=Buffer.from(d.imageDataUrl.split(',')[1],'base64');b.writeUInt32BE(1,16);d.imageDataUrl='data:image/png;base64,'+b.toString('base64');assert.equal(satelliteState(d,now).image,null);
});
test('source time, attribution, escaping and out-of-crop point remain explicit',()=>{
 const html=renderSatellite(data(),{lat:60,lon:30,now,error:'<script>bad</script>'});
 assert.match(html,/EUMETSAT \/ NASA/);assert.match(html,/mimo výřez/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/STARŠÍ/);
});

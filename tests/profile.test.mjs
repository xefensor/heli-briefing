import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,profileAt,profileFields,renderProfile} from '../web/js/profile.js';
import {forecastUrl} from '../web/js/weather.js';
function payload(){return {elevation:500,hourly_units:{geopotential_height_950hPa:'m',wind_speed_950hPa:'kn',wind_direction_950hPa:'°',temperature_950hPa:'°C',relative_humidity_950hPa:'%'},hourly:{geopotential_height_950hPa:[600,400,null],wind_speed_950hPa:[0,15,17],wind_direction_950hPa:[0,10,20],temperature_950hPa:[0,-1,2],relative_humidity_950hPa:[0,95,90]}};}
const times=['2026-11-01T12:00:00Z','2026-11-01T13:00:00Z','2026-11-01T14:00:00Z'];
test('profile masks all meteorology beneath terrain and without known height while retaining zero',()=>{
 const p=normalizeProfile(payload(),'aladin',3).levels.find(l=>l.pressureHpa===950);
 assert.deepEqual(p.wind,[0,null,null]);assert.deepEqual(p.temperature,[0,null,null]);assert.deepEqual(p.direction,[0,null,null]);assert.deepEqual(p.humidity,[0,null,null]);assert.deepEqual(p.reasons,[null,'below-terrain','height-missing']);
});
test('unknown terrain and wrong height units cannot become an altitude-qualified profile',()=>{
 const data=payload();data.elevation=null;assert.deepEqual(normalizeProfile(data,'aladin',3).levels.find(l=>l.pressureHpa===950).wind,[null,null,null]);
 data.elevation=500;data.hourly_units.geopotential_height_950hPa='ft';assert.equal(normalizeProfile(data,'aladin',3).status,'missing');
});
test('models keep individual capabilities and provider interpolation identity',()=>{
 assert.equal(normalizeProfile(payload(),'ecmwf',3).status,'unsupported');
 const p=normalizeProfile(payload(),'icon',3);assert.deepEqual(p.levels.filter(l=>l.interpolated).map(l=>l.pressureHpa),[925,800]);
 assert.equal(profileFields().length,30);assert.ok(!new URL(forecastUrl({lat:49,lon:14,model:'ecmwf'})).searchParams.get('hourly').includes('850hPa'));
});
test('selected hour stays bounded and masked values never reappear in profile output',()=>{
 const forecast={times,profile:normalizeProfile(payload(),'aladin',3)};
 assert.equal(profileAt(forecast,'2026-11-02T12:00:00Z').status,'outside-horizon');
 const p=profileAt(forecast,'2026-11-01T12:40:00Z');assert.equal(p.validAt,times[1]);assert.equal(p.levels.find(l=>l.pressureHpa===950).wind,null);
 assert.match(renderProfile(forecast,times[1]),/Pod terénem/);assert.doesNotMatch(renderProfile(forecast,times[1]),/15 kt/);
});

import { escapeHtml as esc } from './charts.js';

export const PRESSURE_LEVELS = Object.freeze([1000, 950, 925, 850, 800, 700]);
export const PROFILE_FIELDS = Object.freeze({height:['geopotential_height','m'],wind:['wind_speed','kn'],direction:['wind_direction','°'],temperature:['temperature','°C'],humidity:['relative_humidity','%']});
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function profileFields() { return PRESSURE_LEVELS.flatMap(p => Object.values(PROFILE_FIELDS).map(([key]) => `${key}_${p}hPa`)); }

/** Store only height-qualified values; never expose subterranean model values. */
export function normalizeProfile(payload, model, count) {
  const terrain = finite(payload.elevation) ? payload.elevation : null;
  if (model === 'ecmwf') return {status:'unsupported',levels:[],terrainMsl:terrain};
  const levels = PRESSURE_LEVELS.map(pressureHpa => {
    const arrays = Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([key,[name,unit]]) => {
      const api = `${name}_${pressureHpa}hPa`;
      return [key,Array.from({length:count},(_,index) => payload.hourly_units?.[api] === unit && finite(payload.hourly?.[api]?.[index]) ? payload.hourly[api][index] : null)];
    }));
    const reasons = arrays.height.map(height => terrain === null ? 'terrain-unknown' : height === null ? 'height-missing' : height <= terrain ? 'below-terrain' : null);
    for (const [key,values] of Object.entries(arrays)) if (key !== 'height') arrays[key] = values.map((value,index) => reasons[index] ? null : value);
    return {pressureHpa,interpolated:model === 'icon' && [925,800].includes(pressureHpa),...arrays,reasons};
  });
  return {status:levels.some(level=>level.wind.some(finite))?'available':'missing',terrainMsl:terrain,levels};
}

export function profileAt(forecast, time) {
  const profile = forecast?.profile;
  if (!profile) return {status:'missing',levels:[]};
  if (profile.status === 'unsupported') return {...profile,levels:[]};
  const target=Date.parse(time), times=forecast.times.map(Date.parse);
  if (!finite(target) || target<times[0] || target>times.at(-1)) return {status:'outside-horizon',levels:[]};
  const index=times.reduce((best,value,i)=>Math.abs(value-target)<Math.abs(times[best]-target)?i:best,0);
  const levels=profile.levels.map(level=>({pressureHpa:level.pressureHpa,interpolated:level.interpolated,...Object.fromEntries(Object.keys(PROFILE_FIELDS).map(key=>[key,level[key]?.[index]??null])),reason:level.reasons?.[index]??null}));
  return {status:levels.some(level=>level.wind!==null)?'available':'missing',validAt:forecast.times[index],terrainMsl:profile.terrainMsl,levels};
}

const number=(value,digits=0)=>finite(value)?new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value):'—';
const reasons={'below-terrain':'Pod terénem API · hodnoty skryty','terrain-unknown':'Terén API není znám','height-missing':'Výška hladiny není dostupná'};
export function renderProfile(forecast,time,{width=600}={}) {
  width=Math.max(320,Math.min(780,width));
  const left=width<420?110:175, right=width-70, barWidth=right-left;
  const data=profileAt(forecast,time);
  if (data.status==='unsupported') return '<p class="profile-empty">Tento výstup ECMWF IFS 9 km neposkytuje tlakové hladiny. Profil není nahrazen jiným modelem.</p>';
  if (!data.levels.length) return '<p class="profile-empty">Pro vybraný čas není výškový profil dostupný.</p>';
  const visible=data.levels.filter(level=>!level.reason&&finite(level.height)&&finite(level.wind));
  const maxHeight=Math.max((data.terrainMsl||0)+100,...visible.map(level=>level.height));
  const maxWind=Math.max(10,...visible.map(level=>level.wind));
  const y=height=>300-(height-data.terrainMsl)/(maxHeight-data.terrainMsl)*260;
  const chart=visible.length?`<svg class="profile-svg" viewBox="0 0 ${width} 350" role="img" aria-label="Vítr s výškou v metrech MSL"><text x="10" y="18">Výška MSL</text><text x="${left}" y="18">Vítr · kt</text>${visible.map(level=>`<g><line x1="${left}" x2="${width-20}" y1="${y(level.height)}" y2="${y(level.height)}" stroke="var(--line)"/><text x="10" y="${y(level.height)+5}">${number(level.height)} m</text><rect x="${left}" y="${y(level.height)-6}" height="12" width="${level.wind/maxWind*barWidth}" fill="var(--chart-cyan)"/><text x="${left+10+level.wind/maxWind*barWidth}" y="${y(level.height)+5}">${number(level.wind,1)} kt</text></g>`).join('')}<line x1="10" x2="${width-20}" y1="320" y2="320" stroke="var(--amber)" stroke-width="2"/><text x="10" y="343">Terén API ${number(data.terrainMsl)} m MSL</text></svg>`:'';
  return `${chart}<div class="profile-table-wrap"><table class="profile-table"><caption>Hladiny pro vybraný hodinový vzorek · výšky MSL</caption><thead><tr><th>Hladina</th><th>Výška</th><th>Vítr / směr odkud</th><th>Teplota</th><th>Vlhkost</th></tr></thead><tbody>${[...data.levels].reverse().map(level=>`<tr><th scope="row">${level.pressureHpa} hPa${level.interpolated?'<small>Interpolace poskytovatele</small>':''}</th><td data-label="Výška">${number(level.height)} m MSL</td>${level.reason?`<td class="profile-missing" colspan="3">${esc(reasons[level.reason]||'Nedostupné')}</td>`:`<td data-label="Vítr / odkud">${number(level.wind,1)} kt / ${number(level.direction)}°</td><td data-label="Teplota">${number(level.temperature,1)} °C</td><td data-label="Vlhkost">${number(level.humidity)} %</td>`}</tr>`).join('')}</tbody></table></div><p class="profile-note">Profil v bodě, nikoli řez trasou. Tlakové hladiny nejsou pevné výšky AGL. Terén API slouží jako kontrolní reference a není nezávisle ověřeným nativním terénem modelu. Vlhkost není oblačnost ani námraza.</p>`;
}

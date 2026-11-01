import {escapeHtml as esc} from './charts.js';
import {formatTime,ageLabel} from './briefing.js';
export function satelliteState(data,now=Date.now()) {
  if (!data || data.schemaVersion!==1 || data.layer!=='mtg_fd:rgb_geocolour' || JSON.stringify(data.bounds)!=='[47,10,52,20]' || !['ok','stale'].includes(data.status)) return {status:'unavailable',image:null};
  const time=Date.parse(data.observedAt),retrieved=Date.parse(data.retrievedAt);
  if (!Number.isFinite(time)||!Number.isFinite(retrieved)||time>now||retrieved>now+300000) return {status:'unavailable',image:null};
  const value=data.imageDataUrl;
  if(typeof value!=='string'||value.length>2800000||!/^data:image\/png;base64,[A-Za-z\d+/]+={0,2}$/.test(value))return {status:'unavailable',image:null};
  try {const bytes=atob(value.split(',')[1].slice(0,44));if(!bytes.startsWith('\x89PNG\r\n\x1a\n')||bytes.slice(12,16)!=='IHDR'||[...bytes.slice(16,24)].map(c=>c.charCodeAt(0)).join(',')!=='0,0,3,232,0,0,1,244')return {status:'unavailable',image:null};}catch{return {status:'unavailable',image:null};}
  return {status:data.status==='stale'||now-time>90*60000?'stale':'available',image:value};
}
export function renderSatellite(data,{lat,lon,timezone='Europe/Prague',now=Date.now(),error=null}={}) {
  const state=satelliteState(data,now);
  if (!state.image) return `<p class="profile-empty">Satelitní snímek není dostupný.${error?' '+esc(error):''}</p>`;
  const point=(lat>=47&&lat<=52&&lon>=10&&lon<=20)?`<span class="satellite-point" style="left:${(lon-10)*10}%;top:${(52-lat)*20}%" title="Vybraný bod"><span>Vybraný bod</span></span>`:'';
  const label=(name,latitude,longitude)=>`<span class="satellite-city" style="left:${(longitude-10)*10}%;top:${(52-latitude)*20}%">${name}</span>`;
  return `<p class="satellite-time${state.status==='stale'||error?' attention':''}">Snímek ${esc(formatTime(data.observedAt,timezone,true))} ${timezone==='UTC'?'UTC':'CZ'} · ${esc(ageLabel(data.observedAt,now))}${state.status==='stale'||error?' · STARŠÍ / OBNOVA NEPOTVRZENA':''}</p><figure class="satellite-figure"><div class="satellite-image"><img src="${state.image}" alt="GeoColour satelitní obraz střední Evropy, zeměpisná šířka 47 až 52° N, délka 10 až 20° E">${label('Praha',50.1,14.26)}${label('Č. Budějovice',48.95,14.43)}${label('Wien',48.11,16.57)}${point}</div><figcaption>47–52° N / 10–20° E · sever nahoře${point?'':' · vybraný bod je mimo výřez'}</figcaption></figure><p class="satellite-credit">Contains modified EUMETSAT Meteosat GeoColour product 2026 · EUMETSAT / NASA · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · regionální výřez. Staženo ${esc(formatTime(data.retrievedAt,timezone,true))} ${timezone==='UTC'?'UTC':'CZ'}.</p><p class="satellite-explanation">Obraz oblačnosti shora, nikoli měření základny nebo dohlednosti. Ve dne přirozené barvy, v noci infračervený kompozit; noční městská světla tvoří statický podklad NASA. Čas snímku je nezávislý na modelu a čase předpovědi.${data.fallbackNote?' Nejnovější inzerovaný snímek selhal; zobrazen je předchozí publikovaný snímek se svým časem.':''}${error?' Obnova: '+esc(error):''}</p>`;
}

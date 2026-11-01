import {escapeHtml as esc} from './charts.js';
import {formatNumber,formatTime,reportState} from './briefing.js';
import {nearestTimeIndex} from './weather.js';
import {satelliteState} from './satellite.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const value=(number,unit='',digits=0)=>finite(number)?`${formatNumber(number,digits)}${unit?' '+unit:''}`:'—';
const stamp=(time,zone)=>time&&Number.isFinite(Date.parse(time))?`${formatTime(time,zone,true).replace(' ',`${new Intl.DateTimeFormat('cs-CZ',{timeZone:zone,year:'numeric'}).format(new Date(time))} `)} ${zone==='UTC'?'UTC':'CZ'}`:'čas neuveden';
const array=value=>Array.isArray(value)?value:[];

/** Readiness describes captured evidence, never flight permission. */
export function sourceReview(snapshot,{mode='full'}={}) {
 const now=Date.parse(snapshot.createdAt), selected=Date.parse(snapshot.state.time), rows=[];
 if(mode==='full'){
  const f=snapshot.forecast,i=f?nearestTimeIndex(f.times,snapshot.state.time):-1;
  const missing=i<0||['wind','temperature','visibility'].some(key=>!finite(f?.hourly?.[key]?.[i]));
  rows.push({name:f?.label||'Předpověď',tone:!f||missing||f.transport?.stale?'warn':'neutral',text:!f?'Nedostupná':missing?'Vybraný vzorek má chybějící hodnoty':f.transport?.stale?'Starší data po chybě obnovy':`Hodinový vzorek ${stamp(f.times[i],snapshot.state.timezone)}`});
 }
 for(const [key,name]of [['metar','METAR'],['taf','TAF'],['sigmet','SIGMET']]){
  const feed=snapshot.aviation?.[key], retrieved=Date.parse(feed?.retrievedAt), old=!Number.isFinite(retrieved)||retrieved>now+300000||now-retrieved>3600000;
  const ageNote=!Number.isFinite(retrieved)?'čas stažení chybí / není platný':retrieved>now+300000?'budoucí čas stažení':'balíček starší než 1 h';
  const exceptional=array(feed?.items).filter(item=>reportState(item,key==='metar'?now:selected).tone!=='neutral').length;
  rows.push({name,tone:!feed||old||['stale','unavailable'].includes(feed.status)||exceptional?'warn':'neutral',text:!feed?'Zdroj nedostupný':`${feed.status==='empty'?'Prázdný balíček':`${array(feed.items).length} zpráv`}${old?' · '+ageNote:''}${['stale','unavailable'].includes(feed.status)?' · obnova nepotvrzena':''}${exceptional?` · ${exceptional} zpráv s upozorněním`:''}${array(feed.missingStations).length?` · chybí ${feed.missingStations.join(', ')}`:''}`});
  if(array(feed?.missingStations).length)rows.at(-1).tone='warn';
 }
 if(mode==='full'){
  const other=snapshot.comparison;
  if(other){const i=nearestTimeIndex(other.times,snapshot.state.time);rows.push({name:`Porovnání ${other.label}`,tone:i<0||other.transport?.stale?'warn':'neutral',text:i<0?'Pro vybraný čas není vzorek':`${stamp(other.times[i],snapshot.state.timezone)}${other.transport?.stale?' · starší data po chybě obnovy':''}`});}
  const cloud=snapshot.clouds;
  rows.push({name:'ICON-D2 CEILING',tone:cloud?.status==='available'&&!cloud.stale?'neutral':'warn',text:cloud?.status==='available'?`${value(cloud.valueMsl,'m MSL')}${cloud.stale?' · starší běh / obnova nepotvrzena':''}`:'Pro bod/čas není hodnota dostupná'});
  const sat=satelliteState(snapshot.satellite,now);
  rows.push({name:'Satelit',tone:sat.status==='available'?'neutral':'warn',text:sat.image?`${stamp(snapshot.satellite.observedAt,snapshot.state.timezone)}${sat.status==='stale'?' · starší snímek':''}`:'Snímek není dostupný'});
 }
 for(const [name,error]of Object.entries(snapshot.sourceErrors||{}))if(error&&(mode==='full'||name==='aviation'))rows.push({name,tone:'warn',text:String(error)});
 return rows;
}
export function renderSourceReview(snapshot,options={}) {
 const rows=sourceReview(snapshot,options);
 return `<section class="handoff-review"><h2>Stav zachycených zdrojů</h2><p class="small">Stav při uložení. Kontrola dostupnosti dat, nikoli posouzení provedení letu. Podrobné časy a originály jsou níže.</p><ul>${rows.map(row=>`<li class="${row.tone==='warn'?'attention':''}"><strong>${esc(row.name)}</strong> · ${esc(row.text)}</li>`).join('')}</ul></section>`;
}
export function selectedForecastLines(snapshot) {
 const f=snapshot.forecast,i=f?nearestTimeIndex(f.times,snapshot.state.time):-1;
 if(i<0)return ['Pro čas přehledu není dostupný hodinový vzorek předpovědi.'];
 const at=key=>f.hourly[key]?.[i]??null;
 return [`${f.label} · hodinový vzorek ${stamp(f.times[i],snapshot.state.timezone)} · staženo ${stamp(f.retrievedAt,snapshot.state.timezone)} · běh modelu ${f.runTime?stamp(f.runTime,snapshot.state.timezone):'API neuvádí'}${f.transport?.stale?' · STARŠÍ DATA':''}`,
  `Vítr 10 m: ${value(at('wind'),'kt')} / nárazy ${value(at('gust'),'kt')} · směr odkud ${value(at('direction'),'°')}`,
  `Modelová dohlednost: ${value(at('visibility')===null?null:at('visibility')/1000,'km',1)} · nízká oblačnost ${value(at('cloudLow'),'%')} (pokrytí, nikoli ceiling)`,
  `Teplota / rosný bod 2 m: ${value(at('temperature'),'°C',1)} / ${value(at('dewpoint'),'°C',1)}`,
  `Srážky: ${value(at('precipitation'),'mm',1)} · nárazy a srážky za předchozí hodinu končící časem vzorku`,
  `Modelový tlak MSL: ${value(at('pressure'),'hPa')} (není měřený QNH/QFE)`];
}
function stations(snapshot){return [...new Set(['metar','taf'].flatMap(key=>{const s=snapshot.aviation?.[key];return [...array(s?.requestedStations),...array(s?.missingStations),...array(s?.items).map(item=>item.station).filter(Boolean)];}))].sort();}
function bulletin(snapshot,key,station){const item=array(snapshot.aviation?.[key]?.items).find(item=>item.station===station);if(!item)return `${key.toUpperCase()}: zpráva v balíčku není dostupná.`;
 const zone=snapshot.state.timezone,status=reportState(item,Date.parse(key==='metar'?snapshot.createdAt:snapshot.state.time));
 return `${key.toUpperCase()} · ${status.label}\n${key==='metar'?'Pozorování':'Vydání'} ${stamp(key==='metar'?item.observedAt:item.issuedAt,zone)}${key==='taf'?` · platnost ${stamp(item.validFrom,zone)} – ${stamp(item.validTo,zone)}`:''}\n${item.raw||'Originální text není dostupný.'}`;
}
export function renderReportPack(snapshot){
 const reports=stations(snapshot).map(station=>`<article class="bulletin-station"><h3>${esc(station)}</h3><pre>${esc(bulletin(snapshot,'metar',station))}</pre><pre>${esc(bulletin(snapshot,'taf',station))}</pre></article>`).join('');
 const sigmet=snapshot.aviation?.sigmet;
 return `<section class="report-pack"><h2>Regionální METAR / TAF · originální zprávy</h2><p class="small">METAR stav je hodnocen k uložení, TAF k času přehledu. Chybějící či prošlá zpráva není potvrzení dobrého počasí. Zdroj: NOAA Aviation Weather Center.</p><p class="small">METAR stažen ${esc(stamp(snapshot.aviation?.metar?.retrievedAt,snapshot.state.timezone))} · TAF stažen ${esc(stamp(snapshot.aviation?.taf?.retrievedAt,snapshot.state.timezone))}</p>${reports||'<p>Zprávy nejsou dostupné.</p>'}<h2>SIGMET · zachycený regionální balíček</h2><p class="small">Staženo ${esc(stamp(sigmet?.retrievedAt,snapshot.state.timezone))}. Výpis zachovává zprávy včetně těch mimo vybraný čas; rozhoduje uvedená platnost.</p>${array(sigmet?.items).map(item=>`<article class="bulletin-station"><h3>${esc(item.fir||'SIGMET')} · ${esc(reportState(item,Date.parse(snapshot.state.time)).label)}</h3><p>${esc(stamp(item.validFrom,snapshot.state.timezone))} – ${esc(stamp(item.validTo,snapshot.state.timezone))}</p><pre>${esc(item.raw||'Originální text nedostupný.')}</pre></article>`).join('')||'<p>V zachyceném balíčku nejsou zprávy SIGMET. Ověř zdroj; nejde o potvrzení bez výstrah.</p>'}</section>`;
}
export function formatBriefingText(snapshot,{mode='full'}={}){
 const zone=snapshot.state.timezone;
 const lines=[`HELI BRIEFING · ${snapshot.state.name}`,`Čas přehledu ${stamp(snapshot.state.time,zone)}`,`Zachyceno ${stamp(snapshot.createdAt,zone)} · ${snapshot.state.lat.toFixed(4)}° N, ${snapshot.state.lon.toFixed(4)}° E`,'', 'STAV ZACHYCENÝCH ZDROJŮ',...sourceReview(snapshot,{mode}).map(row=>`${row.tone==='warn'?'UPOZORNĚNÍ · ':''}${row.name}: ${row.text}`)];
 if(snapshot.notes?.trim())lines.push('','POZNÁMKY',snapshot.notes.trim());
 if(mode==='full'){
  lines.push('','MODELOVÝ VZOREK',...selectedForecastLines(snapshot));
  if(snapshot.comparison)lines.push('','POROVNÁVACÍ MODEL',...selectedForecastLines({...snapshot,forecast:snapshot.comparison}));
  const cloud=snapshot.clouds;lines.push(`Samostatný ICON-D2 CEILING: ${cloud?.status==='available'?value(cloud.valueMsl,'m MSL'):'nedostupný'} · vzorek ${stamp(cloud?.validAt,zone)}. Není pozorovaný ceiling ani AGL.`);
 }
 lines.push('','REGIONÁLNÍ ORIGINÁLNÍ ZPRÁVY');
 for(const station of stations(snapshot))lines.push('',station,bulletin(snapshot,'metar',station),bulletin(snapshot,'taf',station));
 lines.push('','SIGMET');
 for(const item of array(snapshot.aviation?.sigmet?.items))lines.push(`${item.fir||'SIGMET'} · ${reportState(item,Date.parse(snapshot.state.time)).label} · ${stamp(item.validFrom,zone)} – ${stamp(item.validTo,zone)}`,item.raw||'Originální text nedostupný.');
 if(!array(snapshot.aviation?.sigmet?.items).length)lines.push('Balíček neobsahuje SIGMET; nejde o potvrzení bez výstrah.');
 lines.push('','Zdroj zpráv: NOAA Aviation Weather Center. Modely: Open-Meteo / ČHMÚ / DWD / ECMWF.','Text zachycuje stav při uložení. Grafy, obrazové zdroje a úplná data zůstávají v plném HTML briefingu. Sám se neaktualizuje.');
 return lines.join('\n');
}

import {escapeHtml as esc} from './charts.js';
import {formatNumber,formatTime,formatCoordinates,reportState} from './briefing.js';
import {nearestTimeIndex} from './weather.js';
import {satelliteState} from './satellite.js';
import {routeText} from './route.js';
import {cameraState} from './cameras.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const value=(number,unit='',digits=0)=>finite(number)?`${formatNumber(number,digits)}${unit?' '+unit:''}`:'—';
const stamp=(time,zone)=>time&&Number.isFinite(Date.parse(time))?`${formatTime(time,zone,true).replace(' ',`${new Intl.DateTimeFormat('cs-CZ',{timeZone:zone,year:'numeric'}).format(new Date(time))} `)} ${zone==='UTC'?'UTC':'CZ'}`:'čas neuveden';
const array=value=>Array.isArray(value)?value:[];

/** Provider identity belongs to the captured product, including legacy files. */
export function reportProviderName(snapshot,key,item=null) {
 const feed=snapshot.aviation?.[key];
 for(const source of [item,feed,snapshot.aviation]){
  const identity=[source?.provider,source?.sourceName].filter(Boolean).join(' '),url=source?.sourceUrl||'';
  if(/swim|čhmú|chmi/i.test(identity)||/https?:\/\/swim\.chmi\.cz\//i.test(url))return 'ČHMÚ MET-SWIM';
  if(/awc|noaa|aviationweather/i.test(identity)||/https?:\/\/aviationweather\.gov\//i.test(url))return 'NOAA Aviation Weather Center';
 }
 return feed?.sourceName||snapshot.aviation?.sourceName||'poskytovatel neuveden';
}
export function reportSources(snapshot) {
 const names=['metar','taf','sigmet'].filter(key=>snapshot.aviation?.[key]).flatMap(key=>[reportProviderName(snapshot,key),...array(snapshot.aviation[key].items).map(item=>reportProviderName(snapshot,key,item))]);
 return [...new Set(names)].join(' / ')||'poskytovatel zpráv neuveden';
}
export function reportTransportNote(item) {
 if(!item||!(item.transportStatus==='stale'||item.transportStatus==='unavailable'||item.transport?.stale||item.refreshError))return '';
 const error=typeof item.refreshError==='object'?item.refreshError?.message:item.refreshError;
 return `Starší zachovaná zpráva; její obnova se nezdařila.${error?' '+String(error):''}`;
}
export function reportCoverageNotes(snapshot,key) {
 const feed=snapshot.aviation?.[key];
 if(!feed)return [];
 const notes=[];
 if(feed.status==='partial'||feed.transportStatus==='partial')notes.push('Načtení nebo pokrytí zdroje je částečné.');
 if(array(feed.missingStations).length)notes.push(`Ve zdroji chybí stanice ${feed.missingStations.join(', ')}; chybějící zprávy nejsou nahrazeny.`);
 if(array(feed.missingFirs).length)notes.push(`Ve zdroji chybí FIR ${feed.missingFirs.join(', ')}.`);
 if(feed.coverageComplete===false||['unknown','partial'].includes(feed.coverageStatus))notes.push(key==='sigmet'?'Úplnost aktuálního inventáře SIGMET není prokázána. Přítomnost, stáří ani prázdný výpis nepotvrzují nepřítomnost výstrah.':'Zdroj nepotvrzuje úplné pokrytí požadovaných zpráv.');
 return notes;
}
const directHistory=snapshot=>snapshot.aviation?.metar?.historyMethod==='browser-observed'||snapshot.aviation?.metar?.historyPartial===true;
const displayOnlyRadar=radar=>radar?.displayOnly===true||radar?.imageFetchStatus==='unsupported-cors';
const confirmedRadar=radar=>typeof radar?.url==='string'&&Number.isFinite(Date.parse(radar.observedAt));
function sourceLinks(snapshot){
 const urls=[...new Set(['metar','taf','sigmet'].map(key=>snapshot.aviation?.[key]?.sourceUrl).filter(Boolean))];
 return urls.map(value=>{try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol))return '';url.username='';url.password='';for(const key of [...url.searchParams.keys()])if(/token|password|signature|credential|api[-_]?key|^key$|^sig$/i.test(key))url.searchParams.delete(key);return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Původní zdroj zpráv ↗</a>`;}catch{return '';}}).filter(Boolean).join(' · ');
}

/** Readiness describes captured evidence, never flight permission. */
export function sourceReview(snapshot,{mode='full'}={}) {
 const now=Date.parse(snapshot.createdAt), selected=Date.parse(snapshot.state.time), rows=[];
 if(mode==='full'){
  if(snapshot.route?.rows?.length){const route=snapshot.route,missing=route.loading||route.rows.some(row=>!row.passageAt||row.samples.some(sample=>sample.status!=='available'||sample.stale)||row.ceiling.status!=='available'||row.ceiling.stale);rows.push({name:'Trasa',tone:missing?'warn':'neutral',text:`${route.rows.length} bodů${missing?' · neúplné / starší vzorky nebo probíhající obnova':' · zachycené bodové vzorky'}`});}
  if(snapshot.route?.rows?.length>=2&&!snapshot.route.section)rows.push({name:'Řez / terén',tone:'warn',text:'Řez nebyl před uložením načten nebo právě probíhala jeho obnova; zachyceny jsou pouze bodové vzorky.'});
  const f=snapshot.forecast,i=f?nearestTimeIndex(f.times,snapshot.state.time):-1;
  const missing=i<0||['wind','temperature','visibility'].some(key=>!finite(f?.hourly?.[key]?.[i]));
  rows.push({name:f?.label||'Předpověď',tone:!f||missing||f.transport?.stale?'warn':'neutral',text:!f?'Nedostupná':missing?'Vybraný vzorek má chybějící hodnoty':f.transport?.stale?'Starší data po chybě obnovy':`Hodinový vzorek ${stamp(f.times[i],snapshot.state.timezone)}`});
 }
 for(const [key,name]of [['metar','METAR'],['taf','TAF'],['sigmet','SIGMET']]){
  const feed=snapshot.aviation?.[key], retrieved=Date.parse(feed?.retrievedAt), old=!Number.isFinite(retrieved)||retrieved>now+300000||now-retrieved>3600000;
  const ageNote=!Number.isFinite(retrieved)?'čas stažení chybí / není platný':retrieved>now+300000?'budoucí čas stažení':'balíček starší než 1 h';
  const exceptional=array(feed?.items).filter(item=>reportState(item,key==='metar'?now:selected).tone!=='neutral').length;
  const retained=array(feed?.items).filter(item=>reportTransportNote(item)).length,coverage=reportCoverageNotes(snapshot,key);
  rows.push({name,tone:!feed||old||['partial','stale','unavailable'].includes(feed.status)||exceptional||retained||coverage.length?'warn':'neutral',text:!feed?'Zdroj nedostupný':`${reportProviderName(snapshot,key)} · ${feed.status==='empty'?'Prázdný balíček':`${array(feed.items).length} zpráv`}${old?' · '+ageNote:''}${['stale','unavailable'].includes(feed.status)?' · obnova nepotvrzena':''}${exceptional?` · ${exceptional} zpráv s upozorněním`:''}${retained?` · ${retained} zpráv zachováno po chybě obnovy`:''}${coverage.length?' · '+coverage.join(' '):''}`});
 }
 if(mode==='full'){
  const other=snapshot.comparison;
  if(other){const i=nearestTimeIndex(other.times,snapshot.state.time);rows.push({name:`Porovnání ${other.label}`,tone:i<0||other.transport?.stale?'warn':'neutral',text:i<0?'Pro vybraný čas není vzorek':`${stamp(other.times[i],snapshot.state.timezone)}${other.transport?.stale?' · starší data po chybě obnovy':''}`});}
  const cloud=snapshot.clouds;
  rows.push({name:'ICON-D2 CEILING',tone:cloud?.status==='available'&&!cloud.stale?'neutral':'warn',text:cloud?.status==='available'?`${value(cloud.valueMsl,'m MSL')}${cloud.stale?' · starší běh / obnova nepotvrzena':''}`:`Pro bod/čas není hodnota dostupná${cloud?.error?' · '+String(cloud.error):''}`});
  if(directHistory(snapshot))rows.push({name:'Historie METAR',tone:'warn',text:'Neúplná historie: pouze skutečné zprávy zachycené tímto prohlížečem během posledních nejvýše 12 h. Zdroj neposkytuje počáteční dvanáctihodinový archiv.'});
  const radar=snapshot.aviation?.radar;
  if(radar)rows.push({name:'Radar ČHMÚ',tone:displayOnlyRadar(radar)||!snapshot.radarImageDataUrl||radar.status==='stale'?'warn':'neutral',text:displayOnlyRadar(radar)?`${confirmedRadar(radar)?`Pozorování ${stamp(radar.observedAt,snapshot.state.timezone)}`:'Radarový obraz nebyl potvrzeně načten'} · zobrazení pouze online; CORS neumožňuje vložit obraz do offline briefingu. Uloženy dostupné časy a odkaz.`:snapshot.radarImageDataUrl?`Vložený snímek ${stamp(radar.imageObservedAt||radar.observedAt,snapshot.state.timezone)}${radar.status==='stale'?' · starší snímek':''}`:'Obraz není vložen; zachovány dostupné časy a zdroj.'});
  const cameras=array(snapshot.cameras?.items), good=cameras.filter(item=>cameraState(item,now)==='available').length;
  rows.push({name:'Kamery ČHMÚ',tone:good===3&&!snapshot.cameras?.transportError?'neutral':'warn',text:snapshot.cameras?.delivery==='browser-direct'?`Původní tři pohledy nejsou přímo dostupné pro vložení v prohlížeči; zachovány odkazy na oficiální zdroje.`:`${good} / 3 aktuálních rámců · nezávislé na budoucím čase${snapshot.cameras?.transportError?' · obnova nepotvrzena':''}`});
  if(snapshot.cameras?.onlineViewer)rows.push({name:'Městská kamera · Radnice',tone:'warn',text:'Samostatný městský pohled, nikoli náhrada kamery ČHMÚ. Pouze online; přesný čas pořízení není poskytován a video není zachyceno v souboru.'});
  const swl=snapshot.charts?.swl, swlValid=Boolean(swl?.imageDataUrl)&&selected>=Date.parse(swl.validFrom)&&selected<Date.parse(swl.validTo);
  rows.push({name:'SWL ČHMÚ',tone:swlValid&&swl.status!=='stale'&&!snapshot.charts?.transportError?'neutral':'warn',text:snapshot.charts?.delivery==='browser-direct'&&!swl?.imageDataUrl?'Automatické vložení v prohlížeči není dostupné; zachován odkaz na oficiální produkt.':swlValid?`Vložená mapa pokrývá čas přehledu${swl.status==='stale'?' · obnova nepotvrzena':''}`:'Vložená mapa není dostupná nebo nepokrývá čas přehledu'});
  const low=snapshot.charts?.selectedLow;
  rows.push({name:'Nízká oblačnost ČHMÚ',tone:low?.imageDataUrl&&snapshot.charts?.lowCloud?.status!=='stale'&&!snapshot.charts?.transportError?'neutral':'warn',text:snapshot.charts?.delivery==='browser-direct'&&!low?.imageDataUrl?'Automatické vložení v prohlížeči není dostupné; zachován odkaz na oficiální produkt.':low?.imageDataUrl?`Mapa ${stamp(low.validAt,snapshot.state.timezone)} · vydání neposkytnuto`:'Pro vybraný čas není vložená mapa'});
  if(snapshot.route?.section){const section=snapshot.route.section, missing=section.rows.filter(row=>!row.validAt||row.stale||row.error||row.profile.status!=='available').length;rows.push({name:'Řez / terén',tone:missing||section.terrain.status!=='available'?'warn':'neutral',text:`${section.rows.length} sloupců${missing?` · ${missing} neúplných / starších`:''} · terén ${section.terrain.values.filter(finite).length} / ${section.terrain.values.length} · m Bpv, oddělený od MSL`});}
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
 const transport=reportTransportNote(item);
 return `${key.toUpperCase()} · ${status.label} · ${reportProviderName(snapshot,key,item)}\n${key==='metar'?'Pozorování':'Vydání'} ${stamp(key==='metar'?item.observedAt:item.issuedAt,zone)}${key==='taf'?` · platnost ${stamp(item.validFrom,zone)} – ${stamp(item.validTo,zone)}`:''}${item.retrievedAt?`\nTato zpráva stažena ${stamp(item.retrievedAt,zone)}`:''}${transport?'\nUPOZORNĚNÍ · '+transport:''}\n${item.raw||'Originální text není dostupný.'}`;
}
export function renderReportPack(snapshot){
 const reports=stations(snapshot).map(station=>`<article class="bulletin-station"><h3>${esc(station)}</h3><pre>${esc(bulletin(snapshot,'metar',station))}</pre><pre>${esc(bulletin(snapshot,'taf',station))}</pre></article>`).join('');
 const sigmet=snapshot.aviation?.sigmet;
 const coverage=['metar','taf','sigmet'].flatMap(key=>reportCoverageNotes(snapshot,key).map(note=>`<p class="attention">${key.toUpperCase()}: ${esc(note)}</p>`)).join('');
 return `<section class="report-pack"><h2>Regionální METAR / TAF · originální zprávy</h2><p class="small">METAR stav je hodnocen k uložení, TAF k času přehledu. Chybějící či prošlá zpráva není potvrzení dobrého počasí. Zdroj: ${esc(reportSources(snapshot))}.</p><p class="small">METAR stažen ${esc(stamp(snapshot.aviation?.metar?.retrievedAt,snapshot.state.timezone))} · TAF stažen ${esc(stamp(snapshot.aviation?.taf?.retrievedAt,snapshot.state.timezone))}. Časy jednotlivých zpráv zůstávají vlastní.</p><p class="small">${sourceLinks(snapshot)}</p>${coverage}${reports||'<p>Zprávy nejsou dostupné.</p>'}<h2>SIGMET · zachycený regionální výpis</h2><p class="small">Zdroj ${esc(reportProviderName(snapshot,'sigmet'))} · staženo ${esc(stamp(sigmet?.retrievedAt,snapshot.state.timezone))}. Výpis zachovává zprávy včetně těch mimo vybraný čas; rozhoduje uvedená platnost.</p>${array(sigmet?.items).map(item=>`<article class="bulletin-station"><h3>${esc(item.fir||'SIGMET')} · ${esc(reportState(item,Date.parse(snapshot.state.time)).label)}</h3><p>${esc(reportProviderName(snapshot,'sigmet',item))} · ${esc(stamp(item.validFrom,snapshot.state.timezone))} – ${esc(stamp(item.validTo,snapshot.state.timezone))}</p>${reportTransportNote(item)?`<p class="attention">${esc(reportTransportNote(item))}</p>`:''}<pre>${esc(item.raw||'Originální text nedostupný.')}</pre></article>`).join('')||'<p>V zachyceném výpisu nejsou zprávy SIGMET. Ověř zdroj; nejde o potvrzení bez výstrah.</p>'}</section>`;
}
export function formatBriefingText(snapshot,{mode='full'}={}){
 const zone=snapshot.state.timezone;
 const lines=[`HELI BRIEFING · ${snapshot.state.name}`,`Čas přehledu ${stamp(snapshot.state.time,zone)}`,`Zachyceno ${stamp(snapshot.createdAt,zone)} · ${formatCoordinates(snapshot.state.lat,snapshot.state.lon)}`,'', 'STAV ZACHYCENÝCH ZDROJŮ',...sourceReview(snapshot,{mode}).map(row=>`${row.tone==='warn'?'UPOZORNĚNÍ · ':''}${row.name}: ${row.text}`)];
 if(snapshot.notes?.trim())lines.push('','POZNÁMKY',snapshot.notes.trim());
 if(mode==='full'){
  lines.push('','MODELOVÝ VZOREK',...selectedForecastLines(snapshot));
  if(snapshot.comparison)lines.push('','POROVNÁVACÍ MODEL',...selectedForecastLines({...snapshot,forecast:snapshot.comparison}));
  const cloud=snapshot.clouds;lines.push(`Samostatný ICON-D2 CEILING: ${cloud?.status==='available'?value(cloud.valueMsl,'m MSL'):'nedostupný'} · vzorek ${stamp(cloud?.validAt,zone)}. Není pozorovaný ceiling ani AGL.`);
  lines.push(...routeText(snapshot.route,zone));
  if(snapshot.route?.section){const section=snapshot.route.section;lines.push('',`ŘEZ · ${section.label} · ${section.rows.length} sloupců`, `Terén ČÚZK: ${section.terrain.values.filter(finite).length} / ${section.terrain.values.length} vzorků m Bpv; oddělený od meteorologického MSL. Není analýzou překážek.`);}
  lines.push('', 'KAMERY ČHMÚ',...array(snapshot.cameras?.items).map(item=>`${item.name} · ${stamp(item.observedAt,zone)} · ${cameraState(item,Date.parse(snapshot.createdAt))}${item.pageUrl?' · zdroj '+item.pageUrl:''}${item.reason==='cors'?' · obraz není v prohlížeči dostupný pro vložení':''}`));
  const viewer=snapshot.cameras?.onlineViewer;
  if(viewer)lines.push('MĚSTSKÁ KAMERA · SAMOSTATNÝ POHLED',`${viewer.provider||'Město České Budějovice'} · ${viewer.name||'Radnice'} · pouze online; přesný čas pořízení není poskytován; video není v uloženém souboru.`,viewer.viewerUrl||viewer.pageUrl||'https://www.c-budejovice.cz/webove-kamery');
  const swl=snapshot.charts?.swl, low=snapshot.charts?.selectedLow;
  lines.push(`SWL ČHMÚ: ${stamp(swl?.validFrom,zone)} – ${stamp(swl?.validTo,zone)} · vydáno ${stamp(swl?.issuedAt,zone)} · obraz ${swl?.imageDataUrl?'vložen v HTML':'nedostupný'}${swl?.pageUrl?' · zdroj '+swl.pageUrl:''}`,`Nízká oblačnost ČHMÚ: ${stamp(low?.validAt,zone)} · čas vydání neposkytnut · obraz ${low?.imageDataUrl?'vložen v HTML':'nedostupný'}${snapshot.charts?.lowCloud?.pageUrl?' · zdroj '+snapshot.charts.lowCloud.pageUrl:''}`);
  const radar=snapshot.aviation?.radar;
  if(radar)lines.push(`RADAR ČHMÚ · ${confirmedRadar(radar)?stamp(radar.observedAt,zone):'obraz nebyl potvrzeně načten'} · ${displayOnlyRadar(radar)?'pouze online, obraz kvůli CORS není vložen; zachován čas a odkaz':snapshot.radarImageDataUrl?'obraz vložen v HTML':'obraz nebyl zachycen'}`,radar.url||radar.sourceUrl||'Zdrojový odkaz není dostupný.');
 }
 lines.push('','REGIONÁLNÍ ORIGINÁLNÍ ZPRÁVY');
 for(const station of stations(snapshot))lines.push('',station,bulletin(snapshot,'metar',station),bulletin(snapshot,'taf',station));
 lines.push('','SIGMET');
 for(const item of array(snapshot.aviation?.sigmet?.items))lines.push(`${item.fir||'SIGMET'} · ${reportState(item,Date.parse(snapshot.state.time)).label} · ${reportProviderName(snapshot,'sigmet',item)} · ${stamp(item.validFrom,zone)} – ${stamp(item.validTo,zone)}`,...(reportTransportNote(item)?['UPOZORNĚNÍ · '+reportTransportNote(item)]:[]),item.raw||'Originální text nedostupný.');
 if(!array(snapshot.aviation?.sigmet?.items).length)lines.push('Balíček neobsahuje SIGMET; nejde o potvrzení bez výstrah.');
 lines.push('',`Zdroj zpráv: ${reportSources(snapshot)}. Modely: Open-Meteo / ČHMÚ / DWD / ECMWF.`,'Text zachycuje stav při uložení. Plný HTML briefing obsahuje skutečně zachycené grafy/data a výslovně označuje obrazové zdroje dostupné jen online. Sám se neaktualizuje.');
 return lines.join('\n');
}

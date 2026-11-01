import { renderChart } from './charts.js';
export function renderAstronomyChart(astronomy, time, timezone, width=600) {
 const p=astronomy?.profile;
 if(!p?.times?.length) return '';
 return `<div class="astronomy-chart"><h3>Slunce a Měsíc · 48 hodin</h3>${renderChart({times:p.times,series:[{label:'Slunce',values:p.sunAltitude,color:'var(--chart-amber)',unit:'°'},{label:'Měsíc',values:p.moonAltitude,color:'var(--chart-cyan)',unit:'°'},{label:'Civilní hranice Slunce −6°',values:p.times.map(()=>-6),color:'#83919c',dash:true,unit:'°'}],selectedTime:time,timezone,width,height:260,min:-90,max:90,yLabel:'výška °'})}<p class="chart-caption">Vypočtená výška nad astronomickým obzorem, krok 30 min. 0° je obzor; −6° je civilní hranice Slunce. Dva dny od půlnoci UTC zvoleného dne, osa v ${timezone==='UTC'?'UTC':'CZ'}. Terénní horizont, oblačnost ani skutečné osvětlení nejsou zahrnuty.</p></div>`;
}

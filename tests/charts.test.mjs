import test from 'node:test';
import assert from 'node:assert/strict';

test('observations can show individual samples without connecting unmeasured intervals', () => {
  const html = renderChart({ times: ['2026-11-01T10:00:00Z', '2026-11-01T12:00:00Z', '2026-11-01T13:00:00Z'], series: [{ label: 'Observed', values: [0, null, 3], pointsOnly: true }] });
  assert.equal((html.match(/class="chart-observation"/g) || []).length, 2);
  assert.ok(!html.includes('class="chart-line"'));
});
import { renderChart, buildTimeTicks, niceTicks, indexFromPointer, escapeHtml } from '../web/js/charts.js';

const hours = (start, count) => Array.from({ length: count }, (_, index) => new Date(Date.parse(start) + index * 3600000).toISOString());

test('missing samples split paths and zero remains an actual reading', () => {
  const svg = renderChart({
    times: hours('2026-11-01T00:00:00Z', 5),
    series: [{ key: 'rain', label: 'Srážky', values: [0, 1, null, 2, 0], unit: 'mm' }], min: 0,
  });
  assert.equal((svg.match(/class="chart-line"/g) || []).length, 2);
  assert.match(svg, /Srážky: 0 mm/);
  assert.match(svg, /Srážky: bez dat mm/);
  assert.match(svg, /data-index="4"/);
});

test('entirely missing series show an explicit empty state', () => {
  const svg = renderChart({ times: hours('2026-11-01T00:00:00Z', 3), series: [{ values: [null, null, null] }] });
  assert.match(svg, /Pro zvolené období nejsou data/);
  assert.doesNotMatch(svg, /chart-line/);
});

test('24 to 72 hour ticks retain sample times and show calendar rollover', () => {
  for (const length of [25, 49, 73]) {
    const times = hours('2026-11-01T18:00:00Z', length);
    const ticks = buildTimeTicks(times, 'UTC');
    assert.equal(ticks.length, 7);
    assert.equal(ticks[0].index, 0);
    assert.equal(ticks.at(-1).index, times.length - 1);
    assert.equal(ticks[0].label, '18:00');
    assert.ok(ticks.filter((tick) => tick.dateLabel).length >= 2);
    assert.ok(ticks.every((tick) => tick.time === times[tick.index]));
  }
});

test('Prague autumn clock change retains two different instants at the same local hour', () => {
  const times = hours('2026-10-25T00:00:00Z', 4);
  const ticks = buildTimeTicks(times, 'Europe/Prague');
  assert.equal(ticks[0].label, '02:00');
  assert.equal(ticks[1].label, '02:00');
  assert.notEqual(ticks[0].time, ticks[1].time);
});

test('out-of-range inspected times never draw a false current cursor', () => {
  const options = { times: hours('2026-11-01T00:00:00Z', 3), series: [{ values: [1, 2, 3] }] };
  assert.match(renderChart({ ...options, selectedTime: options.times[1] }), /class="chart-cursor"/);
  assert.doesNotMatch(renderChart({ ...options, selectedTime: '2026-11-02T00:00:00Z' }), /class="chart-cursor"/);
});

test('pointer selection follows actual timestamps, not equal sample spacing', () => {
  const times = ['2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z', '2026-11-01T10:00:00Z'];
  const svg = { getBoundingClientRect: () => ({ left: 0, width: 720 }), dataset: {} };
  assert.equal(indexFromPointer({ clientX: 48 + (720 - 48 - 18) * 0.5 }, svg, times), 1);
  assert.equal(indexFromPointer({ clientX: -100 }, svg, times), 0);
  assert.equal(indexFromPointer({ clientX: 900 }, svg, times), 2);
});

test('HTML from labels is escaped and external paint values are rejected', () => {
  const svg = renderChart({
    times: hours('2026-11-01T00:00:00Z', 2),
    series: [{ key: '"><script>', label: '<script>alert(1)</script>', color: 'url(https://example.com/a)', values: [1, 2] }],
  });
  assert.doesNotMatch(svg, /<script>/);
  assert.doesNotMatch(svg, /url\(https:/);
  assert.match(svg, /&lt;script&gt;/);
  assert.equal(escapeHtml('a"&'), 'a&quot;&amp;');
});

test('nice scale ticks cover signed and constant values without floating artefacts', () => {
  assert.deepEqual(niceTicks(-5, 5), [-5, -2.5, 0, 2.5, 5]);
  assert.ok(niceTicks(1013, 1013).length >= 2);
  assert.deepEqual(niceTicks(Number.NaN, 2), []);
});

test('invalid time ordering is an explicit failure rather than an invented plot', () => {
  const svg = renderChart({ times: ['2026-11-01T01:00:00Z', '2026-11-01T00:00:00Z'], series: [{ values: [1, 2] }] });
  assert.match(svg, /Časovou osu nelze zobrazit/);
  assert.doesNotMatch(svg, /chart-line/);
});


test('narrow charts retain the full horizon with fewer legible time ticks and matching pointer geometry', () => {
  const times = hours('2026-11-01T00:00:00Z', 48);
  const svg = renderChart({width:340,times,series:[{values:times.map((_,index)=>index)}]});
  assert.match(svg,/viewBox="0 0 340 190"/);
  assert.match(svg,/data-plot-right="322"/);
  assert.equal((svg.match(/class="chart-tick"/g)||[]).length,4);
  assert.match(svg,/data-index="47"/);
  const mock = {getBoundingClientRect:()=>({left:0,width:340}),viewBox:{baseVal:{width:340}},dataset:{plotLeft:'48',plotRight:'322'}};
  assert.equal(indexFromPointer({clientX:322},mock,times),47);
  assert.equal(indexFromPointer({clientX:48},mock,times),0);
});

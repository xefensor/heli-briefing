import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionAssets } from '../scripts/version-assets.mjs';
import { buildStaticSite } from '../scripts/build.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('versioned build keeps HTML assets and the full module graph resolvable', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'heli-assets-'));
  try {
    const site = join(temporary, 'dist');
    const { assetVersion: version } = await buildStaticSite({ source: join(root, 'web'), output: site, temporary: join(temporary, 'stage') });
    const html = await readFile(join(site, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+)["']/g)].map(match => match[1]);
    assert.equal(assets.length, 7);
    for (const asset of assets) { assert.ok(asset.startsWith(`./assets/${version}/`)); await readFile(join(site, asset)); }
    const probe = await readFile(join(site, 'assets', version, 'browser-sources.html'), 'utf8');
    for (const match of probe.matchAll(/\bfrom\s*['"](\.\/js\/[^'"]+)['"]/g)) await readFile(resolve(site, 'assets', version, match[1]));
    const scripts = join(site, 'assets', version, 'js');
    for (const name of await readdir(scripts)) {
      const text = await readFile(join(scripts, name), 'utf8');
      for (const match of text.matchAll(/\bfrom\s*['"](\.\.?\/[^'"]+)['"]/g)) await readFile(resolve(scripts, match[1]));
    }
    await assert.rejects(readdir(join(site, 'data')), { code: 'ENOENT' });
    assert.ok((await readFile(join(root, 'web/index.html'), 'utf8')).includes('src="./js/app.js"'));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('static artifact excludes collected weather and nested images while removing old deployment snapshots', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'heli-static-'));
  const source = join(temporary, 'web'), output = join(temporary, 'dist');
  const marker = 'LEGACY_WEATHER_MUST_NOT_BE_PUBLISHED';
  try {
    await mkdir(join(source, 'js'), { recursive: true });
    await mkdir(join(source, 'data', 'charts'), { recursive: true });
    await mkdir(join(output, 'data'), { recursive: true });
    await writeFile(join(source, 'index.html'), '<script type="module" src="./js/app.js"></script>');
    await writeFile(join(source, 'js/app.js'), 'export const browserOnly = true;');
    for (const name of ['aviation', 'cameras', 'charts', 'clouds', 'satellite']) {
      await writeFile(join(source, 'data', `${name}.json`), JSON.stringify({ marker, name }));
    }
    await writeFile(join(source, 'data/charts/frame.png'), marker);
    await writeFile(join(output, 'data/stale.json'), marker);
    const result = await buildStaticSite({ source, output, temporary: join(temporary, 'stage') });
    await assert.rejects(readdir(join(output, 'data')), { code: 'ENOENT' });
    assert.ok(result.files.every(name => name !== 'data' && !name.startsWith('data/')));
    for (const name of result.files) assert.ok(!(await readFile(join(output, name))).includes(Buffer.from(marker)), name);
    assert.equal(await readFile(join(source, 'data/charts/frame.png'), 'utf8'), marker);
    assert.match(await readFile(join(output, 'index.html'), 'utf8'), /assets\/[a-f\d]{20}\/js\/app\.js/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('weather snapshots do not change the asset version, but a module change does', async () => {
  const versions = [], temporary = await mkdtemp(join(tmpdir(), 'heli-version-'));
  try {
    for (let i = 0; i < 3; i++) {
      const site = join(temporary, String(i));
      await mkdir(join(site, 'js'), { recursive: true }); await mkdir(join(site, 'data'));
      await writeFile(join(site, 'index.html'), '<script type="module" src="./js/app.js"></script>');
      await writeFile(join(site, 'js/app.js'), i === 2 ? 'export const value = 2;' : 'export const value = 1;');
      await writeFile(join(site, 'data/weather.json'), JSON.stringify({ retrievedAt: i }));
      versions.push(await versionAssets(site));
    }
    assert.equal(versions[0], versions[1]); assert.notEqual(versions[1], versions[2]);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

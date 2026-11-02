import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionAssets } from '../scripts/version-assets.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));

test('versioned build keeps HTML assets and the full module graph resolvable', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'heli-assets-'));
  try {
    await cp(join(root, 'web'), temporary, { recursive: true });
    const version = await versionAssets(temporary);
    const html = await readFile(join(temporary, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+)["']/g)].map(match => match[1]);
    assert.equal(assets.length, 7);
    for (const asset of assets) { assert.ok(asset.startsWith(`./assets/${version}/`)); await readFile(join(temporary, asset)); }
    const probe = await readFile(join(temporary, 'assets', version, 'browser-sources.html'), 'utf8');
    for (const match of probe.matchAll(/\bfrom\s*['"](\.\/js\/[^'"]+)['"]/g)) await readFile(resolve(temporary, 'assets', version, match[1]));
    const scripts = join(temporary, 'assets', version, 'js');
    for (const name of await readdir(scripts)) {
      const text = await readFile(join(scripts, name), 'utf8');
      for (const match of text.matchAll(/\bfrom\s*['"](\.\.?\/[^'"]+)['"]/g)) await readFile(resolve(scripts, match[1]));
    }
    assert.equal((await readFile(join(temporary, 'data', 'aviation.json'), 'utf8')), await readFile(join(root, 'web/data/aviation.json'), 'utf8'));
    assert.ok((await readFile(join(root, 'web/index.html'), 'utf8')).includes('src="./js/app.js"'));
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

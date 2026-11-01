import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { versionAssets } from './version-assets.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'web');
const output = join(root, 'dist');
const temporary = join(root, '.cache', 'site-build');

// The published artifact contains only web assets, never repository metadata,
// tests, local configuration or provider credentials.
await readFile(join(source, 'index.html'), 'utf8');
await rm(temporary, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });
await cp(source, temporary, { recursive: true, dereference: false });
const assetVersion = await versionAssets(temporary);
for (const name of ['cameras', 'charts']) {
  try { await readFile(join(temporary, 'data', `${name}.json`)); }
  catch(error) { if(error.code !== 'ENOENT') throw error; await mkdir(join(temporary,'data'),{recursive:true}); await writeFile(join(temporary,'data',`${name}.json`),JSON.stringify(name==='cameras'?{schemaVersion:1,status:'unavailable',items:[]}:{schemaVersion:1,swl:{status:'unavailable'},lowCloud:{status:'unavailable',frames:[]}})); }
}
try {
  await readFile(join(temporary, 'data', 'clouds.json'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await mkdir(join(temporary, 'data'), { recursive: true });
  await writeFile(join(temporary, 'data', 'clouds.json'), `${JSON.stringify({
    schemaVersion: 1, status: 'unavailable', model: 'ICON-D2', product: 'CEILING',
    units: 'm MSL', points: [], frames: [], runTime: null, retrievedAt: null,
    error: 'Nativní sběr nebyl při tomto sestavení proveden.',
  })}\n`);
}
try { await readFile(join(temporary, 'data', 'satellite.json')); }
catch(error) {
  if(error.code !== 'ENOENT') throw error;
  await mkdir(join(temporary,'data'),{recursive:true});
  await writeFile(join(temporary,'data','satellite.json'),JSON.stringify({schemaVersion:1,status:'unavailable',error:'Satelitní sběr nebyl při sestavení proveden.'}));
}
await writeFile(join(temporary, '.nojekyll'), '');
await writeFile(join(temporary, 'build-info.json'), `${JSON.stringify({
  builtAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  assetVersion,
}, null, 2)}\n`);

const files = [];
async function inspect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Static artifact cannot contain symlinks: ${relative}`);
    if (entry.isDirectory()) await inspect(join(directory, entry.name), relative);
    else if (entry.isFile()) files.push(relative);
  }
}
await inspect(temporary);
if (!files.includes('index.html')) throw new Error('Missing site entrypoint');
await rm(output, { recursive: true, force: true });
await cp(temporary, output, { recursive: true });
await rm(temporary, { recursive: true, force: true });
console.log(`Built ${files.length} static files in dist/`);

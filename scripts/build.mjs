import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { versionAssets } from './version-assets.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
/** Package code/assets only. A local legacy snapshot must never become runtime data. */
export async function buildStaticSite({
  source = join(root, 'web'),
  output = join(root, 'dist'),
  temporary = join(root, '.cache', 'site-build'),
} = {}) {
  source = resolve(source);
  await readFile(join(source, 'index.html'), 'utf8');
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  await cp(source, temporary, {
    recursive: true,
    dereference: false,
    filter: entry => entry !== join(source, 'data'),
  });
  const assetVersion = await versionAssets(temporary);
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
  return { files, assetVersion };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files } = await buildStaticSite();
  console.log(`Built ${files.length} static files in dist/`);
}

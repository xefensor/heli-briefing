import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Move the complete relative asset graph together; runtime data stays at /data. */
export async function versionAssets(directory) {
  const roots = (await readdir(directory)).filter(name => !['index.html', 'data', '.nojekyll', 'build-info.json'].includes(name)).sort();
  const files = [];
  async function visit(path) {
    const entries = await readdir(join(directory, path), { withFileTypes: true });
    for (const entry of entries) {
      const name = `${path}/${entry.name}`;
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) files.push(name);
      else throw new Error(`Unexpected asset entry: ${name}`);
    }
  }
  const entries = await readdir(directory, { withFileTypes: true });
  for (const name of roots) {
    const entry = entries.find(item => item.name === name);
    if (entry.isDirectory()) await visit(name);
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected asset entry: ${name}`);
  }
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  const hash = createHash('sha256').update(html);
  for (const file of files.sort()) hash.update(file).update('\0').update(await readFile(join(directory, file))).update('\0');
  const version = hash.digest('hex').slice(0, 20);
  const destination = join(directory, 'assets', version);
  await mkdir(destination, { recursive: true });
  for (const name of roots) await rename(join(directory, name), join(destination, name));
  const available = new Set(files);
  const versioned = html.replace(/\b(src|href)=(['"])\.\/([^'"]+)\2/g, (match, attribute, quote, path) =>
    available.has(path) ? `${attribute}=${quote}./assets/${version}/${path}${quote}` : match);
  await writeFile(join(directory, 'index.html'), versioned);
  return version;
}

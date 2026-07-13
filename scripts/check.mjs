import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeFiles = ['app.js'];
for (const directory of ['src', 'scripts', 'tests']) {
  const names = await readdir(path.join(root, directory));
  codeFiles.push(...names.filter((name) => /\.(?:m?js)$/.test(name)).map((name) => path.join(directory, name)));
}

for (const file of codeFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const file of [
  'package.json',
  'package-lock.json',
  'background/manifest.json',
  'docs/manifest.schema.json',
  'examples/苏轼与北宋背景.showtime/00_manifest.json',
]) JSON.parse(await readFile(path.join(root, file), 'utf8'));

console.log(`Syntax and JSON verification passed: ${codeFiles.length} code files.`);

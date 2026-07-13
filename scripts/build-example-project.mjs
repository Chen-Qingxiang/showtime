import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from '../src/zip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'examples', '苏轼与北宋背景.showtime');
const outputFile = path.join(root, 'examples', '苏轼与北宋背景.showtime.zip');
const names = (await readdir(sourceDirectory)).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
const entries = await Promise.all(names.map(async (name) => ({ name, data: new Uint8Array(await readFile(path.join(sourceDirectory, name))) })));
await writeFile(outputFile, createZip(entries, { date: new Date('2026-07-13T00:00:00Z') }));
console.log(`Generated ${path.relative(root, outputFile)} with ${entries.length} entries.`);

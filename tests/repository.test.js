import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('背景 manifest 与仓库 40 个背景 CSV 保持一致', async () => {
  const manifest = JSON.parse(await readFile(new URL('../background/manifest.json', import.meta.url), 'utf8'));
  const files = (await readdir(new URL('../background/', import.meta.url))).filter((name) => name.endsWith('.csv'));
  assert.equal(manifest.length, 40);
  assert.equal(files.length, 40);
  assert.ok(manifest.every((entry) => entry.file.startsWith('background/') && files.includes(entry.file.slice('background/'.length))));
});

test('Manifest schema 与 fixture Manifest 都是有效 JSON', async () => {
  const schema = JSON.parse(await readFile(new URL('../docs/manifest.schema.json', import.meta.url), 'utf8'));
  const fixture = JSON.parse(await readFile(new URL('../examples/苏轼与北宋背景.showtime/00_manifest.json', import.meta.url), 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(fixture.format, 'showtime-project');
  assert.equal(fixture.version, '1.0');
  assert.ok(fixture.layers.some((layer) => layer.lod?.level === 'overview'));
  assert.ok(fixture.layers.some((layer) => layer.lod?.level === 'detailed'));
});

test('新模块中没有阻断主流程的 TODO 或占位异常', async () => {
  const names = (await readdir(new URL('../src/', import.meta.url))).filter((name) => name.endsWith('.js'));
  const source = (await Promise.all(names.map((name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')))).join('\n');
  assert.equal(/\bTODO\b|not implemented|暂未实现/i.test(source), false);
});

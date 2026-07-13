import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createZip } from '../src/zip.js';
import { createWorkspace, exportProjectArchive, importProjectArchive, normalizeWorkspace, workspaceFromCSVFiles } from '../src/project.js';

function buffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test('普通 CSV ZIP 和仅含 Markdown Manifest 的旧包仍可导入', async () => {
  const plain = createZip([{ name: '02_context.csv', data: '1000~1100,背景' }, { name: '01_main.csv', data: '1001,主线' }]);
  const first = await importProjectArchive(buffer(plain), { fileName: 'legacy.zip' });
  assert.equal(first.legacy, true);
  assert.equal(first.workspace.layers.length, 2);
  const markdown = createZip([{ name: '00_manifest.md', data: '# 旧研究\n\n说明' }, { name: 'main.csv', data: '1001,主线' }]);
  const second = await importProjectArchive(buffer(markdown), { fileName: 'old.zip' });
  assert.match(second.workspace.description, /说明/);
});

test('完整项目包恢复分组、角色、LOD、视图、探针和元数据', async () => {
  const manifest = {
    format: 'showtime-project', version: '1.0',
    project: { name: '苏轼研究', description: '测试' },
    groups: [{ id: 'main', name: '主线' }],
    layers: [
      { id: 'overview', name: '主线 overview', file: 'layers/overview.csv', role: 'primary', groupId: 'main', lod: { key: 'main', level: 'overview', switchSpan: 60 } },
      { id: 'detailed', name: '主线 detailed', file: 'layers/detailed.csv', role: 'primary', groupId: 'main', lod: { key: 'main', level: 'detailed', switchSpan: 60 } },
    ],
    views: [{ id: 'v1', name: '密州时期', view: { start: 1074, end: 1077 }, layers: [], groups: [] }],
    probes: [{ id: 'p1', time: 1079, windowMode: '1y' }],
    metadata: { events: 'event_meta.json', sources: 'sources.csv', references: 'references.md' },
  };
  const zip = createZip([
    { name: '00_manifest.json', data: JSON.stringify(manifest) },
    { name: 'layers/overview.csv', data: 'time,title\n1037~1101,苏轼一生' },
    { name: 'layers/detailed.csv', data: 'time,title\n1079,乌台诗案' },
    { name: 'event_meta.json', data: JSON.stringify({ events: [{ layer: '主线 detailed', time: '1079', title: '乌台诗案', description: '重要转折', tags: ['政治'] }] }) },
    { name: 'sources.csv', data: 'layer,time,title,source,page\n主线 detailed,1079,乌台诗案,宋史,338' },
    { name: 'references.md', data: '# 参考\n宋史' },
  ]);
  const result = await importProjectArchive(buffer(zip), { fileName: 'sushi.showtime.zip' });
  assert.equal(result.workspace.name, '苏轼研究');
  assert.equal(result.workspace.layers[1].events[0].metadata.description, '重要转折');
  assert.equal(result.workspace.layers[1].events[0].metadata.sources[0].page, '338');
  assert.equal(result.workspace.views.length, 1);
  assert.equal(result.workspace.probes.length, 1);
  assert.match(result.workspace.references, /宋史/);
});

test('Manifest 缺失文件和不支持版本进入质检报告', async () => {
  const missing = createZip([{ name: '00_manifest.json', data: JSON.stringify({ version: '1.0', layers: [{ name: 'lost', file: 'lost.csv' }] }) }]);
  const missingResult = await importProjectArchive(buffer(missing), { fileName: 'missing.zip' });
  assert.ok(missingResult.report.issues.some((entry) => entry.type === 'manifest_missing_file'));
  const future = createZip([{ name: '00_manifest.json', data: JSON.stringify({ version: '9.0' }) }, { name: 'main.csv', data: '2000,A' }]);
  const futureResult = await importProjectArchive(buffer(future), { fileName: 'future.zip' });
  assert.ok(futureResult.report.issues.some((entry) => entry.type === 'unsupported_version'));
  assert.equal(futureResult.workspace.layers.length, 1);
});

test('项目导出后重新导入保持关键状态', async () => {
  const initial = workspaceFromCSVFiles([{ fileName: 'main.csv', text: 'time,title\n1000~1010,A' }], { name: 'Roundtrip' }).workspace;
  initial.timeRange = { start: 900, end: 1200 };
  initial.layers[0].role = 'anchor';
  initial.layers[0].color = '#ff0000';
  initial.views = [{ id: 'v', name: '视图', view: { start: 999, end: 1005 }, layers: [], groups: [] }];
  initial.probes = [{ id: 'p', time: 1001, windowMode: 'exact' }];
  initial.layers[0].events[0].metadata = { description: '说明', people: ['A'] };
  const archive = exportProjectArchive(normalizeWorkspace(initial));
  const result = await importProjectArchive(buffer(archive), { fileName: 'roundtrip.showtime.zip' });
  assert.equal(result.workspace.name, 'Roundtrip');
  assert.deepEqual(result.workspace.timeRange, { start: 900, end: 1200 });
  assert.equal(result.workspace.layers[0].role, 'anchor');
  assert.equal(result.workspace.layers[0].color, '#ff0000');
  assert.equal(result.workspace.views[0].name, '视图');
  assert.equal(result.workspace.probes[0].time, 1001);
  assert.equal(result.workspace.layers[0].events[0].metadata.description, '说明');
});

test('仓库完整苏轼 fixture 可导入且没有 sidecar 歧义', async () => {
  const bytes = await readFile(new URL('../examples/苏轼与北宋背景.showtime.zip', import.meta.url));
  const result = await importProjectArchive(buffer(bytes), { fileName: '苏轼与北宋背景.showtime.zip' });
  assert.equal(result.workspace.layers.length, 6);
  assert.equal(result.workspace.views.length, 2);
  assert.equal(result.workspace.probes.length, 1);
  assert.equal(result.workspace.layers.flatMap((layer) => layer.events).length, 50);
  assert.equal(result.report.issues.filter((entry) => entry.type.startsWith('sidecar_')).length, 0);
  assert.ok(result.workspace.layers.flatMap((layer) => layer.events).filter((event) => event.metadata.description).length >= 4);
});

test('Manifest 引用缺失 sidecar 会逐项报告', async () => {
  const zip = createZip([
    { name: '00_manifest.json', data: JSON.stringify({ version: '1.0', project: { name: '缺失 sidecar' }, layers: [{ id: 'main', name: '主线', file: 'main.csv' }], metadata: { events: 'event_meta.json', sources: 'sources.csv', references: 'references.md' } }) },
    { name: 'main.csv', data: '2000,A' },
  ]);
  const result = await importProjectArchive(buffer(zip), { fileName: 'missing-sidecars.zip' });
  assert.equal(result.report.issues.filter((entry) => entry.type === 'manifest_missing_file').length, 3);
});

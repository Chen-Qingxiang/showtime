import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceFromCSVFiles, cloneWorkspace } from '../src/project.js';
import { searchWorkspace } from '../src/search.js';
import { compareProbes, createProbe, probeResults } from '../src/probes.js';
import { aggregateEvents, resolveLodLayers } from '../src/lod.js';
import { compareWorkspaces } from '../src/diff.js';
import { computeStatistics } from '../src/statistics.js';
import { applySharedView, createShareLink, decodeShareState, encodeShareState, extractShareView } from '../src/share.js';
import { deleteNamedView, moveGroup, moveLayer, renameGroup, restoreNamedView, saveNamedView, setGroupVisibility, setLayerSolo } from '../src/state.js';

function workspace() {
  const result = workspaceFromCSVFiles([
    { fileName: '01_main_detailed.csv', layerName: '苏轼主线 detailed', text: '1037~1101,苏轼\n1074~1076,密州任期\n1079,乌台诗案' },
    { fileName: '02_context.csv', layerName: '北宋政治', role: 'context', text: '1069~1085,王安石变法\n1127,靖康之变' },
  ], { name: '苏轼研究' });
  result.workspace.layers[0].events[1].metadata = { location: '密州', people: ['苏轼'], tags: ['任官'] };
  result.workspace.layers[0].events[2].metadata = { tags: ['政治', '案件'] };
  return result.workspace;
}

test('搜索标题、图层、元数据、时间范围和作用域', () => {
  const item = workspace();
  assert.equal(searchWorkspace(item, '苏轼 密州').events.length, 1);
  assert.equal(searchWorkspace(item, '乌台诗案').events.length, 1);
  assert.equal(searchWorkspace(item, '1074~1080').events.length, 4);
  assert.ok(searchWorkspace(item, '北宋政治').layers.length >= 1);
  assert.equal(searchWorkspace(item, '', { scope: 'primary' }).events.length, 3);
  assert.equal(searchWorkspace(item, '', { filters: { tags: ['任官'] } }).events.length, 1);
});

test('时间探针相交和双探针对比', () => {
  const item = workspace();
  const first = createProbe(1075, { id: 'a', windowMode: 'exact' });
  const second = createProbe(1080, { id: 'b', windowMode: 'exact' });
  const result = probeResults(item, first);
  assert.ok(result.total >= 3);
  const comparison = compareProbes(item, first, second);
  assert.ok(comparison.firstOnly.some((entry) => entry.event.title === '密州任期'));
  assert.ok(comparison.spansBoth.some((entry) => entry.event.title === '苏轼'));
  assert.ok(comparison.endsBetween.some((entry) => entry.event.title === '密州任期'));
  const custom = createProbe(1075, { windowMode: 'custom', customBefore: 0, customAfter: 10 });
  assert.ok(probeResults(item, custom).total > result.total);
});

test('图层 LOD 切换与密度聚合可解释', () => {
  const item = workspace();
  const detail = item.layers[0];
  detail.lod = { key: 'main', level: 'detailed', switchSpan: 50 };
  const overview = { ...cloneWorkspace(detail), id: 'overview', name: '苏轼主线 overview', lod: { key: 'main', level: 'overview', switchSpan: 50 }, order: 0 };
  detail.order = 1;
  item.layers.unshift(overview);
  assert.equal(resolveLodLayers(item, { start: 1000, end: 1200 }).layers.find((layer) => layer.lod)?.lod.level, 'overview');
  assert.equal(resolveLodLayers(item, { start: 1070, end: 1080 }).layers.find((layer) => layer.lod)?.lod.level, 'detailed');
  const aggregate = aggregateEvents(detail.events, { start: 1000, end: 1200 }, 10, { mode: 'aggregated' });
  assert.equal(aggregate.mode, 'aggregated');
  assert.match(aggregate.explanation, /分箱/);
});

test('数千条事件会进入有上限的聚合渲染路径', () => {
  const events = Array.from({ length: 5000 }, (_, index) => ({
    id: `bulk-${index}`,
    title: `事件 ${index}`,
    start: index / 10,
    end: index / 10,
    metadata: {},
  }));
  const aggregate = aggregateEvents(events, { start: 0, end: 500 }, 1200);
  assert.equal(aggregate.mode, 'aggregated');
  assert.ok(aggregate.items.length <= 120);
  assert.equal(aggregate.visibleCount, 5000);
});

test('命名视图保存、恢复和删除', () => {
  const item = workspace();
  item.view = { start: 1074, end: 1077 };
  item.probes = [createProbe(1075)];
  const saved = saveNamedView(item, '密州时期');
  item.view = { start: 0, end: 1 };
  item.probes = [];
  assert.equal(restoreNamedView(item, saved.id), true);
  assert.deepEqual(item.view, { start: 1074, end: 1077 });
  assert.equal(item.probes.length, 1);
  assert.equal(deleteNamedView(item, saved.id), true);
});

test('图层可跨组移动，分组可排序、改名、隐藏、调暗和独显', () => {
  const item = workspace();
  const sourceGroup = item.groups.find((group) => group.id === item.layers[0].groupId);
  const targetGroup = item.groups.find((group) => group.id !== sourceGroup.id);
  assert.equal(renameGroup(item, sourceGroup.id, '专题主线'), true);
  assert.equal(moveLayer(item, item.layers[0].id, 1, targetGroup.id), true);
  assert.equal(item.layers[1].groupId, targetGroup.id);
  assert.equal(moveGroup(item, targetGroup.id, 0), true);
  assert.equal(item.groups[0].id, targetGroup.id);
  assert.equal(setGroupVisibility(item, targetGroup.id, 'dim'), true);
  assert.equal(item.groups[0].dimmed, true);
  assert.equal(setGroupVisibility(item, sourceGroup.id, 'solo'), true);
  assert.equal(item.groups.find((group) => group.id === sourceGroup.id).visible, true);
  assert.equal(item.groups.find((group) => group.id === targetGroup.id).visible, false);
  assert.equal(setLayerSolo(item, item.layers[0].id), true);
  assert.equal(item.layers.filter((layer) => layer.solo).length, 1);
});

test('diff 识别新增、删除、时间、标题、图层和元数据变化', () => {
  const baseline = workspace();
  const current = cloneWorkspace(baseline);
  current.layers[0].events[1].rawTime = '1075~1076';
  current.layers[0].events[1].start = 1075;
  current.layers[0].events[2].title = '乌台诗案发生';
  current.layers[0].events[0].metadata = { notes: '新增研究笔记' };
  current.layers[1].name = '北宋制度背景';
  current.layers[1].events.pop();
  current.layers[0].events.push({ ...current.layers[0].events[2], id: 'new', title: '新事件', rawTime: '1081', start: 1081, end: 1081 });
  const diff = compareWorkspaces(current, baseline);
  assert.ok(diff.modified.some((entry) => entry.changes.includes('time')));
  assert.ok(diff.modified.some((entry) => entry.changes.includes('title')) || diff.possible.length);
  assert.ok(diff.modified.some((entry) => entry.changes.includes('metadata')));
  assert.ok(diff.modified.some((entry) => entry.changes.includes('layer')) || diff.possible.some((entry) => entry.changes.includes('layer')));
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.added.length, 1);
});

test('统计自动分箱并按图层与元数据汇总', () => {
  const stats = computeStatistics(workspace());
  assert.equal(stats.eventCount, 5);
  assert.equal(stats.byLayer.length, 2);
  assert.ok(stats.bins.length > 0);
  assert.equal(stats.facets.locations[0].label, '密州');
  assert.match(stats.disclaimer, /不等同于真实历史活动强度/);
});

test('分享状态可编码解码，本地项目明确不包含数据', () => {
  const item = workspace();
  item.probes = [createProbe(1079)];
  const state = extractShareView(item);
  assert.deepEqual(decodeShareState(encodeShareState(state)), state);
  const link = createShareLink(item, 'https://example.com/showtime/');
  assert.equal(link.ok, true);
  assert.match(link.warning, /不包含本地原始数据/);
  const target = workspace();
  target.view = { start: 0, end: 1 };
  assert.equal(applySharedView(target, state), true);
  assert.deepEqual(target.view, item.view);
});

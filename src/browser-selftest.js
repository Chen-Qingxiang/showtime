import { parseTimelineCSV } from './csv.js';
import { createWorkspace, normalizeWorkspace } from './project.js';
import { createProbe, probeResults } from './probes.js';
import { searchWorkspace } from './search.js';
import { workspaceToSVG } from './export.js';

export async function runBrowserSelfTests(renderer) {
  const checks = [];
  const add = async (name, test) => {
    try { checks.push({ name, passed: Boolean(await test()) }); }
    catch (error) { checks.push({ name, passed: false, error: error.message }); }
  };
  const parsed = parseTimelineCSV('time,title\n1074~1076,密州任期\n1079,乌台诗案', { layerId: 'selftest', layerName: '自测' });
  const workspace = normalizeWorkspace(createWorkspace({
    name: '浏览器自测',
    layers: [{ id: 'selftest', name: '自测', role: 'primary', groupId: 'group-primary', order: 0, color: '#4da3ff', visible: true, events: parsed.events }],
    view: { start: 1070, end: 1082 },
  }));
  await add('DOM 与 Canvas 可用', () => renderer.canvas instanceof HTMLCanvasElement && Boolean(renderer.context));
  await add('浏览器 CSV 管线', () => parsed.events.length === 2 && parsed.report.successfulEvents === 2);
  await add('浏览器搜索', () => searchWorkspace(workspace, '乌台诗案').events.length === 1);
  await add('浏览器时间探针', () => probeResults(workspace, createProbe(1075)).total === 1);
  await add('浏览器 SVG 为原生矢量', () => workspaceToSVG(workspace).includes('<rect') && !workspaceToSVG(workspace).includes('data:image/png'));
  const failed = checks.filter((check) => !check.passed);
  console.info(`[ShowTime browser self-test] ${checks.length - failed.length}/${checks.length} passed`, checks);
  return { passed: failed.length === 0, checks };
}

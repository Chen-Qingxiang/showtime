import { appendCSVFiles, cloneWorkspace, createWorkspace, getWorkspaceBounds, importProjectArchive, normalizeWorkspace, padRange, workspaceFromCSVFiles } from './src/project.js';
import { combineQualityReports, hashString, makeEventId } from './src/csv.js';
import { compareWorkspaces } from './src/diff.js';
import { exportDiffReport, exportFilteredCSV, exportLayerCSV, exportPNG, exportProject, exportQualityReport, exportSVG } from './src/export.js';
import { TimelineRenderer } from './src/renderer.js';
import { Minimap } from './src/minimap.js';
import { searchWorkspace } from './src/search.js';
import { compareProbes, createProbe, setProbeAt } from './src/probes.js';
import { computeStatistics } from './src/statistics.js';
import { applySharedView, createShareLink, readShareHash } from './src/share.js';
import { createAutosaver, deleteWorkspace, listWorkspaces, loadLastWorkspace, loadWorkspace, readPreferences, saveWorkspace, writePreferences } from './src/storage.js';
import { createEvent, createStore, deleteEvent, deleteNamedView, findEvent, moveGroup, moveLayer, renameGroup, renameLayer, renameNamedView, restoreNamedView, saveNamedView, setGroupVisibility, setLayerSolo, updateEvent } from './src/state.js';
import { parseTimeExpression } from './src/time.js';
import { bindTimelineInteractions } from './src/canvas-interactions.js';
import { runBrowserSelfTests } from './src/browser-selftest.js';
import { closeMenus, escapeHTML, renderDiff, renderEventDetails, renderLayers, renderProbePanel, renderProjectSummary, renderQuality, renderRecents, renderSearchResults, renderStatistics, renderViews, switchTab, toast, updateViewStatus } from './src/ui.js';

const EXAMPLES = [
  'examples/中国朝代.csv', 'examples/皇帝在位时间.csv', 'examples/皇帝在位时间_日期.csv',
  'examples/赵林-哲学家表.csv', 'examples/赵林-哲学家表_日期.csv', 'examples/宇宙与太阳系演化.csv',
  'examples/地质年代与生命演化.csv', 'examples/人类史与文明关键节点.csv', 'examples/文学与思想史.csv',
];
const FULL_EXAMPLE = 'examples/苏轼与北宋背景.showtime.zip';
const MIN_SPAN = 1 / (366 * 24 * 60 * 60);
const MAX_SPAN = 1e12;

let store;
let renderer;
let minimap;
let autosaver;
let currentLayerId = null;
let currentSearch = null;
let currentDiff = null;
let diffVisible = true;
let nextProbeIsSecond = false;
let backgroundLibrary = [];
let pendingSharedView = readShareHash();
let projectDialogMode = 'edit';

function isZip(file) {
  return /\.zip$/i.test(file?.name || '') || /zip/i.test(file?.type || '');
}

async function fetchBytes(path) {
  const response = await fetch(encodeURI(path), { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

async function fetchText(path) {
  const response = await fetch(encodeURI(path), { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function activeReport(workspace = store.get()) {
  return workspace.qualityReports?.[0] || null;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('浏览器未允许复制，请从地址栏复制链接。');
}

function clearWorkspaceSearch(workspace) {
  workspace.search.query = '';
  workspace.search.onlyMatches = false;
  if (workspace.search.originView) {
    workspace.view = { ...workspace.search.originView };
    delete workspace.search.originView;
  }
}

function updateSearch() {
  const workspace = store.get();
  currentSearch = searchWorkspace(workspace, workspace.search.query, {
    scope: workspace.search.scope,
    currentLayerId,
    filters: workspace.filters,
    viewport: workspace.view,
  });
  renderer.setSearch(currentSearch);
  renderSearchResults(currentSearch);
}

function renderAll(reason = 'update') {
  const workspace = store.get();
  renderProjectSummary(workspace);
  renderLayers(workspace, currentLayerId);
  renderViews(workspace);
  renderEventDetails(workspace, workspace.selectedEventId ? findEvent(workspace, workspace.selectedEventId) : null);
  renderProbePanel(workspace);
  renderQuality(activeReport(workspace));
  updateSearch();
  renderer.setWorkspace(workspace);
  renderer.setDiff(diffVisible ? currentDiff : null);
  minimap.setWorkspace(workspace);
  updateViewStatus(workspace, renderer.lastRenderInfo);
  document.getElementById('timeline-empty').hidden = workspace.layers.length > 0;
  document.getElementById('lod-mode').value = workspace.lodMode;
  document.getElementById('point-display-mode').value = workspace.pointDisplayMode;
  document.getElementById('global-search').value = workspace.search.query;
  document.getElementById('search-scope').value = workspace.search.scope;
  document.getElementById('dim-unmatched').checked = workspace.search.dimUnmatched;
  document.getElementById('only-matches').checked = workspace.search.onlyMatches;
  const filterCount = Object.values(workspace.filters || {}).filter((value) => Array.isArray(value) ? value.length : value !== '' && value != null && value !== false).length;
  const badge = document.getElementById('filter-count');
  badge.textContent = filterCount;
  badge.hidden = !filterCount;
  if (reason === 'import') switchTab('quality');
}

function renderViewOnly(reason = 'view') {
  const workspace = store.get();
  if (workspace.filters?.viewportOnly) updateSearch();
  renderer.setWorkspace(workspace);
  minimap.setWorkspace(workspace);
  updateViewStatus(workspace, renderer.lastRenderInfo);
  renderProbePanel(workspace);
}

function setView(view, reason = 'view') {
  if (!Number.isFinite(view.start) || !Number.isFinite(view.end) || view.end <= view.start) return;
  store.update((workspace) => { workspace.view = view; }, { reason });
}

function resetView() {
  const bounds = getWorkspaceBounds(store.get(), { includeHidden: true });
  setView(bounds ? padRange(bounds.start, bounds.end) : { start: -2200, end: new Date().getFullYear() }, 'reset-view');
}

function focusEvent(eventId, options = {}) {
  const match = findEvent(store.get(), eventId);
  if (!match) return;
  currentLayerId = match.layer.id;
  const duration = match.event.end - match.event.start;
  const minimum = { year: 12, month: 2, date: 0.08, hour: 0.004, minute: 0.0002, second: 0.00002 }[match.event.startPrecision] || 10;
  const span = Math.max(duration * 1.8, minimum);
  const center = (match.event.start + match.event.end) / 2;
  store.update((workspace) => {
    workspace.selectedEventId = eventId;
    if (options.navigate !== false) workspace.view = { start: center - span / 2, end: center + span / 2 };
  }, { reason: 'select-event' });
  switchTab('details');
}

function pinProbe(time, options = {}) {
  const second = options.second || nextProbeIsSecond;
  nextProbeIsSecond = false;
  store.update((workspace) => {
    workspace.probes = setProbeAt(workspace.probes, time, { second, precision: options.event?.startPrecision || 'year' });
  }, { reason: 'probe' });
  switchTab('probe');
}

function applyWorkspace(workspace, report = null, reason = 'open') {
  const normalized = normalizeWorkspace(workspace);
  if (report) normalized.qualityReports = [report, ...(normalized.qualityReports || []).filter((item) => item !== report)].slice(0, 10);
  if (pendingSharedView && (!pendingSharedView.projectName || pendingSharedView.projectName === normalized.name)) {
    applySharedView(normalized, pendingSharedView);
    if (pendingSharedView.requiresProjectPackage) toast('已把分享链接中的视图状态应用到本地项目。链接本身不包含原始数据。', 'warning');
    pendingSharedView = null;
  }
  currentLayerId = normalized.layers[0]?.id || null;
  currentDiff = null;
  store.set(normalized, reason);
}

async function refreshRecents() {
  try { renderRecents(await listWorkspaces()); } catch (error) { console.warn(error); }
}

function setAutosaveStatus(message, className = '') {
  const status = document.getElementById('autosave-status');
  status.textContent = message;
  status.className = className;
}

async function openProjectFile(file) {
  try {
    const result = await importProjectArchive(await file.arrayBuffer(), { fileName: file.name });
    applyWorkspace(result.workspace, result.report, 'import');
    toast(`已打开 ${result.workspace.name} · ${result.workspace.layers.length} 个图层`);
  } catch (error) { toast(`项目打开失败：${error.message}`, 'error'); }
}

function uniqueLayerName(workspace, base) {
  let name = base;
  let index = 2;
  while (workspace.layers.some((layer) => layer.name === name)) name = `${base} #${index++}`;
  return name;
}

function appendImportedWorkspace(imported, report) {
  const merge = document.getElementById('duplicate-layer-mode').value === 'merge';
  const target = cloneWorkspace(store.get());
  const groupMap = new Map();
  for (const group of imported.groups) {
    let existing = target.groups.find((entry) => entry.name === group.name);
    if (!existing) {
      existing = { ...group, id: `group-${hashString(`${group.name}-${Date.now()}-${target.groups.length}`)}`, order: target.groups.length };
      target.groups.push(existing);
    }
    groupMap.set(group.id, existing.id);
  }
  for (const source of imported.layers) {
    const existing = merge ? target.layers.find((layer) => layer.name === source.name) : null;
    if (existing) {
      for (const event of source.events) {
        const occurrence = existing.events.filter((item) => item.rawTime === event.rawTime && item.title === event.title).length + 1;
        existing.events.push({ ...event, layerId: existing.id, occurrence, id: makeEventId(existing.id, event.rawTime, event.title, occurrence) });
      }
    } else {
      const id = `layer-${hashString(`${source.id}-${Date.now()}-${target.layers.length}`)}`;
      const name = uniqueLayerName(target, source.name);
      target.layers.push({
        ...source, id, name, groupId: groupMap.get(source.groupId) || target.groups[0]?.id,
        order: target.layers.length,
        events: source.events.map((event) => ({ ...event, layerId: id, id: makeEventId(id, event.rawTime, event.title, event.occurrence) })),
      });
    }
  }
  target.qualityReports = [report, ...(target.qualityReports || [])].slice(0, 10);
  applyWorkspace(target, report, 'import');
}

async function addDataFiles(fileList) {
  const files = [...fileList];
  const csvSources = [];
  const reports = [];
  for (const file of files) {
    try {
      if (isZip(file)) {
        const result = await importProjectArchive(await file.arrayBuffer(), { fileName: file.name });
        appendImportedWorkspace(result.workspace, result.report);
        reports.push(result.report);
      } else {
        csvSources.push({ fileName: file.name, text: await file.text() });
      }
    } catch (error) { toast(`${file.name} 导入失败：${error.message}`, 'error'); }
  }
  if (csvSources.length) {
    const result = appendCSVFiles(store.get(), csvSources);
    applyWorkspace(result.workspace, result.report, 'import');
    reports.push(result.report);
  }
  if (reports.length > 1) {
    const combined = combineQualityReports(reports);
    store.update((workspace) => { workspace.qualityReports = [combined, ...workspace.qualityReports].slice(0, 10); }, { reason: 'import' });
  }
  if (files.length) toast(`已处理 ${files.length} 个文件；请查看质检报告。`);
}

async function loadRemoteLayers(items, label = '数据') {
  try {
    const sources = await Promise.all(items.map(async (item) => ({
      fileName: item.file,
      layerName: item.layerName || item.name || item.file.split('/').pop().replace(/\.csv$/i, ''),
      role: item.role,
      groupId: item.groupId,
      text: await fetchText(item.file),
    })));
    const result = appendCSVFiles(store.get(), sources);
    for (const source of sources) {
      const layer = result.workspace.layers.findLast((entry) => entry.name === source.layerName || entry.file === source.fileName);
      if (layer && source.role) layer.role = source.role;
    }
    applyWorkspace(result.workspace, result.report, 'import');
    toast(`已加载${label}：${sources.map((source) => source.layerName).join('、')}`);
  } catch (error) { toast(`${label}加载失败：${error.message}`, 'error'); }
}

async function openFullExample() {
  try {
    const result = await importProjectArchive(await fetchBytes(FULL_EXAMPLE), { fileName: FULL_EXAMPLE.split('/').pop(), projectUrl: new URL(FULL_EXAMPLE, location.href).href });
    result.workspace.source = { kind: 'builtin', projectUrl: new URL(FULL_EXAMPLE, location.href).href };
    applyWorkspace(result.workspace, result.report, 'import');
    toast('已打开完整示例“苏轼与北宋背景”。');
  } catch (error) { toast(`示例项目尚不可用：${error.message}`, 'error'); }
}

function recommendBackgrounds(limit = 3) {
  const workspace = store.get();
  const text = `${workspace.name} ${workspace.topic} ${workspace.description} ${workspace.layers.map((layer) => `${layer.name} ${layer.events.slice(0, 80).map((event) => event.title).join(' ')}`).join(' ')}`.toLowerCase();
  const vocabulary = {
    china: ['中国', '宋', '唐', '明', '清', '苏轼', '李清照'], politics: ['政治', '帝', '朝代', '战争', '政权', '变法'],
    philosophy: ['哲学', '思想', '康德', '孔子'], thought: ['思想', '哲学', '宗教'], literature: ['文学', '诗', '词', '小说', '艺术'],
    science: ['科学', '技术', '天文'], geology: ['地质', '生命', '演化'], 'deep-time': ['宇宙', '地质', '生命'],
    economy: ['经济', '金融', '贸易'], religion: ['宗教', '佛教', '基督', '伊斯兰'], war: ['战争', '军事'], japan: ['日本'],
  };
  const loaded = new Set(workspace.layers.map((layer) => layer.file));
  return backgroundLibrary.filter((entry) => !loaded.has(entry.file)).map((entry) => {
    let score = entry.tags.reduce((sum, tag) => sum + (vocabulary[tag] || [tag]).filter((word) => text.includes(word)).length * 4, 0);
    if (entry.name.includes('中国朝代') && /宋|苏轼|李清照|中国/.test(text)) score += 8;
    if (entry.name.includes('文学') && /诗|词|文学/.test(text)) score += 7;
    if (entry.name.includes('思想') && /哲学|思想/.test(text)) score += 7;
    return { ...entry, score };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN')).slice(0, limit);
}

function openProjectDialog(mode) {
  projectDialogMode = mode;
  const workspace = store.get();
  const form = document.getElementById('project-form');
  form.elements.name.value = mode === 'new' ? '未命名研究' : mode === 'saveas' ? `${workspace.name} 副本` : workspace.name;
  form.elements.topic.value = mode === 'new' ? '' : workspace.topic;
  form.elements.description.value = mode === 'new' ? '' : workspace.description;
  document.getElementById('project-dialog-title').textContent = mode === 'new' ? '新建研究项目' : mode === 'saveas' ? '另存命名工作区' : '项目信息';
  document.getElementById('project-dialog').showModal();
}

function openEventDialog({ eventId = '', layerId = '' } = {}) {
  const workspace = store.get();
  const match = eventId ? findEvent(workspace, eventId) : null;
  const layer = match?.layer || workspace.layers.find((entry) => entry.id === layerId) || workspace.layers[0];
  if (!layer) return toast('请先添加一个图层。', 'warning');
  const event = match?.event;
  const form = document.getElementById('event-form');
  form.reset();
  form.elements.eventId.value = event?.id || '';
  form.elements.layerId.value = layer.id;
  form.elements.rawTime.value = event?.rawTime || String(Math.round((workspace.view.start + workspace.view.end) / 2));
  form.elements.title.value = event?.title || '';
  const metadata = event?.metadata || {};
  for (const field of ['description', 'location', 'certainty', 'notes']) form.elements[field].value = metadata[field] || '';
  form.elements.people.value = (metadata.people || []).join('，');
  form.elements.tags.value = (metadata.tags || []).join('，');
  const source = metadata.sources?.[0] || {};
  for (const field of ['source', 'page', 'url', 'quotation']) form.elements[field].value = source[field] || '';
  form.elements.externalLinks.value = (metadata.externalLinks || []).join('，');
  document.getElementById('event-dialog-title').textContent = event ? '编辑事件' : `新增事件 · ${layer.name}`;
  document.querySelector('[data-action="delete-event"]').hidden = !event;
  document.getElementById('event-dialog').showModal();
}

function openFilterDialog() {
  const workspace = store.get();
  const form = document.getElementById('filter-form');
  form.reset();
  const filters = workspace.filters || {};
  [...form.querySelectorAll('[name="roles"]')].forEach((input) => { input.checked = (filters.roles || []).includes(input.value); });
  document.getElementById('filter-groups').innerHTML = `<legend>图层分组</legend>${workspace.groups.map((group) => `<label><input type="checkbox" name="groups" value="${escapeHTML(group.id)}"${(filters.groups || []).includes(group.id) ? ' checked' : ''}> ${escapeHTML(group.name)}</label>`).join('')}`;
  for (const field of ['tags', 'locations', 'people', 'timeStart', 'timeEnd']) form.elements[field].value = Array.isArray(filters[field]) ? filters[field].join('，') : filters[field] ?? '';
  form.elements.viewportOnly.checked = Boolean(filters.viewportOnly);
  document.getElementById('filter-dialog').showModal();
}

function splitValues(value) {
  return String(value || '').split(/[,，;；]/).map((entry) => entry.trim()).filter(Boolean);
}

function handleProjectSubmit(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.getElementById('project-dialog').close();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (!String(values.name).trim()) return;
  if (projectDialogMode === 'new') {
    applyWorkspace(createWorkspace({ name: values.name, topic: values.topic, description: values.description, view: { start: -2200, end: new Date().getFullYear() } }), null, 'new-project');
  } else if (projectDialogMode === 'saveas') {
    const copy = cloneWorkspace(store.get());
    copy.id = `workspace-${hashString(`${values.name}-${Date.now()}`)}`;
    Object.assign(copy, { name: values.name, topic: values.topic, description: values.description, createdAt: new Date().toISOString() });
    applyWorkspace(copy, null, 'save-as');
  } else {
    store.update((workspace) => Object.assign(workspace, { name: values.name, topic: values.topic, description: values.description }), { undoable: true, reason: 'project-edit' });
  }
  document.getElementById('project-dialog').close();
}

function handleEventSubmit(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.getElementById('event-dialog').close();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const metadata = {
    description: values.description, location: values.location, people: splitValues(values.people), tags: splitValues(values.tags),
    certainty: values.certainty, notes: values.notes, externalLinks: splitValues(values.externalLinks),
  };
  if (values.source || values.url || values.quotation) metadata.sources = [{ source: values.source, page: values.page, url: values.url, quotation: values.quotation }];
  let result;
  store.update((workspace) => {
    const layer = workspace.layers.find((entry) => entry.id === values.layerId);
    if (!layer) return;
    if (values.eventId) result = updateEvent(workspace, values.eventId, { rawTime: values.rawTime, title: values.title, metadata });
    else {
      result = createEvent(layer, values.rawTime, values.title, metadata);
      if (result.event) layer.events.push(result.event);
    }
    if (result?.report?.issues?.length) workspace.qualityReports = [combineQualityReports([result.report]), ...workspace.qualityReports].slice(0, 10);
    if (result?.event) workspace.selectedEventId = result.event.id;
  }, { undoable: true, reason: 'event-edit' });
  if (!result?.event && result?.ok !== true) return toast(result?.error || '事件时间无法解析，请检查格式。', 'error');
  document.getElementById('event-dialog').close();
  switchTab('details');
}

function handleAdvancedImport(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.getElementById('advanced-import-dialog').close();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  const result = appendCSVFiles(store.get(), [{ fileName: `${values.layerName}.csv`, layerName: values.layerName, role: values.role, groupId: values.groupId, text: values.csv }]);
  const added = result.workspace.layers.at(-1);
  if (added) { added.role = values.role; added.groupId = values.groupId; }
  applyWorkspace(result.workspace, result.report, 'import');
  document.getElementById('advanced-import-dialog').close();
}

function handleFilterSubmit(event) {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') return document.getElementById('filter-dialog').close();
  const form = event.currentTarget;
  const data = new FormData(form);
  const filters = {
    roles: data.getAll('roles'), groups: data.getAll('groups'), tags: splitValues(data.get('tags')),
    locations: splitValues(data.get('locations')), people: splitValues(data.get('people')),
    timeStart: data.get('timeStart'), timeEnd: data.get('timeEnd'), viewportOnly: data.get('viewportOnly') === 'on',
  };
  store.update((workspace) => { workspace.filters = filters; }, { reason: 'filters' });
  document.getElementById('filter-dialog').close();
  switchTab('search');
}

function handleLayerAction(action, target) {
  const workspace = store.get();
  const layerId = target.dataset.layerId;
  const groupId = target.dataset.groupId;
  const layer = workspace.layers.find((entry) => entry.id === layerId);
  const group = workspace.groups.find((entry) => entry.id === groupId);
  if (action === 'toggle-layer' && layer) store.update(() => { layer.visible = !layer.visible; }, { undoable: true, reason: 'layer' });
  else if (action === 'solo-layer' && layer) store.update((item) => setLayerSolo(item, layerId), { undoable: true, reason: 'layer' });
  else if (action === 'dim-layer' && layer) store.update(() => { layer.dimmed = !layer.dimmed; }, { undoable: true, reason: 'layer' });
  else if (action === 'rename-layer' && layer) { const name = prompt('图层名称', layer.name); if (name) store.update((item) => renameLayer(item, layerId, name), { undoable: true, reason: 'layer' }); }
  else if (action === 'move-layer-up' && layer) store.update((item) => moveLayer(item, layerId, Math.max(0, layer.order - 1)), { undoable: true, reason: 'layer' });
  else if (action === 'move-layer-down' && layer) store.update((item) => moveLayer(item, layerId, Math.min(item.layers.length, layer.order + 1)), { undoable: true, reason: 'layer' });
  else if (action === 'delete-layer' && layer && confirm(`删除图层“${layer.name}”及其中 ${layer.events.length} 个事件？`)) store.update((item) => { item.layers = item.layers.filter((entry) => entry.id !== layerId); if (item.selectedEventId && !findEvent(item, item.selectedEventId)) item.selectedEventId = null; }, { undoable: true, reason: 'layer' });
  else if (action === 'add-event' && layer) openEventDialog({ layerId });
  else if ((action === 'export-specific-layer') && layer) exportLayerCSV(layer);
  else if (action === 'toggle-group-collapse' && group) store.update(() => { group.collapsed = !group.collapsed; }, { reason: 'group' });
  else if (action === 'rename-group' && group) { const name = prompt('分组名称', group.name); if (name) store.update((item) => renameGroup(item, groupId, name), { undoable: true, reason: 'group' }); }
  else if (action === 'move-group-up' && group) store.update((item) => moveGroup(item, groupId, Math.max(0, group.order - 1)), { undoable: true, reason: 'group' });
  else if (action === 'move-group-down' && group) store.update((item) => moveGroup(item, groupId, Math.min(item.groups.length, group.order + 1)), { undoable: true, reason: 'group' });
  else if (action === 'toggle-group' && group) store.update((item) => setGroupVisibility(item, groupId), { undoable: true, reason: 'group' });
  else if (action === 'solo-group' && group) store.update((item) => setGroupVisibility(item, groupId, 'solo'), { undoable: true, reason: 'group' });
  else if (action === 'dim-group' && group) store.update((item) => setGroupVisibility(item, groupId, 'dim'), { undoable: true, reason: 'group' });
}

async function handleAction(action, target) {
  if (action === 'new-project') openProjectDialog('new');
  else if (action === 'save-workspace') { await saveWorkspace(store.get()); setAutosaveStatus('已保存', 'saved'); toast('工作区已保存到此浏览器。'); refreshRecents(); }
  else if (action === 'save-as-workspace') openProjectDialog('saveas');
  else if (action === 'edit-project') openProjectDialog('edit');
  else if (action === 'open-example-project') openFullExample();
  else if (action === 'advanced-import') document.getElementById('advanced-import-dialog').showModal();
  else if (action === 'load-background') { const entry = backgroundLibrary.find((item) => item.id === document.getElementById('background-select').value); if (entry) loadRemoteLayers([{ ...entry, role: 'background' }], '背景'); }
  else if (action === 'load-recommended') { const entries = recommendBackgrounds(); if (entries.length) loadRemoteLayers(entries.map((entry) => ({ ...entry, role: 'background' })), '推荐背景'); else toast('当前背景库都已加载。'); }
  else if (action === 'load-example') { const file = document.getElementById('example-select').value; if (file) loadRemoteLayers([{ file, role: 'primary' }], '示例'); }
  else if (action === 'toggle-left') { const opening = document.body.classList.contains('left-collapsed'); document.body.classList.toggle('left-collapsed'); if (opening && matchMedia('(max-width: 940px)').matches) document.body.classList.add('right-collapsed'); persistPanels(); setTimeout(() => renderer.resize(), 200); }
  else if (action === 'toggle-right') { const opening = document.body.classList.contains('right-collapsed'); document.body.classList.toggle('right-collapsed'); if (opening && matchMedia('(max-width: 940px)').matches) document.body.classList.add('left-collapsed'); persistPanels(); setTimeout(() => renderer.resize(), 200); }
  else if (action === 'toggle-diff') { diffVisible = !diffVisible; renderer.setDiff(diffVisible ? currentDiff : null); toast(diffVisible ? '已显示差异高亮。' : '已隐藏差异高亮。'); }
  else if (action === 'reset-view') resetView();
  else if (action === 'zoom-in') rendererInteractions.zoomAt(renderer.canvas.clientWidth / 2, 0.72);
  else if (action === 'zoom-out') rendererInteractions.zoomAt(renderer.canvas.clientWidth / 2, 1.38);
  else if (action === 'add-second-probe') { nextProbeIsSecond = true; toast('请在时间轴上点击第二个时点（B）。'); }
  else if (action === 'clear-probes') store.update((workspace) => { workspace.probes = []; }, { reason: 'probe' });
  else if (action === 'clear-search') store.update(clearWorkspaceSearch, { reason: 'search' });
  else if (action === 'open-filters') openFilterDialog();
  else if (action === 'clear-filters') { store.update((workspace) => { workspace.filters = {}; }, { reason: 'filters' }); document.getElementById('filter-dialog').close(); }
  else if (action === 'help') document.getElementById('help-dialog').showModal();
  else if (action === 'add-group') { const name = prompt('新分组名称', '新分组'); if (name) store.update((workspace) => workspace.groups.push({ id: `group-${hashString(`${name}-${Date.now()}`)}`, name, order: workspace.groups.length, collapsed: false, visible: true, dimmed: false }), { undoable: true, reason: 'group' }); }
  else if (action === 'save-view') { const name = prompt('视图名称', '新的研究视图'); if (name) store.update((workspace) => saveNamedView(workspace, name), { undoable: true, reason: 'view-save' }); }
  else if (action === 'restore-view') store.update((workspace) => restoreNamedView(workspace, target.dataset.viewId), { reason: 'view-restore' });
  else if (action === 'rename-view') { const view = store.get().views.find((item) => item.id === target.dataset.viewId); const name = prompt('视图名称', view?.name); if (name) store.update((workspace) => renameNamedView(workspace, target.dataset.viewId, name), { undoable: true, reason: 'view-save' }); }
  else if (action === 'delete-view') store.update((workspace) => deleteNamedView(workspace, target.dataset.viewId), { undoable: true, reason: 'view-save' });
  else if (action === 'refresh-recents') refreshRecents();
  else if (action === 'open-recent') { const workspace = await loadWorkspace(target.dataset.workspaceId); if (workspace) applyWorkspace(workspace, null, 'open'); }
  else if (action === 'select-layer') { currentLayerId = target.dataset.layerId; renderLayers(store.get(), currentLayerId); }
  else if (action === 'focus-event') focusEvent(target.dataset.eventId);
  else if (action === 'edit-event') openEventDialog({ eventId: target.dataset.eventId });
  else if (action === 'delete-event') { const id = document.getElementById('event-form').elements.eventId.value; if (id && confirm('删除这个事件？')) { store.update((workspace) => { deleteEvent(workspace, id); workspace.selectedEventId = null; }, { undoable: true, reason: 'event-edit' }); document.getElementById('event-dialog').close(); } }
  else if (action === 'remove-probe') store.update((workspace) => { workspace.probes = workspace.probes.filter((probe) => probe.id !== target.dataset.probeId); }, { reason: 'probe' });
  else if (action === 'focus-probe') { const probe = store.get().probes.find((item) => item.id === target.dataset.probeId); if (probe) { const span = Math.max((store.get().view.end - store.get().view.start) * .4, 2); setView({ start: probe.time - span / 2, end: probe.time + span / 2 }); } }
  else if (action === 'show-statistics-current') { renderStatistics(computeStatistics(store.get(), { layerIds: currentLayerId ? [currentLayerId] : [] })); switchTab('analysis'); }
  else if (action === 'show-statistics-all') { renderStatistics(computeStatistics(store.get())); switchTab('analysis'); }
  else if (action === 'show-diff') { renderDiff(currentDiff); switchTab('analysis'); }
  else if (action === 'zoom-bin') { setView({ start: Number(target.dataset.start), end: Number(target.dataset.end) }); }
  else if (action === 'export-project') exportProject(store.get());
  else if (action === 'export-layer') { const layer = store.get().layers.find((item) => item.id === currentLayerId) || store.get().layers[0]; if (layer) exportLayerCSV(layer); else toast('没有可导出的图层。', 'warning'); }
  else if (action === 'export-filtered') exportFilteredCSV(store.get(), currentSearch);
  else if (action === 'export-png') { try { await exportPNG(renderer, store.get().name); } catch (error) { toast(error.message, 'error'); } }
  else if (action === 'export-svg') exportSVG(store.get());
  else if (action === 'export-quality') { const report = activeReport(); if (report) exportQualityReport(report, store.get().name); else toast('尚无质检报告。', 'warning'); }
  else if (action === 'export-diff') { if (currentDiff) exportDiffReport(currentDiff, store.get().name); else toast('请先加载 baseline。', 'warning'); }
  else if (action === 'share') {
    const result = createShareLink(store.get());
    if (!result.ok) return toast(result.warning, 'error');
    try {
      await copyText(result.url);
      toast(`分享链接已复制。${result.warning ? `\n${result.warning}` : ''}`, result.warning ? 'warning' : '');
    } catch (error) {
      toast(`${error.message}\n${result.url}`, 'warning');
    }
  }
  else handleLayerAction(action, target);
  closeMenus();
}

function persistPanels() {
  writePreferences({ ...readPreferences(), leftCollapsed: document.body.classList.contains('left-collapsed'), rightCollapsed: document.body.classList.contains('right-collapsed') });
}

function bindForms() {
  document.getElementById('project-form').addEventListener('submit', handleProjectSubmit);
  document.getElementById('event-form').addEventListener('submit', handleEventSubmit);
  document.getElementById('advanced-import-form').addEventListener('submit', handleAdvancedImport);
  document.getElementById('filter-form').addEventListener('submit', handleFilterSubmit);
}

function bindUI() {
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) return switchTab(tab.dataset.tab);
    const action = event.target.closest('[data-action]');
    if (action) { event.preventDefault(); handleAction(action.dataset.action, action); }
    const layerRow = event.target.closest('.layer-row');
    if (layerRow && !event.target.closest('button,summary,label,select,input')) { currentLayerId = layerRow.dataset.layerId; renderLayers(store.get(), currentLayerId); }
  });
  document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    if (details.classList.contains('tool-menu')) closeMenus(details);
    if (details.classList.contains('context-menu')) {
      document.querySelectorAll('.context-menu[open]').forEach((item) => { if (item !== details) item.open = false; });
      requestAnimationFrame(() => {
        const summary = details.querySelector('summary');
        const menu = details.querySelector('.context-menu-popover');
        if (!summary || !menu) return;
        const rect = summary.getBoundingClientRect();
        menu.style.left = `${Math.max(6, Math.min(window.innerWidth - 194, rect.right - 188))}px`;
        menu.style.top = `${Math.max(6, Math.min(window.innerHeight - menu.offsetHeight - 6, rect.bottom + 4))}px`;
      });
    }
  }, true);
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target.id === 'lod-mode') store.update((workspace) => { workspace.lodMode = target.value; }, { reason: 'display' });
    else if (target.id === 'point-display-mode') store.update((workspace) => { workspace.pointDisplayMode = target.value; }, { reason: 'display' });
    else if (target.id === 'search-scope') store.update((workspace) => { workspace.search.scope = target.value; }, { reason: 'search' });
    else if (target.id === 'dim-unmatched') store.update((workspace) => { workspace.search.dimUnmatched = target.checked; }, { reason: 'search' });
    else if (target.id === 'only-matches') store.update((workspace) => { workspace.search.onlyMatches = target.checked; }, { reason: 'search' });
    else if (target.dataset.action === 'layer-color') store.update((workspace) => { const layer = workspace.layers.find((item) => item.id === target.dataset.layerId); if (layer) layer.color = target.value; }, { undoable: true, reason: 'layer' });
    else if (target.dataset.action === 'layer-role') store.update((workspace) => { const layer = workspace.layers.find((item) => item.id === target.dataset.layerId); if (layer) layer.role = target.value; }, { undoable: true, reason: 'layer' });
    else if (target.dataset.action === 'layer-group') store.update((workspace) => { const layer = workspace.layers.find((item) => item.id === target.dataset.layerId); if (layer) layer.groupId = target.value; }, { undoable: true, reason: 'layer' });
    else if (target.dataset.action === 'probe-window') store.update((workspace) => { const probe = workspace.probes.find((item) => item.id === target.dataset.probeId); if (probe) { probe.windowMode = target.value; if (target.value === 'custom') { probe.customBefore ||= 1; probe.customAfter ||= 1; } } }, { reason: 'probe' });
    else if (target.dataset.action === 'probe-time') { const parsed = parseTimeExpression(target.value); if (!parsed) toast('探针时间无法解析。', 'error'); else store.update((workspace) => { const probe = workspace.probes.find((item) => item.id === target.dataset.probeId); if (probe) probe.time = parsed.start; }, { reason: 'probe' }); }
    else if (target.dataset.action === 'probe-custom-before' || target.dataset.action === 'probe-custom-after') store.update((workspace) => { const probe = workspace.probes.find((item) => item.id === target.dataset.probeId); if (probe) probe[target.dataset.action === 'probe-custom-before' ? 'customBefore' : 'customAfter'] = Math.max(0, Number(target.value) || 0); }, { reason: 'probe' });
  });
  const search = document.getElementById('global-search');
  search.addEventListener('input', () => {
    store.update((workspace) => {
      if (search.value && !workspace.search.query && !workspace.search.originView) workspace.search.originView = { ...workspace.view };
      if (!search.value) clearWorkspaceSearch(workspace);
      else workspace.search.query = search.value;
    }, { reason: 'search' });
    if (search.value) switchTab('search');
  });
  document.getElementById('zoom-slider').addEventListener('input', (event) => {
    const value = Number(event.target.value) / 1000;
    const span = Math.exp(Math.log(MAX_SPAN) - value * (Math.log(MAX_SPAN) - Math.log(MIN_SPAN)));
    const view = store.get().view;
    const center = (view.start + view.end) / 2;
    setView({ start: center - span / 2, end: center + span / 2 }, 'slider-zoom');
  });
  document.getElementById('project-file').addEventListener('change', (event) => { const file = event.target.files[0]; if (file) openProjectFile(file); event.target.value = ''; });
  document.getElementById('data-files').addEventListener('change', (event) => { addDataFiles(event.target.files); event.target.value = ''; });
  document.getElementById('baseline-file').addEventListener('change', async (event) => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      const baseline = isZip(file) ? (await importProjectArchive(await file.arrayBuffer(), { fileName: file.name })).workspace : workspaceFromCSVFiles([{ fileName: file.name, text: await file.text() }], { name: file.name }).workspace;
      currentDiff = compareWorkspaces(store.get(), baseline);
      diffVisible = true;
      renderer.setDiff(currentDiff);
      renderDiff(currentDiff);
      switchTab('analysis');
    } catch (error) { toast(`baseline 加载失败：${error.message}`, 'error'); }
  });
  document.addEventListener('keydown', (event) => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName);
    if (event.key === '/' && !editing) { event.preventDefault(); search.focus(); }
    else if (event.key === 'Escape') { if (document.querySelector('dialog[open]')) return; if (store.get().search.query) store.update(clearWorkspaceSearch, { reason: 'search' }); else closeMenus(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) { event.preventDefault(); event.shiftKey ? store.redo() : store.undo(); }
    else if (event.key === '0' && !editing) resetView();
    else if (event.key === 'Delete' && !editing && store.get().selectedEventId && confirm('删除选中的事件？')) store.update((workspace) => { deleteEvent(workspace, workspace.selectedEventId); workspace.selectedEventId = null; }, { undoable: true, reason: 'event-edit' });
  });
  bindDragAndDrop();
  bindForms();
}

function bindDragAndDrop() {
  let dragging = null;
  document.addEventListener('dragstart', (event) => {
    const layer = event.target.closest('.layer-row');
    const group = event.target.closest('.layer-group');
    dragging = layer ? { kind: 'layer', id: layer.dataset.layerId } : group ? { kind: 'group', id: group.dataset.groupId } : null;
    if (dragging) { event.dataTransfer.effectAllowed = 'move'; event.target.classList.add('dragging'); }
  });
  document.addEventListener('dragend', (event) => { event.target.classList.remove('dragging'); dragging = null; });
  document.addEventListener('dragover', (event) => { if (dragging && event.target.closest('.layer-group,.layer-row')) event.preventDefault(); });
  document.addEventListener('drop', (event) => {
    if (!dragging) return;
    event.preventDefault();
    const layerTarget = event.target.closest('.layer-row');
    const groupTarget = event.target.closest('.layer-group');
    if (dragging.kind === 'layer' && groupTarget) {
      const workspace = store.get();
      const groupId = groupTarget.dataset.groupId;
      const index = layerTarget ? workspace.layers.findIndex((layer) => layer.id === layerTarget.dataset.layerId) : workspace.layers.length;
      store.update((item) => moveLayer(item, dragging.id, index, groupId), { undoable: true, reason: 'layer' });
    } else if (dragging.kind === 'group' && groupTarget) {
      const index = store.get().groups.findIndex((group) => group.id === groupTarget.dataset.groupId);
      store.update((item) => moveGroup(item, dragging.id, index), { undoable: true, reason: 'group' });
    }
  });
}

function showTooltip(hit, event) {
  const tooltip = document.getElementById('event-tooltip');
  if (!hit) { tooltip.hidden = true; return; }
  tooltip.textContent = renderer.tooltipText(hit);
  tooltip.hidden = false;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX + 12))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY + 12))}px`;
}

let rendererInteractions;

async function init() {
  const preferences = readPreferences();
  const narrow = matchMedia('(max-width: 940px)').matches;
  document.body.classList.toggle('left-collapsed', preferences.leftCollapsed ?? narrow);
  document.body.classList.toggle('right-collapsed', preferences.rightCollapsed ?? narrow);
  try {
    backgroundLibrary = await fetch('background/manifest.json', { cache: 'no-store' }).then((response) => response.json());
  } catch (error) { console.warn('背景 manifest 加载失败', error); }
  document.getElementById('background-select').innerHTML = backgroundLibrary.map((entry) => `<option value="${escapeHTML(entry.id)}">${escapeHTML(entry.name)}</option>`).join('');
  document.getElementById('example-select').innerHTML = EXAMPLES.map((file) => `<option value="${escapeHTML(file)}">${escapeHTML(file.split('/').pop().replace(/\.csv$/i, ''))}</option>`).join('');

  let initial = null;
  if (pendingSharedView?.projectUrl) {
    try {
      const response = await fetch(pendingSharedView.projectUrl);
      if (!response.ok) throw new Error(`${response.status}`);
      initial = (await importProjectArchive(await response.arrayBuffer(), { fileName: pendingSharedView.projectName || 'shared.showtime.zip', projectUrl: pendingSharedView.projectUrl })).workspace;
      applySharedView(initial, pendingSharedView);
      pendingSharedView = null;
    } catch (error) { toast(`无法自动打开分享项目：${error.message}`, 'warning'); }
  }
  if (!initial) {
    try { initial = await loadLastWorkspace(); } catch (error) { console.warn(error); }
  }
  if (!initial) initial = createWorkspace({ name: '未命名研究', description: '把专题时间线放入更大的历史背景中。', view: { start: -2200, end: new Date().getFullYear() } });

  store = createStore(initial);
  renderer = new TimelineRenderer(document.getElementById('timeline-canvas'), { onRender: (info) => updateViewStatus(store.get(), info) });
  minimap = new Minimap(document.getElementById('minimap-canvas'), { onChange: (view) => setView(view, 'minimap') });
  autosaver = createAutosaver({
    onSaved: () => setAutosaveStatus('已自动保存', 'saved'),
    onError: (error) => { setAutosaveStatus('自动保存失败', 'error'); console.error(error); },
  });
  store.subscribe((workspace, reason) => {
    setAutosaveStatus('正在保存…');
    autosaver.schedule(workspace);
    if (['view', 'pan', 'zoom', 'pinch', 'keyboard-pan', 'keyboard-zoom', 'slider-zoom', 'minimap', 'reset-view'].includes(reason)) renderViewOnly(reason);
    else renderAll(reason);
  });
  rendererInteractions = bindTimelineInteractions(renderer, {
    onViewChange: setView,
    onSelect: (event) => focusEvent(event.id, { navigate: false }),
    onProbe: pinProbe,
    onLayer: (layer) => { currentLayerId = layer.id; renderLayers(store.get(), currentLayerId); },
    onLayerContext: (layer) => {
      currentLayerId = layer.id;
      renderLayers(store.get(), currentLayerId);
      const menu = document.querySelector(`.context-menu[data-layer-id="${CSS.escape(layer.id)}"]`);
      if (menu) menu.open = true;
    },
    onReset: resetView,
    onTooltip: showTooltip,
  });
  bindUI();
  renderAll('init');
  refreshRecents();
  const observer = new ResizeObserver(() => { renderer.resize(); minimap.draw(); });
  observer.observe(document.querySelector('.timeline-main'));
  window.__SHOWTIME__ = { get workspace() { return store.get(); }, store, renderer, minimap, openExample: openFullExample, resetView, selfTests: null };
  window.__SHOWTIME__.selfTests = await runBrowserSelfTests(renderer);
}

init().catch((error) => {
  console.error(error);
  toast(`应用初始化失败：${error.message}`, 'error');
});

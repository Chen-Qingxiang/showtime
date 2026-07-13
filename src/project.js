import {
  combineQualityReports,
  hashString,
  parseTimelineCSV,
  serializeTableCSV,
  serializeTimelineCSV,
  slugify,
} from './csv.js';
import { applyEventMetadata, applySources, eventMetadataRecords, eventSourceRecords, parseSourcesCSV } from './metadata.js';
import { createZip, extractZip } from './zip.js';

export const PROJECT_FORMAT = 'showtime-project';
export const PROJECT_VERSION = '1.0';
export const LEGACY_ZIP_LIMIT = 100;
const decoder = new TextDecoder('utf-8');

function isoNow() {
  return new Date().toISOString();
}

export function createWorkspace(input = {}) {
  const now = isoNow();
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: input.id || `workspace-${hashString(`${now}-${Math.random()}`)}`,
    name: input.name || '未命名研究',
    description: input.description || '',
    topic: input.topic || '',
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    source: input.source || { kind: 'local' },
    groups: input.groups || [{ id: 'group-primary', name: '主线', order: 0, collapsed: false, visible: true, dimmed: false }],
    layers: input.layers || [],
    views: input.views || [],
    probes: input.probes || [],
    timeRange: input.timeRange || null,
    view: input.view || { start: 900, end: 1300 },
    filters: input.filters || {},
    search: input.search || { query: '', scope: 'all', dimUnmatched: false, onlyMatches: false },
    selectedEventId: input.selectedEventId || null,
    references: input.references || '',
    qualityReports: input.qualityReports || [],
    lodMode: input.lodMode || 'auto',
    pointDisplayMode: input.pointDisplayMode || 'year',
    baselines: input.baselines || [],
    bookmarks: input.bookmarks || [],
  };
}

export function cloneWorkspace(workspace) {
  return typeof structuredClone === 'function'
    ? structuredClone(workspace)
    : JSON.parse(JSON.stringify(workspace));
}

function normalizeRole(value, name = '', file = '') {
  if (['primary', 'context', 'anchor', 'background'].includes(value)) return value;
  const text = `${name} ${file}`.toLowerCase();
  if (/锚点|anchor|节点/.test(text)) return 'anchor';
  if (/背景|background/.test(text)) return 'background';
  if (/政治|战争|朝代|政权|人物|context|同期|同时代/.test(text)) return 'context';
  return 'primary';
}

function defaultGroupForRole(role) {
  if (role === 'anchor') return { id: 'group-anchor', name: '锚点' };
  if (role === 'background') return { id: 'group-background', name: '背景库' };
  if (role === 'context') return { id: 'group-context', name: '研究背景' };
  return { id: 'group-primary', name: '主线' };
}

function defaultColor(role) {
  return { primary: '#4da3ff', context: '#8aa2c5', anchor: '#f3b33d', background: '#64748b' }[role] || '#4da3ff';
}

function basename(path) {
  return String(path || '').split('/').pop() || '';
}

function baseWithoutExtension(path) {
  return basename(path).replace(/\.[^.]+$/, '');
}

function makeUniqueId(seed, used, prefix = 'layer') {
  const base = `${prefix}-${slugify(seed, hashString(seed))}`;
  let id = base;
  let index = 2;
  while (used.has(id)) id = `${base}-${index++}`;
  used.add(id);
  return id;
}

function inferLodInfo(name) {
  const match = String(name).match(/^(.*?)[_-](overview|detailed|detail|概览|详细)$/i);
  if (!match) return null;
  const level = /overview|概览/i.test(match[2]) ? 'overview' : 'detailed';
  return { key: slugify(match[1]), level, switchSpan: 80 };
}

function ensureGroups(workspace) {
  const seen = new Set();
  workspace.groups = (workspace.groups || []).map((group, index) => {
    const id = group.id || makeUniqueId(group.name || `group-${index + 1}`, seen, 'group');
    seen.add(id);
    return {
      id,
      name: group.name || `分组 ${index + 1}`,
      order: Number.isFinite(group.order) ? group.order : index,
      collapsed: Boolean(group.collapsed),
      visible: group.visible !== false,
      dimmed: Boolean(group.dimmed),
    };
  });
  for (const layer of workspace.layers) {
    if (workspace.groups.some((group) => group.id === layer.groupId)) continue;
    const inferred = defaultGroupForRole(layer.role);
    let group = workspace.groups.find((entry) => entry.id === inferred.id);
    if (!group) {
      group = { ...inferred, order: workspace.groups.length, collapsed: false, visible: true, dimmed: false };
      workspace.groups.push(group);
    }
    layer.groupId = group.id;
  }
  workspace.groups.sort((a, b) => a.order - b.order);
  workspace.groups.forEach((group, index) => { group.order = index; });
}

export function normalizeWorkspace(workspace) {
  const normalized = createWorkspace(workspace);
  const used = new Set();
  normalized.layers = (workspace.layers || []).map((layer, index) => {
    const role = normalizeRole(layer.role, layer.name, layer.file);
    const id = layer.id && !used.has(layer.id) ? layer.id : makeUniqueId(layer.id || layer.name || layer.file || `layer-${index}`, used);
    used.add(id);
    return {
      id,
      name: layer.name || baseWithoutExtension(layer.file) || `图层 ${index + 1}`,
      file: layer.file || '',
      role,
      groupId: layer.groupId || layer.group || '',
      order: Number.isFinite(layer.order) ? layer.order : index,
      color: layer.color || layer.defaultColor || defaultColor(role),
      visible: layer.visible !== false && layer.hidden !== true,
      dimmed: Boolean(layer.dimmed),
      solo: Boolean(layer.solo),
      lod: layer.lod || inferLodInfo(layer.name || layer.file),
      events: Array.isArray(layer.events) ? layer.events : [],
      sourceKind: layer.sourceKind || (role === 'background' ? 'background' : 'user'),
    };
  });
  normalized.layers.sort((a, b) => a.order - b.order);
  normalized.layers.forEach((layer, index) => {
    layer.order = index;
    for (const event of layer.events) event.layerId = layer.id;
  });
  ensureGroups(normalized);
  return normalized;
}

export function migrateManifest(rawManifest) {
  const manifest = cloneWorkspace(rawManifest || {});
  const version = String(manifest.version || manifest.formatVersion || '1.0');
  const major = Number(version.split('.')[0]);
  if (!Number.isFinite(major)) return { manifest, unsupported: true, fromVersion: version };
  if (major > 1) return { manifest, unsupported: true, fromVersion: version };
  // Future 1.x migrations belong here and must leave the original object untouched.
  manifest.version = PROJECT_VERSION;
  return { manifest, unsupported: false, fromVersion: version };
}

function manifestProjectFields(manifest, fallbackName) {
  const project = manifest.project || manifest;
  return {
    name: project.name || project.projectName || fallbackName,
    description: project.description || '',
    topic: project.topic || '',
    createdAt: project.createdAt || project.created_at,
    updatedAt: project.updatedAt || project.updated_at,
  };
}

function textFile(files, path) {
  const bytes = files.get(path);
  return bytes ? decoder.decode(bytes) : null;
}

function findNamedFile(files, target) {
  const exact = [...files.keys()].find((path) => path.toLowerCase() === target.toLowerCase());
  if (exact) return exact;
  return [...files.keys()].find((path) => basename(path).toLowerCase() === target.toLowerCase());
}

function issue(type, message, suggestion, severity = 'warning', extra = {}) {
  return { type, message, suggestion, severity, ...extra };
}

function parseLayerFile(path, definition, usedIds, reportList, options = {}) {
  const name = definition.name || baseWithoutExtension(path);
  const role = normalizeRole(definition.role, name, path);
  const id = definition.id && !usedIds.has(definition.id)
    ? definition.id
    : makeUniqueId(definition.id || name || path, usedIds);
  usedIds.add(id);
  const parsed = parseTimelineCSV(options.text, { layerId: id, layerName: name, fileName: path, now: options.now });
  reportList.push(parsed.report);
  return {
    id,
    name,
    file: path,
    role,
    groupId: definition.groupId || definition.group || '',
    order: Number.isFinite(definition.order) ? definition.order : options.order,
    color: definition.color || definition.defaultColor || defaultColor(role),
    visible: definition.visible !== false && definition.hidden !== true,
    dimmed: Boolean(definition.dimmed),
    solo: false,
    lod: definition.lod || (definition.lodLevel ? {
      key: definition.lodKey || slugify(name.replace(/[_-](?:overview|detailed)$/i, '')),
      level: definition.lodLevel,
      switchSpan: Number(definition.lodSwitchSpan || 80),
    } : inferLodInfo(name)),
    events: parsed.events,
    sourceKind: definition.sourceKind || (role === 'background' ? 'background' : 'user'),
  };
}

export async function importProjectArchive(arrayBuffer, options = {}) {
  const archiveName = options.fileName || 'project.showtime.zip';
  const { files } = await extractZip(arrayBuffer);
  const jsonPath = findNamedFile(files, '00_manifest.json');
  const markdownPath = findNamedFile(files, '00_manifest.md');
  let manifest = null;
  const extraIssues = [];
  if (jsonPath) {
    try {
      manifest = JSON.parse(textFile(files, jsonPath));
    } catch (error) {
      extraIssues.push(issue('manifest_invalid', `00_manifest.json 无法解析：${error.message}`, '修正 JSON 语法；CSV 文件仍会按旧 ZIP 导入。', 'error'));
    }
  }
  const migration = migrateManifest(manifest || {});
  if (manifest && migration.unsupported) {
    extraIssues.push(issue('unsupported_version', `项目版本 ${migration.fromVersion} 高于本应用支持的 ${PROJECT_VERSION}。`, '使用兼容版本导出；当前将尽量读取 CSV，但不恢复未知设置。', 'error'));
    manifest = null;
  } else if (manifest) {
    manifest = migration.manifest;
  }

  const csvPaths = [...files.keys()]
    .filter((path) => /\.csv$/i.test(path) && !/(^|\/)(sources)\.csv$/i.test(path) && !/(^|\/)00_/.test(path))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
  const reports = [];
  const layers = [];
  const usedIds = new Set();
  const consumed = new Set();
  const definitions = Array.isArray(manifest?.layers) ? manifest.layers : [];

  if (definitions.length) {
    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index];
      const path = definition.file || definition.path;
      if (!path || !files.has(path)) {
        extraIssues.push(issue('manifest_missing_file', `Manifest 图层“${definition.name || definition.id || index + 1}”缺少文件：${path || '(未填写)'}`, '把文件加入项目包，或修正 layers[].file。', 'error'));
        continue;
      }
      consumed.add(path);
      layers.push(parseLayerFile(path, definition, usedIds, reports, { text: textFile(files, path), order: index, now: options.now }));
    }
  }

  const remaining = csvPaths.filter((path) => !consumed.has(path));
  const selected = manifest ? remaining : remaining.slice(0, options.legacyLimit || LEGACY_ZIP_LIMIT);
  if (!manifest && remaining.length > selected.length) {
    extraIssues.push(issue('zip_limit', `普通 ZIP 中有 ${remaining.length} 个 CSV，仅导入前 ${selected.length} 个。`, '使用正式 .showtime.zip Manifest 可明确管理大型项目。'));
  }
  for (const path of selected) {
    layers.push(parseLayerFile(path, {}, usedIds, reports, { text: textFile(files, path), order: layers.length, now: options.now }));
  }

  const duplicateNames = layers.map((layer) => layer.name).filter((name, index, list) => list.indexOf(name) !== index);
  if (duplicateNames.length) {
    extraIssues.push(issue('duplicate_layer', `存在重名图层：${[...new Set(duplicateNames)].join('、')}`, '重命名图层以保证搜索、sidecar 与 diff 更清晰。'));
  }

  const fields = manifestProjectFields(manifest || {}, baseWithoutExtension(archiveName).replace(/\.showtime$/i, ''));
  const initial = manifest?.initialView || manifest?.view || {};
  let workspace = createWorkspace({
    ...fields,
    source: { kind: 'local-package', fileName: archiveName, projectUrl: options.projectUrl || '' },
    groups: manifest?.groups || [],
    layers,
    views: manifest?.views || manifest?.savedViews || [],
    probes: manifest?.probes || manifest?.recommendedProbes || [],
    bookmarks: manifest?.bookmarks || [],
    timeRange: manifest?.timeRange || null,
    view: {
      start: Number(initial.start ?? initial.min ?? 900),
      end: Number(initial.end ?? initial.max ?? 1300),
    },
    filters: manifest?.filters || {},
    search: manifest?.search || { query: '', scope: 'all', dimUnmatched: false, onlyMatches: false },
    lodMode: manifest?.lodMode || 'auto',
  });
  workspace = normalizeWorkspace(workspace);

  const metadataPath = manifest?.metadata?.events || manifest?.eventMeta || findNamedFile(files, 'event_meta.json');
  if (metadataPath && files.has(metadataPath)) {
    try {
      const result = applyEventMetadata(workspace.layers, JSON.parse(textFile(files, metadataPath)));
      extraIssues.push(...result.issues);
    } catch (error) {
      extraIssues.push(issue('sidecar_invalid', `event_meta.json 无法解析：${error.message}`, '检查 JSON 语法和事件匹配字段。', 'error'));
    }
  } else if (manifest?.metadata?.events || manifest?.eventMeta) {
    extraIssues.push(issue('manifest_missing_file', `Manifest 引用的事件元数据文件不存在：${metadataPath}`, '把 sidecar 加入项目包，或修正 metadata.events。', 'error'));
  }
  const sourcesPath = manifest?.metadata?.sources || manifest?.sources || findNamedFile(files, 'sources.csv');
  if (sourcesPath && files.has(sourcesPath)) {
    const result = applySources(workspace.layers, parseSourcesCSV(textFile(files, sourcesPath)));
    extraIssues.push(...result.issues);
  } else if (manifest?.metadata?.sources || manifest?.sources) {
    extraIssues.push(issue('manifest_missing_file', `Manifest 引用的来源文件不存在：${sourcesPath}`, '把 sources.csv 加入项目包，或修正 metadata.sources。', 'error'));
  }
  const referencesPath = manifest?.metadata?.references || manifest?.references || findNamedFile(files, 'references.md');
  workspace.references = referencesPath && files.has(referencesPath) ? textFile(files, referencesPath) : '';
  if ((manifest?.metadata?.references || manifest?.references) && !files.has(referencesPath)) {
    extraIssues.push(issue('manifest_missing_file', `Manifest 引用的参考资料文件不存在：${referencesPath}`, '把 references.md 加入项目包，或修正 metadata.references。', 'error'));
  }
  if (markdownPath) {
    const markdown = textFile(files, markdownPath);
    if (!workspace.description) workspace.description = markdown.replace(/^#\s+.*$/m, '').trim();
    workspace.manifestMarkdown = markdown;
  }
  const combined = combineQualityReports(reports, extraIssues);
  workspace.qualityReports = [combined];
  if (!layers.length) combined.issues.push(issue('no_timeline_csv', '项目包中没有可导入的时间线 CSV。', '至少加入一个两列 time,title CSV。', 'error'));
  return { workspace, report: combined, manifest: manifest || null, legacy: !manifest };
}

export function workspaceFromCSVFiles(sources, options = {}) {
  const used = new Set();
  const reports = [];
  const layers = sources.map((source, index) => parseLayerFile(source.fileName, {
    name: source.layerName || baseWithoutExtension(source.fileName),
    role: source.role || (index === 0 ? 'primary' : undefined),
    groupId: source.groupId,
  }, used, reports, { text: source.text, order: index, now: options.now }));
  const workspace = normalizeWorkspace(createWorkspace({
    name: options.name || (layers[0]?.name ? `${layers[0].name}研究` : '新研究'),
    layers,
    source: { kind: options.sourceKind || 'local-csv' },
  }));
  const report = combineQualityReports(reports);
  workspace.qualityReports = [report];
  const bounds = getWorkspaceBounds(workspace);
  if (bounds) workspace.view = padRange(bounds.start, bounds.end);
  return { workspace, report };
}

export function appendCSVFiles(workspace, sources, options = {}) {
  const copy = cloneWorkspace(workspace);
  const used = new Set(copy.layers.map((layer) => layer.id));
  const reports = [];
  for (const source of sources) {
    const baseName = source.layerName || baseWithoutExtension(source.fileName);
    let name = baseName;
    let suffix = 2;
    while (copy.layers.some((layer) => layer.name === name)) name = `${baseName} #${suffix++}`;
    copy.layers.push(parseLayerFile(source.fileName, { name, role: source.role, groupId: source.groupId }, used, reports, {
      text: source.text,
      order: copy.layers.length,
      now: options.now,
    }));
  }
  const normalized = normalizeWorkspace(copy);
  const report = combineQualityReports(reports);
  normalized.qualityReports = [report, ...(normalized.qualityReports || [])].slice(0, 10);
  normalized.updatedAt = isoNow();
  return { workspace: normalized, report };
}

export function getWorkspaceBounds(workspace, options = {}) {
  const events = workspace.layers
    .filter((layer) => options.includeHidden || layer.visible !== false)
    .flatMap((layer) => layer.events);
  if (!events.length) return null;
  return { start: Math.min(...events.map((event) => event.start)), end: Math.max(...events.map((event) => event.end)) };
}

export function padRange(start, end, ratio = 0.04) {
  const span = Math.max(Math.abs(end - start), 1);
  return { start: start - span * ratio, end: end + span * ratio };
}

function safeLayerFile(layer, index, used) {
  const prefix = String(index + 1).padStart(2, '0');
  const lodSuffix = layer.lod?.level ? `_${layer.lod.level}` : '';
  const base = `${prefix}_${slugify(layer.name)}${lodSuffix}`;
  let file = `layers/${base}.csv`;
  let suffix = 2;
  while (used.has(file)) file = `layers/${base}_${suffix++}.csv`;
  used.add(file);
  return file;
}

export function workspaceToManifest(workspace, layerFiles) {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    project: {
      name: workspace.name,
      description: workspace.description,
      topic: workspace.topic,
      createdAt: workspace.createdAt,
      updatedAt: isoNow(),
    },
    groups: workspace.groups.map(({ id, name, order, collapsed, visible, dimmed }) => ({ id, name, order, collapsed, visible, dimmed })),
    layers: workspace.layers.map((layer, index) => ({
      id: layer.id,
      name: layer.name,
      file: layerFiles.get(layer.id),
      role: layer.role,
      groupId: layer.groupId,
      order: index,
      color: layer.color,
      visible: layer.visible,
      dimmed: layer.dimmed,
      lod: layer.lod || undefined,
    })),
    timeRange: workspace.timeRange || getWorkspaceBounds(workspace, { includeHidden: true }),
    initialView: workspace.view,
    lodMode: workspace.lodMode,
    views: workspace.views,
    bookmarks: workspace.bookmarks,
    probes: workspace.probes,
    filters: workspace.filters,
    search: workspace.search,
    metadata: {
      events: 'event_meta.json',
      sources: 'sources.csv',
      references: 'references.md',
    },
  };
}

export function buildProjectEntries(workspace) {
  const layerFiles = new Map();
  const used = new Set();
  const entries = [];
  workspace.layers.forEach((layer, index) => {
    const file = safeLayerFile(layer, index, used);
    layerFiles.set(layer.id, file);
    entries.push({ name: file, data: serializeTimelineCSV(layer.events) });
  });
  const manifest = workspaceToManifest(workspace, layerFiles);
  const metadata = eventMetadataRecords(workspace.layers).map((record) => {
    const { sources, ...rest } = record;
    return rest;
  });
  const sources = eventSourceRecords(workspace.layers);
  entries.unshift(
    { name: '00_manifest.json', data: `${JSON.stringify(manifest, null, 2)}\n` },
    { name: '00_manifest.md', data: `# ${workspace.name}\n\n${workspace.description || 'ShowTime 研究项目。'}\n\n- 主题：${workspace.topic || '未填写'}\n- 图层：${workspace.layers.length}\n- 格式：ShowTime ${PROJECT_VERSION}\n` },
  );
  entries.push(
    { name: 'event_meta.json', data: `${JSON.stringify({ version: PROJECT_VERSION, events: metadata }, null, 2)}\n` },
    { name: 'sources.csv', data: serializeTableCSV(sources, ['event_id', 'layer', 'time', 'title', 'occurrence', 'source', 'page', 'url', 'quotation', 'notes']) },
    { name: 'references.md', data: workspace.references || `# ${workspace.name} · 参考资料\n` },
  );
  return entries;
}

export function exportProjectArchive(workspace) {
  return createZip(buildProjectEntries(workspace));
}

export function projectFileName(workspace) {
  return `${slugify(workspace.name, 'showtime-project')}.showtime.zip`;
}

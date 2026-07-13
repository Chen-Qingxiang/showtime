import { makeEventId, parseTimelineCSV } from './csv.js';
import { cloneWorkspace, normalizeWorkspace } from './project.js';

function now() {
  return new Date().toISOString();
}

export function createStore(initialWorkspace, options = {}) {
  let workspace = normalizeWorkspace(initialWorkspace);
  const listeners = new Set();
  const undoStack = [];
  const redoStack = [];
  const historyLimit = options.historyLimit || 40;
  const notify = (reason = 'update') => listeners.forEach((listener) => listener(workspace, reason));
  const store = {
    get: () => workspace,
    set(next, reason = 'replace') {
      workspace = normalizeWorkspace(next);
      notify(reason);
    },
    update(mutator, options = {}) {
      if (options.undoable) {
        undoStack.push(cloneWorkspace(workspace));
        if (undoStack.length > historyLimit) undoStack.shift();
        redoStack.length = 0;
      }
      const result = mutator(workspace);
      if (result && result !== workspace) workspace = result;
      workspace.updatedAt = now();
      notify(options.reason || 'update');
      return result;
    },
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(cloneWorkspace(workspace));
      workspace = undoStack.pop();
      notify('undo');
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(cloneWorkspace(workspace));
      workspace = redoStack.pop();
      notify('redo');
      return true;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return store;
}

export function findEvent(workspace, eventId) {
  for (const layer of workspace.layers) {
    const event = layer.events.find((entry) => entry.id === eventId);
    if (event) return { layer, event };
  }
  return null;
}

export function createEvent(layer, rawTime, title, metadata = {}) {
  const quotedTitle = `"${String(title ?? '').replace(/"/g, '""')}"`;
  const parsed = parseTimelineCSV(`${rawTime},${quotedTitle}`, { layerId: layer.id, layerName: layer.name, fileName: layer.file || `${layer.name}.csv` });
  if (!parsed.events.length) return { event: null, report: parsed.report };
  const event = parsed.events[0];
  const same = layer.events.filter((entry) => entry.rawTime === event.rawTime && entry.title === event.title);
  event.occurrence = same.length + 1;
  event.id = makeEventId(layer.id, event.rawTime, event.title, event.occurrence);
  event.metadata = metadata;
  return { event, report: parsed.report };
}

export function updateEvent(workspace, eventId, changes) {
  const match = findEvent(workspace, eventId);
  if (!match) return { ok: false, error: '事件不存在' };
  const rawTime = changes.rawTime ?? match.event.rawTime;
  const title = changes.title ?? match.event.title;
  const quotedTitle = `"${String(title ?? '').replace(/"/g, '""')}"`;
  const parsed = parseTimelineCSV(`${rawTime},${quotedTitle}`, { layerId: match.layer.id, layerName: match.layer.name, fileName: match.layer.file });
  if (!parsed.events.length) return { ok: false, error: parsed.report.issues[0]?.message || '时间格式无效', report: parsed.report };
  const replacement = parsed.events[0];
  Object.assign(match.event, replacement, {
    id: eventId,
    occurrence: match.event.occurrence,
    metadata: changes.metadata ?? match.event.metadata,
  });
  return { ok: true, event: match.event, report: parsed.report };
}

export function deleteEvent(workspace, eventId) {
  for (const layer of workspace.layers) {
    const index = layer.events.findIndex((event) => event.id === eventId);
    if (index >= 0) return layer.events.splice(index, 1)[0];
  }
  return null;
}

export function renameLayer(workspace, layerId, name) {
  const layer = workspace.layers.find((entry) => entry.id === layerId);
  const next = String(name || '').trim();
  if (!layer || !next || workspace.layers.some((entry) => entry.id !== layerId && entry.name === next)) return false;
  layer.name = next;
  return true;
}

export function moveLayer(workspace, layerId, targetIndex, groupId = null) {
  const index = workspace.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return false;
  const [layer] = workspace.layers.splice(index, 1);
  if (groupId && workspace.groups.some((group) => group.id === groupId)) layer.groupId = groupId;
  workspace.layers.splice(Math.max(0, Math.min(targetIndex, workspace.layers.length)), 0, layer);
  workspace.layers.forEach((entry, order) => { entry.order = order; });
  return true;
}

export function renameGroup(workspace, groupId, name) {
  const group = workspace.groups.find((entry) => entry.id === groupId);
  const next = String(name || '').trim();
  if (!group || !next) return false;
  group.name = next;
  return true;
}

export function moveGroup(workspace, groupId, targetIndex) {
  const index = workspace.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return false;
  const [group] = workspace.groups.splice(index, 1);
  workspace.groups.splice(Math.max(0, Math.min(targetIndex, workspace.groups.length)), 0, group);
  workspace.groups.forEach((entry, order) => { entry.order = order; });
  return true;
}

export function setGroupVisibility(workspace, groupId, mode) {
  const group = workspace.groups.find((entry) => entry.id === groupId);
  if (!group) return false;
  if (mode === 'solo') {
    workspace.groups.forEach((entry) => { entry.visible = entry.id === groupId; });
  } else if (mode === 'dim') {
    group.dimmed = !group.dimmed;
  } else {
    group.visible = mode == null ? !group.visible : Boolean(mode);
  }
  return true;
}

export function setLayerSolo(workspace, layerId) {
  const layer = workspace.layers.find((entry) => entry.id === layerId);
  if (!layer) return false;
  const next = !layer.solo;
  workspace.layers.forEach((entry) => { entry.solo = false; });
  layer.solo = next;
  return true;
}

export function captureView(workspace, name) {
  return {
    id: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(name || '未命名视图').trim(),
    createdAt: now(),
    view: { ...workspace.view },
    layers: workspace.layers.map(({ id, order, visible, color, dimmed, solo, groupId }) => ({ id, order, visible, color, dimmed, solo, groupId })),
    groups: workspace.groups.map(({ id, order, collapsed, visible, dimmed }) => ({ id, order, collapsed, visible, dimmed })),
    filters: cloneWorkspace(workspace.filters),
    search: cloneWorkspace(workspace.search),
    probes: cloneWorkspace(workspace.probes),
    selectedEventId: workspace.selectedEventId,
    lodMode: workspace.lodMode,
  };
}

export function saveNamedView(workspace, name, existingId = null) {
  const view = captureView(workspace, name);
  if (existingId) {
    const index = workspace.views.findIndex((entry) => entry.id === existingId);
    if (index >= 0) {
      view.id = existingId;
      workspace.views[index] = view;
      return view;
    }
  }
  workspace.views.push(view);
  return view;
}

export function restoreNamedView(workspace, viewId) {
  const saved = workspace.views.find((entry) => entry.id === viewId);
  if (!saved) return false;
  workspace.view = { ...saved.view };
  const layerSettings = new Map(saved.layers.map((entry) => [entry.id, entry]));
  for (const layer of workspace.layers) Object.assign(layer, layerSettings.get(layer.id) || {});
  workspace.layers.sort((a, b) => a.order - b.order);
  const groupSettings = new Map(saved.groups.map((entry) => [entry.id, entry]));
  for (const group of workspace.groups) Object.assign(group, groupSettings.get(group.id) || {});
  workspace.groups.sort((a, b) => a.order - b.order);
  workspace.filters = cloneWorkspace(saved.filters || {});
  workspace.search = cloneWorkspace(saved.search || {});
  workspace.probes = cloneWorkspace(saved.probes || []);
  workspace.selectedEventId = saved.selectedEventId || null;
  workspace.lodMode = saved.lodMode || 'auto';
  return true;
}

export function renameNamedView(workspace, viewId, name) {
  const view = workspace.views.find((entry) => entry.id === viewId);
  if (!view || !String(name || '').trim()) return false;
  view.name = String(name).trim();
  return true;
}

export function deleteNamedView(workspace, viewId) {
  const before = workspace.views.length;
  workspace.views = workspace.views.filter((entry) => entry.id !== viewId);
  return workspace.views.length < before;
}

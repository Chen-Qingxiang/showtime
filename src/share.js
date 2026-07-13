const MAX_SHARE_LENGTH = 6000;

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeShareState(value) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeShareState(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(new TextDecoder().decode(base64ToBytes(padded)));
}

export function extractShareView(workspace) {
  return {
    version: 1,
    projectName: workspace.name,
    projectUrl: workspace.source?.projectUrl || workspace.source?.url || '',
    requiresProjectPackage: !workspace.source?.projectUrl && !workspace.source?.url,
    view: workspace.view,
    layers: workspace.layers.map(({ id, visible, color, order, groupId, dimmed, solo }) => ({ id, visible, color, order, groupId, dimmed, solo })),
    groups: workspace.groups.map(({ id, visible, collapsed, dimmed, order }) => ({ id, visible, collapsed, dimmed, order })),
    probes: workspace.probes,
    filters: workspace.filters,
    search: workspace.search,
    selectedEventId: workspace.selectedEventId,
    lodMode: workspace.lodMode,
  };
}

export function createShareLink(workspace, baseUrl = null) {
  const state = extractShareView(workspace);
  const encoded = encodeShareState(state);
  const base = baseUrl || (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : 'https://example.invalid/showtime/');
  const url = `${base.replace(/#.*$/, '')}#share=${encoded}`;
  if (url.length > MAX_SHARE_LENGTH) {
    return { ok: false, url: '', state, warning: '当前视图状态过大，未生成可能失效的超长链接。请导出项目包。' };
  }
  const warning = state.requiresProjectPackage
    ? '链接只包含视图、图层与探针状态，不包含本地原始数据；接收者仍需打开同一个 .showtime.zip 项目包。'
    : '';
  return { ok: true, url, state, warning };
}

export function readShareHash(hash = null) {
  const value = hash == null && typeof location !== 'undefined' ? location.hash : String(hash || '');
  const match = value.match(/(?:^#|[&#])share=([^&]+)/);
  if (!match) return null;
  try { return decodeShareState(decodeURIComponent(match[1])); } catch { return null; }
}

export function applySharedView(workspace, shared) {
  if (!shared || shared.version !== 1) return false;
  workspace.view = { ...workspace.view, ...(shared.view || {}) };
  const layers = new Map((shared.layers || []).map((layer) => [layer.id, layer]));
  for (const layer of workspace.layers) Object.assign(layer, layers.get(layer.id) || {});
  workspace.layers.sort((a, b) => a.order - b.order);
  const groups = new Map((shared.groups || []).map((group) => [group.id, group]));
  for (const group of workspace.groups) Object.assign(group, groups.get(group.id) || {});
  workspace.groups.sort((a, b) => a.order - b.order);
  workspace.probes = shared.probes || workspace.probes;
  workspace.filters = shared.filters || workspace.filters;
  workspace.search = shared.search || workspace.search;
  workspace.selectedEventId = shared.selectedEventId || null;
  workspace.lodMode = shared.lodMode || workspace.lodMode;
  return true;
}

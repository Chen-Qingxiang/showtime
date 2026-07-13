import { eventIntersectsRange } from './search.js';

export function resolveLodLayers(workspace, view = workspace.view) {
  const span = Math.max(0, view.end - view.start);
  const groupById = new Map(workspace.groups.map((group) => [group.id, group]));
  const solo = workspace.layers.filter((layer) => layer.solo);
  const candidates = workspace.layers.filter((layer) => {
    const group = groupById.get(layer.groupId);
    return group?.visible !== false && layer.visible !== false && (!solo.length || layer.solo);
  });
  if (workspace.lodMode === 'manual') return { layers: candidates, statuses: new Map(candidates.map((layer) => [layer.id, layer.lod?.level || 'full'])) };

  const pairs = new Map();
  const regular = [];
  for (const layer of candidates) {
    if (layer.lod?.key && ['overview', 'detailed'].includes(layer.lod.level)) {
      if (!pairs.has(layer.lod.key)) pairs.set(layer.lod.key, []);
      pairs.get(layer.lod.key).push(layer);
    } else regular.push(layer);
  }
  const selected = [...regular];
  const statuses = new Map(regular.map((layer) => [layer.id, 'full']));
  for (const pair of pairs.values()) {
    const threshold = Number(pair.find((layer) => layer.lod?.switchSpan)?.lod.switchSpan || 80);
    const preferredLevel = span <= threshold ? 'detailed' : 'overview';
    const preferred = pair.find((layer) => layer.lod.level === preferredLevel) || pair[0];
    selected.push(preferred);
    statuses.set(preferred.id, preferred.lod.level);
  }
  selected.sort((a, b) => a.order - b.order);
  return { layers: selected, statuses };
}

export function chooseDensityMode(eventCount, pixelWidth, span) {
  if (!eventCount) return 'full';
  const eventsPerPixel = eventCount / Math.max(1, pixelWidth);
  if (eventsPerPixel > 0.6 || eventCount > 2500) return 'aggregated';
  if (eventsPerPixel > 0.18 || eventCount > 900 || span > 1000000) return 'representative';
  return 'full';
}

export function aggregateEvents(events, range, pixelWidth, options = {}) {
  const visible = events.filter((event) => eventIntersectsRange(event, range));
  const mode = options.mode || chooseDensityMode(visible.length, pixelWidth, range.end - range.start);
  if (mode === 'full') return { mode, items: visible.map((event) => ({ kind: 'event', event })) };
  const binCount = Math.max(12, Math.min(options.binCount || Math.floor(pixelWidth / 10), 240));
  const span = Math.max(range.end - range.start, Number.EPSILON);
  const bins = new Map();
  for (const event of visible) {
    const midpoint = Math.max(range.start, Math.min(range.end, (event.start + event.end) / 2));
    const index = Math.min(binCount - 1, Math.max(0, Math.floor((midpoint - range.start) / span * binCount)));
    if (!bins.has(index)) bins.set(index, []);
    bins.get(index).push(event);
  }
  const items = [];
  for (const [index, values] of [...bins.entries()].sort((a, b) => a[0] - b[0])) {
    const start = range.start + index / binCount * span;
    const end = range.start + (index + 1) / binCount * span;
    const representative = [...values].sort((a, b) => {
      const metaA = Object.keys(a.metadata || {}).length;
      const metaB = Object.keys(b.metadata || {}).length;
      return metaB - metaA || (b.end - b.start) - (a.end - a.start) || a.start - b.start;
    })[0];
    if (mode === 'representative') {
      items.push({ kind: 'representative', event: representative, count: values.length, omitted: values.length - 1, start, end });
    } else {
      items.push({ kind: 'aggregate', events: values, event: representative, count: values.length, start, end });
    }
  }
  return { mode, items, visibleCount: visible.length, explanation: mode === 'aggregated' ? '按当前视窗等宽分箱显示事件密度' : '每个等宽时间箱显示一条代表事件' };
}

export function lodStatusLabel(layer, densityMode = 'full') {
  if (densityMode === 'aggregated') return 'aggregated';
  if (densityMode === 'representative') return 'representative';
  return layer.lod?.level || 'detailed';
}

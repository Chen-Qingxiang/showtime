import { TIME_EPSILON, formatSpan, formatYear } from './time.js';

export function chooseBinSize(span) {
  const target = Math.max(1, span / 14);
  const exponent = Math.floor(Math.log10(target));
  const base = 10 ** exponent;
  const normalized = target / base;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(Number.MIN_VALUE, step * base);
}

function values(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return String(value).split(/[,，;；]/).map((entry) => entry.trim()).filter(Boolean);
}

function countFacet(events, keys) {
  const counts = new Map();
  for (const event of events) {
    for (const key of keys) {
      for (const value of values(event.metadata?.[key])) counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-Hans-CN'));
}

export function computeStatistics(workspace, options = {}) {
  const selected = new Set(options.layerIds || []);
  const groups = new Map(workspace.groups.map((group) => [group.id, group]));
  const layers = workspace.layers.filter((layer) => {
    if (selected.size) return selected.has(layer.id);
    return layer.visible !== false && groups.get(layer.groupId)?.visible !== false;
  });
  const events = layers.flatMap((layer) => layer.events);
  if (!events.length) {
    return { eventCount: 0, pointCount: 0, intervalCount: 0, span: 0, bins: [], byLayer: [], facets: {}, disclaimer: '统计的是事件记录数量，不等同于真实历史活动强度。' };
  }
  const start = Math.min(...events.map((event) => event.start));
  const end = Math.max(...events.map((event) => event.end));
  const span = Math.max(end - start, 1);
  const binSize = options.binSize || chooseBinSize(span);
  const first = Math.floor(start / binSize) * binSize;
  const counts = new Map();
  for (const event of events) {
    const bin = Math.floor((event.start - first) / binSize);
    counts.set(bin, (counts.get(bin) || 0) + 1);
  }
  const maxBin = Math.floor((end - first) / binSize);
  const bins = Array.from({ length: Math.min(maxBin + 1, 500) }, (_, index) => {
    const binStart = first + index * binSize;
    return {
      start: binStart,
      end: binStart + binSize,
      count: counts.get(index) || 0,
      label: `${formatYear(binStart)}–${formatYear(binStart + binSize)}`,
    };
  });
  return {
    eventCount: events.length,
    pointCount: events.filter((event) => Math.abs(event.end - event.start) <= TIME_EPSILON).length,
    intervalCount: events.filter((event) => Math.abs(event.end - event.start) > TIME_EPSILON).length,
    start,
    end,
    span,
    spanLabel: formatSpan(span),
    binSize,
    bins,
    byLayer: layers.map((layer) => ({ id: layer.id, name: layer.name, count: layer.events.length, color: layer.color })),
    facets: {
      locations: countFacet(events, ['location', 'locations', 'place', 'places']),
      people: countFacet(events, ['people', 'person', 'persons']),
      tags: countFacet(events, ['tags', 'tag']),
    },
    disclaimer: '统计的是事件记录数量，不等同于真实历史活动强度。区间分布按事件开始时间计入。',
  };
}

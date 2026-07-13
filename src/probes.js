import { formatTimeValue } from './time.js';

export const PROBE_WINDOWS = {
  exact: { before: 0, after: 0, label: '精确' },
  '1y': { before: 1, after: 1, label: '±1 年' },
  '5y': { before: 5, after: 5, label: '±5 年' },
  '10y': { before: 10, after: 10, label: '±10 年' },
};

export function createProbe(time, input = {}) {
  return {
    id: input.id || `probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    time: Number(time),
    label: input.label || '',
    precision: input.precision || 'year',
    windowMode: input.windowMode || 'exact',
    customBefore: Number(input.customBefore || 0),
    customAfter: Number(input.customAfter || 0),
    pinned: input.pinned !== false,
  };
}

export function probeRange(probe) {
  const preset = PROBE_WINDOWS[probe.windowMode];
  const before = preset ? preset.before : Math.max(0, Number(probe.customBefore || 0));
  const after = preset ? preset.after : Math.max(0, Number(probe.customAfter || 0));
  return { start: probe.time - before, end: probe.time + after, before, after };
}

export function eventAtProbe(event, probe) {
  const range = probeRange(probe);
  return event.end >= range.start && event.start <= range.end;
}

export function probeResults(workspace, probe, options = {}) {
  const groups = [];
  for (const group of workspace.groups) {
    const layerResults = [];
    for (const layer of workspace.layers.filter((entry) => entry.groupId === group.id)) {
      if (!options.includeHidden && (group.visible === false || layer.visible === false)) continue;
      const events = layer.events.filter((event) => eventAtProbe(event, probe)).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title, 'zh-Hans-CN'));
      if (events.length) layerResults.push({ layer, events });
    }
    if (layerResults.length) groups.push({ group, layers: layerResults });
  }
  return {
    probe,
    label: formatTimeValue(probe.time, probe.precision),
    range: probeRange(probe),
    groups,
    total: groups.reduce((sum, group) => sum + group.layers.reduce((layerSum, layer) => layerSum + layer.events.length, 0), 0),
  };
}

export function compareProbes(workspace, first, second, options = {}) {
  const earlier = first.time <= second.time ? first : second;
  const later = earlier === first ? second : first;
  const categories = {
    atFirst: [],
    atSecond: [],
    firstOnly: [],
    secondOnly: [],
    spansBoth: [],
    startsBetween: [],
    endsBetween: [],
  };
  for (const layer of workspace.layers) {
    const group = workspace.groups.find((entry) => entry.id === layer.groupId);
    if (!options.includeHidden && (group?.visible === false || layer.visible === false)) continue;
    for (const event of layer.events) {
      const atFirst = eventAtProbe(event, first);
      const atSecond = eventAtProbe(event, second);
      const record = { event, layer, group };
      if (atFirst) categories.atFirst.push(record);
      if (atSecond) categories.atSecond.push(record);
      if (atFirst && !atSecond) categories.firstOnly.push(record);
      if (atSecond && !atFirst) categories.secondOnly.push(record);
      if (event.start <= earlier.time && event.end >= later.time) categories.spansBoth.push(record);
      if (event.start > earlier.time && event.start <= later.time) categories.startsBetween.push(record);
      if (event.end >= earlier.time && event.end < later.time) categories.endsBetween.push(record);
    }
  }
  for (const values of Object.values(categories)) values.sort((a, b) => a.event.start - b.event.start);
  return { first, second, earlier, later, ...categories };
}

export function setProbeAt(probes, time, options = {}) {
  const copy = probes.map((probe) => ({ ...probe }));
  if (options.second || options.append) {
    if (copy.length >= 2) copy[1] = createProbe(time, { ...copy[1], ...options, id: copy[1].id });
    else copy.push(createProbe(time, options));
  } else if (copy.length) {
    copy[0] = createProbe(time, { ...copy[0], ...options, id: copy[0].id });
  } else {
    copy.push(createProbe(time, options));
  }
  return copy.slice(0, 2);
}

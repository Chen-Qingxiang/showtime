import { eventMatchKey, parseTableCSV } from './csv.js';

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}

function metadataItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.events)) return value.events;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([id, metadata]) => ({ id, ...metadata }));
  }
  return [];
}

function findCandidates(item, layers, events) {
  if (item.id || item.eventId || item.event_id) {
    const id = item.id || item.eventId || item.event_id;
    const exact = events.filter((event) => event.id === id);
    if (exact.length) return exact;
  }
  const layerText = normalize(item.layer || item.layerName || item.layer_id);
  const rawTime = normalize(item.time || item.rawTime || item.raw_time);
  const title = normalize(item.title);
  const occurrence = Number(item.occurrence || item.index || 0);
  return events.filter((event) => {
    const layer = layers.find((entry) => entry.id === event.layerId);
    const layerMatches = !layerText || [layer?.id, layer?.name, layer?.file].some((value) => normalize(value) === layerText);
    return layerMatches
      && (!rawTime || normalize(event.rawTime) === rawTime)
      && (!title || normalize(event.title) === title)
      && (!occurrence || event.occurrence === occurrence);
  });
}

function cleanMetadata(item) {
  const ignored = new Set(['id', 'eventId', 'event_id', 'layer', 'layerName', 'layer_id', 'time', 'rawTime', 'raw_time', 'title', 'occurrence', 'index']);
  return Object.fromEntries(Object.entries(item).filter(([key, value]) => !ignored.has(key) && value !== ''));
}

export function applyEventMetadata(layers, rawMetadata) {
  const events = layers.flatMap((layer) => layer.events);
  const issues = [];
  let matched = 0;
  for (const item of metadataItems(rawMetadata)) {
    const candidates = findCandidates(item, layers, events);
    if (candidates.length === 1) {
      candidates[0].metadata = { ...(candidates[0].metadata || {}), ...cleanMetadata(item) };
      matched += 1;
    } else if (!candidates.length) {
      issues.push({
        type: 'sidecar_unmatched', severity: 'warning',
        message: `元数据没有匹配事件：${item.layer || ''} / ${item.time || ''} / ${item.title || item.id || ''}`,
        suggestion: '检查 layer、time、title；重复事件请补 occurrence。',
      });
    } else {
      issues.push({
        type: 'sidecar_ambiguous', severity: 'warning',
        message: `元数据匹配到 ${candidates.length} 个事件：${item.title || item.id || ''}`,
        suggestion: '添加 occurrence（从 1 开始）或直接使用导出项目中的确定性事件 id。',
      });
    }
  }
  return { matched, issues };
}

export function parseSourcesCSV(text) {
  return parseTableCSV(text).map((row) => ({
    eventId: row.event_id || row.eventId || '',
    layer: row.layer || '',
    time: row.time || '',
    title: row.title || '',
    occurrence: Number(row.occurrence || 0) || undefined,
    source: row.source || row.citation || '',
    page: row.page || row.source_page || '',
    url: row.url || row.source_url || '',
    quotation: row.quotation || row.quote || '',
    notes: row.notes || '',
  }));
}

export function applySources(layers, sources) {
  const events = layers.flatMap((layer) => layer.events);
  const issues = [];
  let matched = 0;
  for (const source of sources) {
    const candidates = findCandidates({
      id: source.eventId,
      layer: source.layer,
      time: source.time,
      title: source.title,
      occurrence: source.occurrence,
    }, layers, events);
    if (candidates.length === 1) {
      const event = candidates[0];
      const list = Array.isArray(event.metadata?.sources) ? event.metadata.sources : [];
      event.metadata = { ...(event.metadata || {}), sources: [...list, source] };
      matched += 1;
    } else {
      issues.push({
        type: candidates.length ? 'sidecar_ambiguous' : 'sidecar_unmatched', severity: 'warning',
        message: `来源记录${candidates.length ? '存在歧义' : '没有匹配事件'}：${source.title || source.eventId || '(无标题)'}`,
        suggestion: '使用事件 id，或补齐 layer、time、title、occurrence。',
      });
    }
  }
  return { matched, issues };
}

export function metadataSearchText(event, layer = null) {
  const values = [event.title, event.rawTime, layer?.name, layer?.role, layer?.groupName];
  const walk = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'object') Object.values(value).forEach(walk);
    else values.push(String(value));
  };
  walk(event.metadata);
  return normalize(values.join(' '));
}

export function eventMetadataRecords(layers) {
  return layers.flatMap((layer) => layer.events)
    .filter((event) => event.metadata && Object.keys(event.metadata).length)
    .map((event) => ({
      id: event.id,
      layer: layers.find((layer) => layer.id === event.layerId)?.name || event.layerId,
      time: event.rawTime,
      title: event.title,
      occurrence: event.occurrence,
      ...event.metadata,
    }));
}

export function eventSourceRecords(layers) {
  const rows = [];
  for (const layer of layers) {
    for (const event of layer.events) {
      for (const source of event.metadata?.sources || []) {
        rows.push({
          event_id: event.id,
          layer: layer.name,
          time: event.rawTime,
          title: event.title,
          occurrence: event.occurrence,
          source: source.source || '',
          page: source.page || '',
          url: source.url || '',
          quotation: source.quotation || '',
          notes: source.notes || '',
        });
      }
    }
  }
  return rows;
}

export function stableMatchDescription(layerName, event) {
  return eventMatchKey(layerName, event.rawTime, event.title, event.occurrence);
}

import { metadataSearchText } from './metadata.js';
import { parseTimeExpression } from './time.js';

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}

function asList(value) {
  if (Array.isArray(value)) return value.map(normalize).filter(Boolean);
  return String(value ?? '').split(/[,，;；]/).map(normalize).filter(Boolean);
}

export function parseSearchQuery(query) {
  const text = normalize(query);
  const candidates = [...text.matchAll(/(?:^|\s)((?:-?\d+|\d+\s*(?:bce?|ce)|(?:公元)?前\s*\d+)\s*[~～至到]\s*(?:-?\d+|\d+\s*(?:bce?|ce)|(?:公元)?前\s*\d+))(?:\s|$)/gi)];
  let range = null;
  let remainder = text;
  if (candidates[0]) {
    range = parseTimeExpression(candidates[0][1]);
    remainder = `${text.slice(0, candidates[0].index)} ${text.slice(candidates[0].index + candidates[0][0].length)}`;
  }
  const terms = remainder.match(/"[^"]+"|'[^']+'|\S+/g)?.map((term) => term.replace(/^["']|["']$/g, '')).filter(Boolean) || [];
  return { raw: query, terms, range: range ? { start: range.start, end: range.end } : null };
}

export function eventIntersectsRange(event, range) {
  return !range || event.end >= range.start && event.start <= range.end;
}

function layerInScope(layer, workspace, scope, currentLayerId) {
  const group = workspace.groups.find((entry) => entry.id === layer.groupId);
  if (group?.visible === false || layer.visible === false) return scope === 'all';
  if (scope === 'current') return layer.id === currentLayerId;
  if (scope === 'visible') return layer.visible !== false && group?.visible !== false;
  if (scope === 'primary') return layer.role === 'primary';
  if (scope === 'background') return layer.role === 'background' || layer.role === 'context';
  return true;
}

function metadataField(event, key) {
  const metadata = event.metadata || {};
  const aliases = {
    tags: ['tags', 'tag'],
    locations: ['location', 'locations', 'place', 'places'],
    people: ['people', 'person', 'persons'],
  }[key] || [key];
  return aliases.flatMap((name) => asList(metadata[name]));
}

export function matchesFilters(event, layer, workspace, filters = {}, viewport = null) {
  const groups = new Set(asList(filters.groups));
  const roles = new Set(asList(filters.roles));
  if (groups.size && !groups.has(normalize(layer.groupId)) && !groups.has(normalize(workspace.groups.find((group) => group.id === layer.groupId)?.name))) return false;
  if (roles.size && !roles.has(normalize(layer.role))) return false;
  for (const key of ['tags', 'locations', 'people']) {
    const expected = asList(filters[key]);
    if (expected.length && !expected.every((value) => metadataField(event, key).some((actual) => actual.includes(value)))) return false;
  }
  const timeRange = filters.timeRange || (filters.timeStart != null || filters.timeEnd != null
    ? { start: Number(filters.timeStart ?? -Infinity), end: Number(filters.timeEnd ?? Infinity) }
    : null);
  if (timeRange && !eventIntersectsRange(event, timeRange)) return false;
  if (filters.viewportOnly && viewport && !eventIntersectsRange(event, viewport)) return false;
  return true;
}

export function searchWorkspace(workspace, query, options = {}) {
  const parsed = typeof query === 'string' ? parseSearchQuery(query) : query;
  const scope = options.scope || workspace.search?.scope || 'all';
  const filters = options.filters || workspace.filters || {};
  const eventResults = [];
  const layerResults = [];
  const matchIds = new Set();
  for (const layer of workspace.layers) {
    if (!layerInScope(layer, workspace, scope, options.currentLayerId)) continue;
    const group = workspace.groups.find((entry) => entry.id === layer.groupId);
    const layerText = normalize(`${layer.name} ${group?.name || ''} ${layer.role}`);
    if (parsed.terms.length && parsed.terms.every((term) => layerText.includes(term))) {
      layerResults.push({ kind: 'layer', layer, time: layer.events[0]?.start ?? Infinity });
    }
    for (const event of layer.events) {
      if (!eventIntersectsRange(event, parsed.range)) continue;
      if (!matchesFilters(event, layer, workspace, filters, options.viewport)) continue;
      const text = metadataSearchText(event, { ...layer, groupName: group?.name });
      if (!parsed.terms.every((term) => text.includes(term))) continue;
      matchIds.add(event.id);
      eventResults.push({ kind: 'event', event, layer, group, time: event.start });
    }
  }
  eventResults.sort((a, b) => a.time - b.time || a.event.title.localeCompare(b.event.title, 'zh-Hans-CN'));
  layerResults.sort((a, b) => a.layer.order - b.layer.order);
  return { parsed, events: eventResults, layers: layerResults, matchIds, total: eventResults.length + layerResults.length };
}

export function collectFilterFacets(workspace) {
  const result = { groups: [], roles: [], tags: [], locations: [], people: [] };
  result.groups = workspace.groups.map((group) => ({ value: group.id, label: group.name }));
  result.roles = [...new Set(workspace.layers.map((layer) => layer.role))].map((value) => ({ value, label: value }));
  for (const key of ['tags', 'locations', 'people']) {
    const values = new Set();
    for (const layer of workspace.layers) for (const event of layer.events) for (const value of metadataField(event, key)) values.add(value);
    result[key] = [...values].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')).map((value) => ({ value, label: value }));
  }
  return result;
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function flatten(workspace) {
  return workspace.layers.flatMap((layer) => layer.events.map((event) => ({ event, layer })));
}

function exactKey(record) {
  return `${normalize(record.layer.name)}\u001f${normalize(record.event.rawTime)}\u001f${normalize(record.event.title)}\u001f${record.event.occurrence || 1}`;
}

function titleTokens(title) {
  const text = normalize(title);
  const words = text.match(/[\p{Letter}\p{Number}]+/gu) || [];
  if (words.length > 1) return new Set(words);
  return new Set([...text]);
}

function similarity(a, b) {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function changeTypes(current, baseline) {
  const changes = [];
  if (Math.abs(current.event.start - baseline.event.start) > 1e-12 || Math.abs(current.event.end - baseline.event.end) > 1e-12 || current.event.rawTime !== baseline.event.rawTime) changes.push('time');
  if (current.event.title !== baseline.event.title) changes.push('title');
  if (current.layer.name !== baseline.layer.name || current.layer.role !== baseline.layer.role) changes.push('layer');
  if (JSON.stringify(current.event.metadata || {}) !== JSON.stringify(baseline.event.metadata || {})) changes.push('metadata');
  return changes;
}

function bestCandidate(current, baselines) {
  let best = null;
  for (const baseline of baselines) {
    const titleScore = similarity(current.event.title, baseline.event.title);
    const sameTitle = normalize(current.event.title) === normalize(baseline.event.title);
    const sameTime = normalize(current.event.rawTime) === normalize(baseline.event.rawTime);
    const sameLayer = normalize(current.layer.name) === normalize(baseline.layer.name);
    const distance = Math.abs(current.event.start - baseline.event.start) + Math.abs(current.event.end - baseline.event.end);
    const timeScale = Math.max(1, Math.abs(current.event.end - current.event.start), Math.abs(baseline.event.end - baseline.event.start));
    const timeScore = Math.max(0, 1 - distance / (timeScale * 4));
    const score = titleScore * 0.55 + timeScore * 0.25 + (sameLayer ? 0.2 : 0);
    const certain = (sameTitle && (sameLayer || timeScore > 0.8)) || (sameTime && sameLayer && titleScore > 0.35);
    if ((certain || score >= 0.56) && (!best || score > best.score)) best = { baseline, score, certain };
  }
  return best;
}

export function compareWorkspaces(currentWorkspace, baselineWorkspace) {
  const current = flatten(currentWorkspace);
  const baseline = flatten(baselineWorkspace);
  const baselineByKey = new Map(baseline.map((record) => [exactKey(record), record]));
  const usedBaseline = new Set();
  const unchanged = [];
  const modified = [];
  const possible = [];
  const added = [];

  for (const record of current) {
    const exact = baselineByKey.get(exactKey(record));
    if (exact && !usedBaseline.has(exact)) {
      usedBaseline.add(exact);
      const changes = changeTypes(record, exact);
      if (changes.length) modified.push({ kind: 'modified', current: record, baseline: exact, changes, confidence: 'certain' });
      else unchanged.push({ kind: 'unchanged', current: record, baseline: exact, changes: [], confidence: 'certain' });
      continue;
    }
    const candidates = baseline.filter((entry) => !usedBaseline.has(entry));
    const match = bestCandidate(record, candidates);
    if (!match) {
      added.push({ kind: 'added', current: record, baseline: null, changes: ['added'], confidence: 'certain' });
      continue;
    }
    usedBaseline.add(match.baseline);
    const result = {
      kind: match.certain ? 'modified' : 'possible',
      current: record,
      baseline: match.baseline,
      changes: changeTypes(record, match.baseline),
      confidence: match.certain ? 'certain' : 'possible',
      score: match.score,
    };
    (match.certain ? modified : possible).push(result);
  }

  const removed = baseline
    .filter((record) => !usedBaseline.has(record))
    .map((record) => ({ kind: 'removed', current: null, baseline: record, changes: ['removed'], confidence: 'certain' }));
  const all = [...added, ...removed, ...modified, ...possible].sort((a, b) => {
    const timeA = a.current?.event.start ?? a.baseline?.event.start ?? Infinity;
    const timeB = b.current?.event.start ?? b.baseline?.event.start ?? Infinity;
    return timeA - timeB;
  });
  return { added, removed, modified, possible, unchanged, all, baselineName: baselineWorkspace.name, currentName: currentWorkspace.name };
}

export function diffRows(diff) {
  return diff.all.map((entry) => ({
    status: entry.kind,
    confidence: entry.confidence,
    changes: entry.changes.join('|'),
    current_layer: entry.current?.layer.name || '',
    current_time: entry.current?.event.rawTime || '',
    current_title: entry.current?.event.title || '',
    baseline_layer: entry.baseline?.layer.name || '',
    baseline_time: entry.baseline?.event.rawTime || '',
    baseline_title: entry.baseline?.event.title || '',
  }));
}

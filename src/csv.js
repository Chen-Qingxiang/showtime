import { parseTimeExpression, precisionRank } from './time.js';

export function hashString(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function slugify(value, fallback = 'layer') {
  const result = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return result || fallback;
}

export function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  let quoteSeen = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
        quoteSeen = true;
      }
    } else if (char === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return { fields: fields.map((field) => field.trim()), unclosedQuote: quoted, quoteSeen };
}

function issue(type, line, raw, message, suggestion, severity = 'warning', extra = {}) {
  return { type, line, raw, message, suggestion, severity, ...extra };
}

export function createQualityReport(fileName = '未命名.csv') {
  return {
    fileName,
    fileCount: 1,
    totalRows: 0,
    successfulEvents: 0,
    ignoredComments: 0,
    ignoredBlank: 0,
    issues: [],
    precision: [],
    generatedAt: new Date().toISOString(),
  };
}

export function eventMatchKey(layerName, rawTime, title, occurrence = 1) {
  return `${String(layerName).normalize('NFKC').trim()}\u001f${String(rawTime).trim()}\u001f${String(title).normalize('NFKC').trim()}\u001f${occurrence}`;
}

export function makeEventId(layerId, rawTime, title, occurrence = 1) {
  return `evt-${hashString(eventMatchKey(layerId, rawTime, title, occurrence))}`;
}

export function parseTimelineCSV(text, options = {}) {
  const layerName = options.layerName || '未命名图层';
  const layerId = options.layerId || `layer-${hashString(layerName)}`;
  const fileName = options.fileName || `${layerName}.csv`;
  const report = createQualityReport(fileName);
  let source = String(text ?? '');
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const lines = source.split(/\r\n|\n|\r/);
  const events = [];
  const occurrenceByKey = new Map();
  const duplicateKeys = new Set();
  const precisions = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index];
    report.totalRows += 1;
    const trimmed = raw.trim();
    if (!trimmed) {
      report.ignoredBlank += 1;
      continue;
    }
    if (trimmed.startsWith('#')) {
      report.ignoredComments += 1;
      continue;
    }
    const parsed = parseCSVLine(raw);
    if (parsed.unclosedQuote) {
      report.issues.push(issue('quote', lineNumber, raw, '双引号没有闭合，本行未导入。', '用一对英文双引号包住标题；标题内的双引号写成两个双引号。', 'error'));
      continue;
    }
    const [rawTime = '', ...titleFields] = parsed.fields;
    const title = titleFields.join(',').trim();
    if (index === 0 && rawTime.toLowerCase() === 'time' && title.toLowerCase() === 'title') continue;
    if (parsed.fields.length < 2) {
      report.issues.push(issue('columns', lineNumber, raw, '缺少标题列，本行仍以“未命名事件”导入。', '保持两列 time,title。'));
    } else if (parsed.fields.length > 2) {
      report.issues.push(issue('comma', lineNumber, raw, '检测到多于两列，已把后续列用逗号合并为标题。', '标题含逗号时请用英文双引号包住整个标题。'));
    }
    const range = parseTimeExpression(rawTime, { now: options.now });
    if (!range) {
      report.issues.push(issue('invalid_date', lineNumber, raw, `无法解析时间“${rawTime}”，本行未导入。`, '使用年份、BCE/公元前、YYYY-MM-DD 或 start~end。', 'error'));
      continue;
    }
    if (range.reversed) {
      report.issues.push(issue('reversed_interval', lineNumber, raw, '区间终点早于起点；已按时间先后规范化。', '交换区间起止值，避免语义含混。'));
    }
    if (range.openEnd) {
      report.issues.push(issue('open_interval', lineNumber, raw, '这是开区间，显示终点会随当前时间变化。', '若研究需要可复现的固定范围，请填写明确终点。', 'info'));
    }
    const finalTitle = title || '(未命名事件)';
    if (!title) {
      report.issues.push(issue('empty_title', lineNumber, raw, '标题为空，已使用“未命名事件”。', '补充简短、可辨识的事件标题。'));
    }
    if (title.length > 120) {
      report.issues.push(issue('long_title', lineNumber, raw, `标题有 ${title.length} 个字符，时间轴上可能被截断。`, '把长说明移入 event_meta.json 的 description 或 notes。'));
    }
    const baseKey = eventMatchKey(layerName, rawTime, finalTitle, 0);
    const occurrence = (occurrenceByKey.get(baseKey) || 0) + 1;
    occurrenceByKey.set(baseKey, occurrence);
    if (occurrence > 1) {
      duplicateKeys.add(baseKey);
      report.issues.push(issue('duplicate_event', lineNumber, raw, `与此前事件重复（第 ${occurrence} 次出现）。`, '确认是否为有意重复；sidecar 匹配时可使用 occurrence。'));
    }
    precisions.add(range.startPrecision);
    precisions.add(range.endPrecision);
    events.push({
      id: makeEventId(layerId, rawTime, finalTitle, occurrence),
      layerId,
      title: finalTitle,
      rawTime: String(rawTime).trim(),
      start: range.start,
      end: range.end,
      startPrecision: range.startPrecision,
      endPrecision: range.endPrecision,
      startDate: range.startDate,
      endDate: range.endDate,
      openEnd: range.openEnd,
      occurrence,
      metadata: {},
    });
  }

  report.successfulEvents = events.length;
  report.precision = [...precisions].sort((a, b) => precisionRank(a) - precisionRank(b));
  if (report.precision.length > 1) {
    report.issues.push(issue('mixed_precision', null, '', `文件混合使用 ${report.precision.join('、')} 精度。`, '这是允许的；若非有意，请检查时间列。', 'info'));
  }
  report.duplicateEventKinds = duplicateKeys.size;
  return { events, report };
}

function quoteCSV(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeTimelineCSV(events, options = {}) {
  const rows = options.header === false ? [] : ['time,title'];
  for (const event of events) rows.push(`${quoteCSV(event.rawTime)},${quoteCSV(event.title)}`);
  return `${rows.join('\r\n')}\r\n`;
}

export function parseTableCSV(text) {
  let source = String(text ?? '');
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const lines = source.split(/\r\n|\n|\r/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = parseCSVLine(lines[0]).fields.map((field) => field.trim());
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line).fields;
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
  });
}

export function serializeTableCSV(rows, columns = null) {
  if (!rows.length && !columns) return '';
  const keys = columns || [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[keys.join(','), ...rows.map((row) => keys.map((key) => quoteCSV(row[key])).join(','))].join('\r\n')}\r\n`;
}

export function combineQualityReports(reports, extraIssues = []) {
  const list = reports.filter(Boolean);
  return {
    fileName: list.length === 1 ? list[0].fileName : `${list.length} 个文件`,
    fileCount: list.reduce((sum, report) => sum + (report.fileCount || 1), 0),
    totalRows: list.reduce((sum, report) => sum + report.totalRows, 0),
    successfulEvents: list.reduce((sum, report) => sum + report.successfulEvents, 0),
    ignoredComments: list.reduce((sum, report) => sum + report.ignoredComments, 0),
    ignoredBlank: list.reduce((sum, report) => sum + report.ignoredBlank, 0),
    issues: [...list.flatMap((report) => report.issues.map((entry) => ({ ...entry, fileName: report.fileName }))), ...extraIssues],
    generatedAt: new Date().toISOString(),
  };
}

export function qualityReportAsText(report) {
  const lines = [
    '# ShowTime 导入质检报告',
    '',
    `- 文件数：${report.fileCount}`,
    `- 总行数：${report.totalRows}`,
    `- 成功事件：${report.successfulEvents}`,
    `- 注释行：${report.ignoredComments}`,
    `- 空行：${report.ignoredBlank}`,
    `- 问题数：${report.issues.length}`,
    '',
  ];
  for (const entry of report.issues) {
    lines.push(`## ${entry.fileName || report.fileName}${entry.line ? `:${entry.line}` : ''} · ${entry.type}`);
    lines.push('', entry.message, '', `建议：${entry.suggestion || '检查原始数据。'}`);
    if (entry.raw) lines.push('', '```csv', entry.raw, '```');
    lines.push('');
  }
  return lines.join('\n');
}

(function (root) {
  'use strict';

  function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        fields.push(current.trim()); current = '';
      } else current += ch;
    }
    fields.push(current.trim());
    return fields;
  }

  function parseCSV(text, layerName = '默认') {
    const rows = [];
    let record = '';
    let quoted = false;
    let lineNumber = 1;
    let recordLine = 1;
    const append = () => {
      const line = record.trim();
      record = '';
      if (!line || line.startsWith('#')) return;
      const fields = parseCSVLine(line);
      const time = fields[0];
      if (!time || (time.toLowerCase() === 'time' && fields[1]?.toLowerCase() === 'title')) return;
      rows.push({ time, title: fields.slice(1).join(',').trim(), layer: layerName, sourceLine: recordLine });
    };
    const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      // Comments are whole physical lines; their quotes do not start a CSV record.
      if (!quoted && !record.trim() && ch === '#') {
        while (i < source.length && source[i] !== '\n') i++;
        append(); lineNumber++; recordLine = lineNumber;
        continue;
      }
      if (ch === '"') {
        if (quoted && source[i + 1] === '"') { record += '""'; i++; continue; }
        quoted = !quoted;
      }
      if (ch === '\n') {
        if (quoted) record += ch;
        else { append(); recordLine = lineNumber + 1; }
        lineNumber++;
      } else record += ch;
    }
    if (quoted) throw new Error(`CSV 引号未闭合（第 ${recordLine} 行）`);
    append();
    return rows;
  }

  const api = Object.freeze({ parseCSVLine, parseCSV });
  if (root) root.ShowtimeCsv = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? null : window);

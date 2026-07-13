import { serializeTableCSV, serializeTimelineCSV, slugify } from './csv.js';
import { diffRows } from './diff.js';
import { formatTimeRange, formatTimeValue } from './time.js';
import { exportProjectArchive, projectFileName } from './project.js';
import { qualityReportAsText } from './csv.js';
import { resolveLodLayers } from './lod.js';

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text, fileName, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), fileName);
}

export function exportLayerCSV(layer) {
  downloadText(serializeTimelineCSV(layer.events), `${slugify(layer.name)}.csv`, 'text/csv;charset=utf-8');
}

export function filteredEventsCSV(workspace, searchResult) {
  const matches = searchResult?.matchIds || new Set(workspace.layers.flatMap((layer) => layer.events.map((event) => event.id)));
  const rows = [];
  for (const layer of workspace.layers) {
    const events = layer.events.filter((event) => matches.has(event.id));
    if (!events.length) continue;
    rows.push(`# layer: ${layer.name}`);
    rows.push(serializeTimelineCSV(events).trimEnd());
    rows.push('');
  }
  return `${rows.join('\r\n')}\r\n`;
}

export function exportFilteredCSV(workspace, searchResult) {
  downloadText(filteredEventsCSV(workspace, searchResult), `${slugify(workspace.name)}-筛选结果.csv`, 'text/csv;charset=utf-8');
}

export function exportQualityReport(report, workspaceName = 'showtime') {
  downloadText(qualityReportAsText(report), `${slugify(workspaceName)}-质检报告.md`, 'text/markdown;charset=utf-8');
}

export function exportDiffReport(diff, workspaceName = 'showtime') {
  downloadText(serializeTableCSV(diffRows(diff)), `${slugify(workspaceName)}-版本差异.csv`, 'text/csv;charset=utf-8');
}

export function exportProject(workspace) {
  const bytes = exportProjectArchive(workspace);
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), projectFileName(workspace));
}

export async function exportPNG(renderer, workspaceName, scale = 3) {
  const canvas = renderer.exportCanvas(scale);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG 生成失败')), 'image/png'));
  downloadBlob(blob, `${slugify(workspaceName)}-当前视图.png`);
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

function xAt(time, view, width, labelWidth, right) {
  return labelWidth + (time - view.start) / (view.end - view.start) * (width - labelWidth - right);
}

function niceStep(span, target = 9) {
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, Number.MIN_VALUE)));
  const normalized = raw / power;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
}

export function workspaceToSVG(workspace, options = {}) {
  const width = options.width || 1600;
  const labelWidth = options.labelWidth || 180;
  const right = 28;
  const rowHeight = 34;
  const top = 60;
  const layers = resolveLodLayers(workspace, workspace.view).layers;
  const height = top + layers.length * (rowHeight + 12) + 42;
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#090c12"/>`,
    `<rect width="${labelWidth}" height="100%" fill="#0e131c"/>`,
    `<style>text{font-family:system-ui,-apple-system,"Noto Sans SC",sans-serif}.axis{fill:#91a1ba;font-size:12px}.layer{fill:#dce6f5;font-size:13px}.event{fill:#f7f9fc;font-size:12px}.context{stroke-dasharray:5 3}.background{fill-opacity:.42}.primary{stroke-width:2}.anchor{stroke-width:2}</style>`,
  ];
  const span = workspace.view.end - workspace.view.start;
  const step = niceStep(span);
  const first = Math.ceil(workspace.view.start / step) * step;
  for (let value = first, guard = 0; value <= workspace.view.end && guard < 100; value += step, guard += 1) {
    const x = xAt(value, workspace.view, width, labelWidth, right);
    parts.push(`<line x1="${x}" y1="36" x2="${x}" y2="${height}" stroke="#1b2433"/>`);
    parts.push(`<text class="axis" x="${x}" y="27" text-anchor="middle">${escapeXml(formatTimeValue(value, span < 2 ? 'month' : 'year'))}</text>`);
  }
  layers.forEach((layer, layerIndex) => {
    const y = top + layerIndex * (rowHeight + 12);
    parts.push(`<text class="layer" x="16" y="${y + 20}">${escapeXml(layer.name)} [${escapeXml(layer.role)}]</text>`);
    for (const event of layer.events.filter((entry) => entry.end >= workspace.view.start && entry.start <= workspace.view.end)) {
      const x1 = Math.max(labelWidth, xAt(event.start, workspace.view, width, labelWidth, right));
      const x2 = Math.min(width - right, xAt(event.end, workspace.view, width, labelWidth, right));
      const point = Math.abs(event.end - event.start) < 1e-12 || x2 - x1 < 3;
      if (point) {
        if (layer.role === 'anchor') parts.push(`<path d="M ${x1} ${y + 8} L ${x1 + 7} ${y + 15} L ${x1} ${y + 22} L ${x1 - 7} ${y + 15} Z" fill="${escapeXml(layer.color)}" stroke="#fff" class="anchor"/>`);
        else parts.push(`<circle cx="${x1}" cy="${y + 15}" r="5" fill="${escapeXml(layer.color)}"/>`);
        parts.push(`<text class="event" x="${x1 + 9}" y="${y + 19}">${escapeXml(event.title)}</text>`);
      } else {
        parts.push(`<rect class="${escapeXml(layer.role)}" x="${x1}" y="${y}" width="${Math.max(3, x2 - x1)}" height="${rowHeight - 4}" rx="5" fill="${escapeXml(layer.color)}" stroke="${escapeXml(layer.color)}"/>`);
        parts.push(`<text class="event" x="${x1 + 6}" y="${y + 20}">${escapeXml(event.title)}</text>`);
      }
      parts.push(`<title>${escapeXml(`${event.title} · ${formatTimeRange(event)} · ${layer.name}`)}</title>`);
    }
  });
  workspace.probes.forEach((probe, index) => {
    const x = xAt(probe.time, workspace.view, width, labelWidth, right);
    if (x >= labelWidth && x <= width - right) parts.push(`<line x1="${x}" y1="34" x2="${x}" y2="${height}" stroke="${index ? '#f4b33d' : '#5ab4ff'}" stroke-dasharray="6 4"/><text x="${x}" y="48" text-anchor="middle" fill="${index ? '#f4b33d' : '#5ab4ff'}">${index ? 'B' : 'A'}</text>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportSVG(workspace) {
  downloadText(workspaceToSVG(workspace), `${slugify(workspace.name)}-当前视图.svg`, 'image/svg+xml;charset=utf-8');
}

import { aggregateEvents, resolveLodLayers } from './lod.js';
import { daysInYear, formatTimeRange, formatTimeValue, precisionRank } from './time.js';

const ROLE_LABELS = { primary: '主', context: '辅', anchor: '锚', background: '背' };
const ROLE_ALPHA = { primary: 0.9, context: 0.64, anchor: 0.82, background: 0.42 };
const DIFF_COLORS = { added: '#44d17a', removed: '#ff6b7a', modified: '#ffbd4a', possible: '#b48cff' };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorWithAlpha(color, alpha) {
  if (/^#[\da-f]{6}$/i.test(color)) {
    const hex = color.slice(1);
    const values = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    return `rgba(${values.join(',')},${alpha})`;
  }
  return color;
}

function niceStep(span, target = 8) {
  const raw = span / target;
  const exponent = Math.floor(Math.log10(Math.max(raw, Number.MIN_VALUE)));
  const power = 10 ** exponent;
  const value = raw / power;
  return (value <= 1 ? 1 : value <= 2 ? 2 : value <= 5 ? 5 : 10) * power;
}

function roundRect(context, x, y, width, height, radius = 4) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function visualRange(event, mode = 'point') {
  if (Math.abs(event.end - event.start) >= 1e-12 || mode === 'point') return { start: event.start, end: event.end };
  const rank = precisionRank(event.startPrecision);
  const modeRank = { year: 1, month: 2, date: 3, time: 6 }[mode] || 0;
  if (rank > modeRank) return { start: event.start, end: event.end };
  const year = Math.floor(event.start);
  const spans = {
    year: 1,
    month: 1 / 12,
    date: 1 / daysInYear(year),
    hour: 1 / (daysInYear(year) * 24),
    minute: 1 / (daysInYear(year) * 24 * 60),
    second: 1 / (daysInYear(year) * 24 * 60 * 60),
  };
  return { start: event.start, end: event.start + (spans[event.startPrecision] || 0) };
}

function layoutLanes(events, pointDisplayMode = 'point') {
  const lanes = [];
  const result = new Map();
  const sorted = [...events].sort((a, b) => visualRange(a, pointDisplayMode).start - visualRange(b, pointDisplayMode).start || visualRange(a, pointDisplayMode).end - visualRange(b, pointDisplayMode).end);
  for (const event of sorted) {
    const range = visualRange(event, pointDisplayMode);
    let lane = lanes.findIndex((end) => end <= range.start);
    if (lane < 0) {
      lane = lanes.length;
      lanes.push(range.end);
    } else lanes[lane] = range.end;
    result.set(event.id, lane);
  }
  return { lanes: result, count: lanes.length };
}

export class TimelineRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.workspace = null;
    this.search = null;
    this.diff = null;
    this.diffByEvent = new Map();
    this.hits = [];
    this.layerHits = [];
    this.frame = 0;
    this.options = options;
    this.metrics = { labelWidth: 132, top: 40, rowHeight: 24, laneGap: 5, layerGap: 13, right: 18 };
    this.lastRenderInfo = { layers: [], statuses: new Map(), density: new Map() };
  }

  setWorkspace(workspace) {
    this.workspace = workspace;
    this.schedule();
  }

  setSearch(search) {
    this.search = search;
    this.schedule();
  }

  setDiff(diff) {
    this.diff = diff;
    this.diffByEvent = new Map();
    for (const entry of diff?.all || []) {
      if (entry.current?.event?.id) this.diffByEvent.set(entry.current.event.id, entry.kind);
    }
    this.schedule();
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  getDimensions(workspace = this.workspace) {
    const width = Math.max(320, this.canvas.parentElement?.clientWidth || this.canvas.clientWidth || 800);
    const mobile = width <= 720;
    const labelWidth = mobile ? 88 : 132;
    const visible = workspace ? resolveLodLayers(workspace, workspace.view).layers : [];
    let height = this.metrics.top + 38;
    const density = new Map();
    for (const layer of visible) {
      const events = layer.events.filter((event) => event.end >= workspace.view.start && event.start <= workspace.view.end);
      const aggregation = aggregateEvents(events, workspace.view, Math.max(1, width - labelWidth - 18));
      density.set(layer.id, aggregation.mode);
      const laneCount = aggregation.mode === 'full' ? Math.min(6, Math.max(1, layoutLanes(events, workspace.pointDisplayMode).count)) : 1;
      height += laneCount * (this.metrics.rowHeight + this.metrics.laneGap) + this.metrics.layerGap + 10;
    }
    const minimum = Math.max(440, (window.visualViewport?.height || window.innerHeight) - 132);
    return { width, height: Math.max(minimum, height), labelWidth, visible, density };
  }

  resize() {
    if (!this.workspace) return;
    const dimensions = this.getDimensions();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${dimensions.width}px`;
    this.canvas.style.height = `${dimensions.height}px`;
    const pixelWidth = Math.round(dimensions.width * dpr);
    const pixelHeight = Math.round(dimensions.height * dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.schedule();
  }

  xForTime(time, width = this.canvas.clientWidth, labelWidth = this.metrics.labelWidth) {
    if (!this.workspace) return 0;
    const plotWidth = Math.max(1, width - labelWidth - this.metrics.right);
    return labelWidth + (time - this.workspace.view.start) / (this.workspace.view.end - this.workspace.view.start) * plotWidth;
  }

  timeAt(x, width = this.canvas.clientWidth, labelWidth = this.metrics.labelWidth) {
    const plotWidth = Math.max(1, width - labelWidth - this.metrics.right);
    return this.workspace.view.start + (x - labelWidth) / plotWidth * (this.workspace.view.end - this.workspace.view.start);
  }

  hitTest(x, y) {
    return [...this.hits].reverse().find((hit) => x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height) || null;
  }

  layerAt(x, y) {
    return this.layerHits.find((hit) => x <= hit.width && y >= hit.y && y <= hit.y + hit.height)?.layer || null;
  }

  draw() {
    if (!this.workspace || !this.context) return;
    this.resizeCanvasOnly();
    const dpr = window.devicePixelRatio || 1;
    this._render(this.context, this.canvas.clientWidth, this.canvas.clientHeight, dpr, true);
  }

  resizeCanvasOnly() {
    const dimensions = this.getDimensions();
    const dpr = window.devicePixelRatio || 1;
    if (Math.abs(this.canvas.clientWidth - dimensions.width) > 1 || Math.abs(this.canvas.clientHeight - dimensions.height) > 1) {
      this.canvas.style.width = `${dimensions.width}px`;
      this.canvas.style.height = `${dimensions.height}px`;
    }
    if (this.canvas.width !== Math.round(dimensions.width * dpr)) this.canvas.width = Math.round(dimensions.width * dpr);
    if (this.canvas.height !== Math.round(dimensions.height * dpr)) this.canvas.height = Math.round(dimensions.height * dpr);
  }

  _drawAxis(context, width, labelWidth, view) {
    const y = this.metrics.top - 12;
    const span = Math.max(view.end - view.start, Number.MIN_VALUE);
    const step = niceStep(span, width < 600 ? 5 : 9);
    const first = Math.ceil(view.start / step) * step;
    context.strokeStyle = '#253044';
    context.fillStyle = '#91a1ba';
    context.font = '11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.beginPath();
    context.moveTo(labelWidth, y);
    context.lineTo(width - this.metrics.right, y);
    context.stroke();
    for (let value = first, guard = 0; value <= view.end + step * 0.01 && guard < 100; value += step, guard += 1) {
      const x = labelWidth + (value - view.start) / span * (width - labelWidth - this.metrics.right);
      context.strokeStyle = '#1b2433';
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, this.canvas.clientHeight);
      context.stroke();
      context.strokeStyle = '#3c4a60';
      context.beginPath();
      context.moveTo(x, y - 4);
      context.lineTo(x, y + 4);
      context.stroke();
      const precision = span < 2 && view.start > 0 ? (span < 0.01 ? 'date' : 'month') : 'year';
      context.fillText(formatTimeValue(value, precision), x, y - 8);
    }
    context.textAlign = 'left';
  }

  _drawEvent(context, record, layer, y, lane, width, labelWidth, options) {
    const event = record.event;
    const plotWidth = width - labelWidth - this.metrics.right;
    const span = this.workspace.view.end - this.workspace.view.start;
    const range = visualRange(event, this.workspace.pointDisplayMode);
    const rawX1 = labelWidth + (range.start - this.workspace.view.start) / span * plotWidth;
    const rawX2 = labelWidth + (range.end - this.workspace.view.start) / span * plotWidth;
    const point = Math.abs(range.end - range.start) < 1e-12;
    const rowY = y + lane * (this.metrics.rowHeight + this.metrics.laneGap);
    const x = clamp(rawX1, labelWidth, width - this.metrics.right);
    const x2 = clamp(rawX2, labelWidth, width - this.metrics.right);
    const roleAlpha = ROLE_ALPHA[layer.role] || 0.7;
    const matched = !this.search || !this.workspace.search?.query && !Object.keys(this.workspace.filters || {}).length || this.search.matchIds.has(event.id);
    const alpha = matched ? roleAlpha : (this.workspace.search?.dimUnmatched ? 0.12 : roleAlpha);
    const selected = this.workspace.selectedEventId === event.id;
    const diffStatus = this.diffByEvent.get(event.id);

    context.save();
    context.globalAlpha = layer.dimmed ? alpha * 0.45 : alpha;
    context.fillStyle = colorWithAlpha(layer.color, 0.94);
    context.strokeStyle = diffStatus ? DIFF_COLORS[diffStatus] : selected ? '#ffffff' : colorWithAlpha(layer.color, 1);
    context.lineWidth = selected ? 3 : diffStatus ? 2.5 : layer.role === 'primary' ? 1.8 : 1;
    if (layer.role === 'context') context.setLineDash([5, 3]);
    if (point || x2 - x < 3) {
      const cx = x;
      const cy = rowY + this.metrics.rowHeight / 2;
      if (layer.role === 'anchor') {
        context.beginPath();
        context.moveTo(cx, cy - 7);
        context.lineTo(cx + 7, cy);
        context.lineTo(cx, cy + 7);
        context.lineTo(cx - 7, cy);
        context.closePath();
      } else {
        context.beginPath();
        context.arc(cx, cy, layer.role === 'primary' ? 6 : 5, 0, Math.PI * 2);
      }
      context.fill();
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = matched ? 1 : 0.28;
      context.fillStyle = '#dce7f6';
      context.font = layer.role === 'primary' ? '600 12px system-ui' : '12px system-ui';
      context.fillText(event.title, cx + 9, cy + 4, Math.max(0, width - cx - 16));
      if (options.recordHits) this.hits.push({ x: cx - 8, y: cy - 9, width: Math.max(18, context.measureText(event.title).width + 18), height: 18, event, layer });
    } else {
      const boxWidth = Math.max(3, x2 - x);
      roundRect(context, x, rowY, boxWidth, this.metrics.rowHeight, 5);
      context.fill();
      context.stroke();
      context.setLineDash([]);
      if (layer.role === 'background') {
        context.strokeStyle = 'rgba(255,255,255,.22)';
        context.beginPath();
        for (let hatch = x + 6; hatch < x + boxWidth; hatch += 12) {
          context.moveTo(hatch, rowY + this.metrics.rowHeight);
          context.lineTo(Math.min(hatch + 8, x + boxWidth), rowY);
        }
        context.stroke();
      }
      context.globalAlpha = matched ? 1 : 0.28;
      context.fillStyle = '#f5f8fc';
      context.font = layer.role === 'primary' ? '600 12px system-ui' : '12px system-ui';
      context.fillText(event.title, x + 6, rowY + 16, Math.max(0, boxWidth - 12));
      if (options.recordHits) this.hits.push({ x, y: rowY, width: Math.max(boxWidth, 12), height: this.metrics.rowHeight, event, layer });
    }
    context.restore();
  }

  _drawAggregate(context, item, layer, y, width, labelWidth, maxCount, options) {
    const span = this.workspace.view.end - this.workspace.view.start;
    const plotWidth = width - labelWidth - this.metrics.right;
    const x = labelWidth + (item.start - this.workspace.view.start) / span * plotWidth;
    const x2 = labelWidth + (item.end - this.workspace.view.start) / span * plotWidth;
    const height = Math.max(5, item.count / Math.max(1, maxCount) * this.metrics.rowHeight);
    context.fillStyle = colorWithAlpha(layer.color, ROLE_ALPHA[layer.role] || 0.65);
    context.fillRect(x, y + this.metrics.rowHeight - height, Math.max(2, x2 - x - 1), height);
    if (item.kind === 'representative') {
      context.fillStyle = '#d9e4f4';
      context.font = '11px system-ui';
      context.fillText(`${item.event.title}${item.omitted ? ` +${item.omitted}` : ''}`, x + 3, y + 15, Math.max(0, x2 - x - 5));
    }
    if (options.recordHits) this.hits.push({ x, y, width: Math.max(8, x2 - x), height: this.metrics.rowHeight, event: item.event, events: item.events, layer, aggregate: true });
  }

  _render(context, width, height, dpr, recordHits = false) {
    const workspace = this.workspace;
    const resolution = resolveLodLayers(workspace, workspace.view);
    const mobile = width <= 720;
    const labelWidth = mobile ? 88 : 132;
    this.metrics.labelWidth = labelWidth;
    if (recordHits) {
      this.hits = [];
      this.layerHits = [];
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#090c12';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#0e131c';
    context.fillRect(0, 0, labelWidth, height);
    context.strokeStyle = '#263144';
    context.beginPath();
    context.moveTo(labelWidth + 0.5, 0);
    context.lineTo(labelWidth + 0.5, height);
    context.stroke();
    this._drawAxis(context, width, labelWidth, workspace.view);

    const density = new Map();
    let y = this.metrics.top + 6;
    for (const layer of resolution.layers) {
      let events = layer.events.filter((event) => event.end >= workspace.view.start && event.start <= workspace.view.end);
      if (workspace.search?.onlyMatches && this.search) events = events.filter((event) => this.search.matchIds.has(event.id));
      const aggregation = aggregateEvents(events, workspace.view, width - labelWidth - this.metrics.right);
      density.set(layer.id, aggregation.mode);
      const layout = layoutLanes(events, workspace.pointDisplayMode);
      const laneCount = aggregation.mode === 'full' ? Math.min(6, Math.max(1, layout.count)) : 1;
      const layerHeight = laneCount * (this.metrics.rowHeight + this.metrics.laneGap) + 8;
      const group = workspace.groups.find((entry) => entry.id === layer.groupId);
      const isDimmed = layer.dimmed || group?.dimmed;
      const originalDimmed = layer.dimmed;
      layer.dimmed = isDimmed;
      context.fillStyle = 'rgba(255,255,255,.018)';
      context.fillRect(labelWidth, y - 4, width - labelWidth, layerHeight + 7);
      context.fillStyle = '#d4deec';
      context.font = layer.role === 'primary' ? '600 12px system-ui' : '12px system-ui';
      context.fillText(layer.name, 28, y + 14, labelWidth - 34);
      context.fillStyle = colorWithAlpha(layer.color, 0.9);
      context.beginPath();
      context.arc(15, y + 10, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#08101b';
      context.font = '700 9px system-ui';
      context.textAlign = 'center';
      context.fillText(ROLE_LABELS[layer.role] || '层', 15, y + 13);
      context.textAlign = 'left';
      context.fillStyle = '#72829a';
      context.font = '10px system-ui';
      context.fillText(layer.lod?.level || aggregation.mode, 28, y + 27, labelWidth - 34);
      if (recordHits) this.layerHits.push({ x: 0, y: y - 4, width: labelWidth, height: layerHeight + 7, layer });
      if (aggregation.mode === 'full') {
        for (const event of events) this._drawEvent(context, { event }, layer, y, Math.min(5, layout.lanes.get(event.id) || 0), width, labelWidth, { recordHits });
      } else {
        const maxCount = Math.max(...aggregation.items.map((item) => item.count), 1);
        for (const item of aggregation.items) this._drawAggregate(context, item, layer, y, width, labelWidth, maxCount, { recordHits });
      }
      layer.dimmed = originalDimmed;
      y += layerHeight + this.metrics.layerGap;
    }

    for (let index = 0; index < workspace.probes.length; index += 1) {
      const probe = workspace.probes[index];
      const x = labelWidth + (probe.time - workspace.view.start) / (workspace.view.end - workspace.view.start) * (width - labelWidth - this.metrics.right);
      if (x < labelWidth || x > width - this.metrics.right) continue;
      context.strokeStyle = index ? 'rgba(244,179,61,.82)' : 'rgba(90,180,255,.86)';
      context.lineWidth = 1.5;
      context.setLineDash([6, 4]);
      context.beginPath();
      context.moveTo(x, this.metrics.top - 18);
      context.lineTo(x, height);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = index ? '#f4b33d' : '#5ab4ff';
      roundRect(context, x - 12, 4, 24, 20, 5);
      context.fill();
      context.fillStyle = '#07101b';
      context.font = '700 11px system-ui';
      context.textAlign = 'center';
      context.fillText(index ? 'B' : 'A', x, 18);
      context.textAlign = 'left';
    }

    this.lastRenderInfo = { layers: resolution.layers, statuses: resolution.statuses, density };
    this.options.onRender?.(this.lastRenderInfo);
  }

  exportCanvas(scale = 2) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const safeScale = Math.min(scale, 16000 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * safeScale);
    canvas.height = Math.round(height * safeScale);
    this._render(canvas.getContext('2d'), width, height, safeScale, false);
    return canvas;
  }

  tooltipText(hit) {
    if (!hit?.event) return '';
    return `${hit.event.title}\n${formatTimeRange(hit.event)}\n${hit.layer.name}${hit.aggregate ? '\n当前为聚合/代表显示' : ''}`;
  }
}

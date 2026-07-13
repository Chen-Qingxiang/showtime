import { getWorkspaceBounds } from './project.js';

export class Minimap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.workspace = null;
    this.options = options;
    this.drag = null;
    this.bind();
  }

  setWorkspace(workspace) {
    this.workspace = workspace;
    this.draw();
  }

  bounds() {
    return this.workspace ? getWorkspaceBounds(this.workspace, { includeHidden: true }) : null;
  }

  timeAt(x) {
    const bounds = this.bounds();
    if (!bounds) return 0;
    return bounds.start + Math.max(0, Math.min(1, x / this.canvas.clientWidth)) * (bounds.end - bounds.start || 1);
  }

  xAt(time) {
    const bounds = this.bounds();
    if (!bounds) return 0;
    return (time - bounds.start) / (bounds.end - bounds.start || 1) * this.canvas.clientWidth;
  }

  bind() {
    const point = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      return source.clientX - rect.left;
    };
    const start = (event) => {
      if (!this.workspace || !this.bounds()) return;
      event.preventDefault();
      const x = point(event);
      const left = this.xAt(this.workspace.view.start);
      const right = this.xAt(this.workspace.view.end);
      const edge = 10;
      const mode = Math.abs(x - left) <= edge ? 'left' : Math.abs(x - right) <= edge ? 'right' : x >= left && x <= right ? 'move' : 'center';
      this.drag = { mode, startX: x, startView: { ...this.workspace.view } };
      if (mode === 'center') this.updateFromDrag(x);
    };
    const move = (event) => {
      if (!this.drag) return;
      event.preventDefault();
      this.updateFromDrag(point(event));
    };
    const end = () => { this.drag = null; };
    this.canvas.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
  }

  updateFromDrag(x) {
    const bounds = this.bounds();
    if (!bounds || !this.drag) return;
    const time = this.timeAt(x);
    let view = { ...this.drag.startView };
    if (this.drag.mode === 'left') view.start = Math.min(time, view.end - Number.EPSILON);
    else if (this.drag.mode === 'right') view.end = Math.max(time, view.start + Number.EPSILON);
    else {
      const span = view.end - view.start;
      const delta = this.timeAt(x) - this.timeAt(this.drag.startX);
      view = { start: view.start + delta, end: view.end + delta };
      if (this.drag.mode === 'center') view = { start: time - span / 2, end: time + span / 2 };
    }
    this.options.onChange?.(view);
  }

  draw() {
    if (!this.workspace || !this.context) return;
    const width = this.canvas.clientWidth || 600;
    const height = this.canvas.clientHeight || 54;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    const context = this.context;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#0a0e15';
    context.fillRect(0, 0, width, height);
    const bounds = this.bounds();
    if (!bounds) return;
    const bins = new Uint16Array(Math.max(1, Math.floor(width)));
    for (const layer of this.workspace.layers) for (const event of layer.events) {
      const x = Math.max(0, Math.min(bins.length - 1, Math.floor(this.xAt((event.start + event.end) / 2))));
      bins[x] += 1;
    }
    const max = Math.max(...bins, 1);
    context.fillStyle = 'rgba(88,153,224,.52)';
    bins.forEach((count, index) => {
      if (count) context.fillRect(index, height - count / max * (height - 8), 1, count / max * (height - 8));
    });
    const left = this.xAt(this.workspace.view.start);
    const right = this.xAt(this.workspace.view.end);
    context.fillStyle = 'rgba(72,156,255,.14)';
    context.fillRect(left, 0, Math.max(4, right - left), height);
    context.strokeStyle = '#62adff';
    context.lineWidth = 2;
    context.strokeRect(left + 1, 1, Math.max(2, right - left - 2), height - 2);
    context.fillStyle = '#8ac4ff';
    context.fillRect(left - 2, height / 2 - 9, 4, 18);
    context.fillRect(right - 2, height / 2 - 9, 4, 18);
  }
}

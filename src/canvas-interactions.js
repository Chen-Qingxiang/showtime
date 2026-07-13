function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function bindTimelineInteractions(renderer, options = {}) {
  const canvas = renderer.canvas;
  const pointers = new Map();
  let gesture = null;
  let queuedView = null;
  let frame = 0;

  const commitView = (view, reason = 'view') => {
    queuedView = { view, reason };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const next = queuedView;
      queuedView = null;
      options.onViewChange?.(next.view, next.reason);
    });
  };

  const localPoint = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const zoomAt = (x, factor, reason = 'zoom') => {
    const workspace = renderer.workspace;
    const view = workspace.view;
    const minimum = 1 / (366 * 24 * 60 * 60);
    const maximum = 1e12;
    const span = clamp((view.end - view.start) * factor, minimum, maximum);
    const ratio = clamp((x - renderer.metrics.labelWidth) / Math.max(1, canvas.clientWidth - renderer.metrics.labelWidth - renderer.metrics.right), 0, 1);
    const pivot = view.start + ratio * (view.end - view.start);
    commitView({ start: pivot - ratio * span, end: pivot + (1 - ratio) * span }, reason);
  };

  canvas.addEventListener('wheel', (event) => {
    if (localPoint(event).x < renderer.metrics.labelWidth) return;
    event.preventDefault();
    const speed = event.ctrlKey || event.metaKey ? 0.0035 : 0.0015;
    zoomAt(localPoint(event).x, Math.exp(event.deltaY * speed));
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    const point = localPoint(event);
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture?.(event.pointerId);
    options.onTooltip?.(null, event);
    if (pointers.size === 1) {
      gesture = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        startView: { ...renderer.workspace.view },
        startScroll: canvas.parentElement?.scrollTop || 0,
        moved: false,
        mode: null,
        shiftKey: event.shiftKey,
      };
    } else if (pointers.size === 2) {
      const values = [...pointers.values()];
      const distance = Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y);
      const centerX = (values[0].x + values[1].x) / 2;
      gesture = {
        mode: 'pinch',
        startDistance: Math.max(1, distance),
        startCenterX: centerX,
        startView: { ...renderer.workspace.view },
      };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = localPoint(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, point);
    if (gesture?.mode === 'pinch' && pointers.size >= 2) {
      event.preventDefault();
      const values = [...pointers.values()];
      const distance = Math.max(1, Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y));
      const centerX = (values[0].x + values[1].x) / 2;
      const factor = gesture.startDistance / distance;
      const startSpan = gesture.startView.end - gesture.startView.start;
      const span = clamp(startSpan * factor, 1 / (366 * 24 * 60 * 60), 1e12);
      const ratio = clamp((gesture.startCenterX - renderer.metrics.labelWidth) / Math.max(1, canvas.clientWidth - renderer.metrics.labelWidth - renderer.metrics.right), 0, 1);
      const pivot = gesture.startView.start + ratio * startSpan;
      const centerDeltaRatio = (centerX - gesture.startCenterX) / Math.max(1, canvas.clientWidth - renderer.metrics.labelWidth - renderer.metrics.right);
      commitView({ start: pivot - ratio * span - centerDeltaRatio * span, end: pivot + (1 - ratio) * span - centerDeltaRatio * span }, 'pinch');
      return;
    }
    if (gesture && gesture.pointerId === event.pointerId && pointers.size === 1) {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (!gesture.mode && Math.hypot(dx, dy) > 6) {
        gesture.mode = Math.abs(dy) > Math.abs(dx) * 1.35 ? 'vertical' : 'horizontal';
        gesture.moved = true;
        canvas.classList.add('dragging');
      }
      if (gesture.mode === 'vertical') {
        if (canvas.parentElement) canvas.parentElement.scrollTop = gesture.startScroll - dy;
      } else if (gesture.mode === 'horizontal' && point.x >= renderer.metrics.labelWidth) {
        const span = gesture.startView.end - gesture.startView.start;
        const delta = -dx / Math.max(1, canvas.clientWidth - renderer.metrics.labelWidth - renderer.metrics.right) * span;
        commitView({ start: gesture.startView.start + delta, end: gesture.startView.end + delta }, 'pan');
      }
      gesture.last = point;
      return;
    }
    if (!pointers.size) options.onTooltip?.(renderer.hitTest(point.x, point.y), event);
  });

  const finishPointer = (event) => {
    const point = localPoint(event);
    const wasGesture = gesture;
    pointers.delete(event.pointerId);
    canvas.classList.remove('dragging');
    if (pointers.size === 1) {
      const remaining = [...pointers.entries()][0];
      gesture = {
        pointerId: remaining[0], start: remaining[1], last: remaining[1],
        startView: { ...renderer.workspace.view }, startScroll: canvas.parentElement?.scrollTop || 0, moved: true, mode: null,
      };
      return;
    }
    gesture = null;
    if (!wasGesture || wasGesture.mode === 'pinch' || wasGesture.moved || wasGesture.pointerId !== event.pointerId) return;
    if (point.x < renderer.metrics.labelWidth) {
      const layer = renderer.layerAt(point.x, point.y);
      if (layer) options.onLayer?.(layer, event);
      return;
    }
    const hit = renderer.hitTest(point.x, point.y);
    const time = hit?.event && Math.abs(hit.event.end - hit.event.start) < 1e-12 ? hit.event.start : renderer.timeAt(point.x);
    if (hit?.event) options.onSelect?.(hit.event, hit.layer, event);
    options.onProbe?.(time, { second: event.shiftKey || wasGesture.shiftKey, event: hit?.event || null });
  };
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', (event) => {
    pointers.delete(event.pointerId);
    gesture = null;
    canvas.classList.remove('dragging');
  });
  canvas.addEventListener('pointerleave', (event) => {
    if (!pointers.size) options.onTooltip?.(null, event);
  });
  canvas.addEventListener('dblclick', (event) => {
    event.preventDefault();
    options.onReset?.();
  });
  canvas.addEventListener('contextmenu', (event) => {
    const point = localPoint(event);
    const layer = renderer.layerAt(point.x, point.y);
    if (!layer) return;
    event.preventDefault();
    options.onLayerContext?.(layer, event);
  });
  canvas.addEventListener('keydown', (event) => {
    const view = renderer.workspace.view;
    const span = view.end - view.start;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = span * (event.shiftKey ? 0.5 : 0.1) * (event.key === 'ArrowLeft' ? -1 : 1);
      commitView({ start: view.start + delta, end: view.end + delta }, 'keyboard-pan');
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault(); zoomAt(canvas.clientWidth / 2, 0.75, 'keyboard-zoom');
    } else if (event.key === '-') {
      event.preventDefault(); zoomAt(canvas.clientWidth / 2, 1.33, 'keyboard-zoom');
    } else if (event.key === 'Enter') {
      event.preventDefault(); options.onProbe?.((view.start + view.end) / 2, { second: event.shiftKey });
    }
  });

  return { zoomAt };
}

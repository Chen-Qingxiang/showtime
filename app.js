const DEFAULT_CSV_SAMPLE = `# time,title（两列；layer 由文件名决定，左侧文本默认层名“文本”）
# 约定：范围用 ~ 分隔；可用负数表示 BCE（例 -2070~-1600）
# 若无结束（例如 1949~），将自动以“当前年”代替
-2070~-1600,夏
-1600~-1046,商
-1046~-256,周
-221~-207,秦
-202~8,西汉
9~23,新
25~220,东汉
220~266,魏
221~263,蜀汉
222~280,吴
266~316,西晋
317~420,东晋
420~589,南北朝
581~618,隋
618~907,唐
690~705,武周
907~960,五代
907~979,十国
916~1125,辽
960~1127,北宋
1127~1279,南宋
1038~1227,西夏
1115~1234,金
1271~1368,元
1368~1644,明
1636~1912,清
1912~1949,中华民国（大陆时期）
1949~,中华人民共和国`;

(() => {
  // ===================== 常量与共享状态 =====================
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_PX_PER_YEAR = 0.01;
  const MAX_PX_PER_YEAR = 1000;
  const DEFAULT_LAYER_NAME = '默认';
  const TEXT_LAYER_NAME = '文本';

  const ui = {};
  let ctx = null;
  let DPR = window.devicePixelRatio || 1;

  const state = {
    pxPerYear: 2,
    viewStart: -2100,
    laneHeight: 26,
    laneGap: 6,
    layerGap: 18,
    topPad: 40,
    leftPad: 80,
    rightPad: 20,
    data: [],
    byLayer: new Map(),
    layout: new Map(),
    layerOrder: [],
    layers: [],
    layerRects: new Map(),
    drag: { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 },
  };

  const pointer = { isPanning: false, lastX: 0, lastY: 0 };
  let menuLayer = null;

  // ===================== 初始化流程 =====================
  function init() {
    if (!cacheDomHandles()) {
      console.error('[Timeline] DOM 元素未找到，无法初始化组件。');
      return;
    }
    ctx = ui.canvas.getContext('2d');
    if (!ctx) {
      console.error('[Timeline] Canvas 2D 上下文获取失败。');
      return;
    }
    if (ui.csvText) ui.csvText.value = DEFAULT_CSV_SAMPLE;
    bindCanvasInteractions();
    bindUIActions();
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    loadCsvTextarea();
    runSelfTests();
  }

  // ===================== 时间解析工具 =====================
  function parseYearToken(token) {
    if (token == null) return null;
    let s = String(token).trim();
    if (!s) return null;
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    const upper = s.toUpperCase();

    let m = upper.match(/^(\d+)\s*(BC|BCE)$/i);
    if (m) {
      const y = parseInt(m[1], 10);
      return -(y - 1);
    }
    m = s.match(/^(?:公元)?前\s*(\d+)/i);
    if (m) {
      const y = parseInt(m[1], 10);
      return -(y - 1);
    }
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return null;
  }

  function parseTimeField(field) {
    let s = String(field).trim();
    if (!s) return null;
    const yearToken = '(?:-?\\d+|\\d+\\s*(?:BC|BCE)|(?:公元)?前\\s*\\d+)';
    const re = new RegExp('^\\s*(' + yearToken + ')\\s*(?:~|–|—|－|-|〜|～|至|到)\\s*(' + yearToken + ')?\\s*$', 'i');
    const m = s.match(re);
    if (m) {
      const start = parseYearToken(m[1]);
      let end = parseYearToken(m[2]);
      if (start == null) return null;
      if (end == null) end = CURRENT_YEAR;
      return start <= end ? { start, end } : { start: end, end: start };
    }
    const y = parseYearToken(s);
    if (y == null) return null;
    return { start: y, end: y };
  }

  function fmtYearForAxis(y) {
    return y < 0 ? `${-y} BC` : `${y}`;
  }

  // ===================== CSV / 数据处理 =====================
  function parseCSV(text, layerName = DEFAULT_LAYER_NAME) {
    let t = text || '';
    if (t && t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    const lines = t.split(/\r?\n/);
    const rows = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(',');
      const time = (parts[0] ?? '').trim();
      const title = (parts[1] ?? '').trim();
      rows.push({ time, title, layer: layerName });
    }
    return rows;
  }

  function rowsToEvents(rows) {
    const out = [];
    for (const r of rows) {
      const range = parseTimeField(r.time);
      if (!range) continue;
      out.push({
        id: Math.random().toString(36).slice(2),
        title: r.title || '(未命名)',
        start: range.start,
        end: range.end,
        layer: r.layer || DEFAULT_LAYER_NAME,
      });
    }
    return out;
  }

  function groupBy(arr, keyFn) {
    const m = new Map();
    for (const item of arr) {
      const key = keyFn(item);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(item);
    }
    return m;
  }

  function layoutLanes(events) {
    const evs = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
    const lanes = [];
    for (const e of evs) {
      let idx = lanes.findIndex((x) => x <= e.start);
      if (idx === -1) {
        idx = lanes.length;
        lanes.push(e.end);
      } else {
        lanes[idx] = e.end;
      }
      e.__lane = idx;
    }
    return { laneCount: lanes.length };
  }

  // ===================== 渲染相关 =====================
  function getLayerHeight(layer) {
    const { laneCount } = state.layout.get(layer) || { laneCount: 0 };
    return laneCount * (state.laneHeight + state.laneGap) + 6;
  }

  function resizeCanvas() {
    const rect = ui.canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    ui.canvas.width = Math.floor(rect.width * DPR);
    ui.canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw();
  }

  function yearToX(year) {
    return state.leftPad + (year - state.viewStart) * state.pxPerYear;
  }

  function xToYear(x) {
    return state.viewStart + (x - state.leftPad) / state.pxPerYear;
  }

  function pickColorForLayer(layer) {
    let h = 0;
    for (let i = 0; i < layer.length; i++) h = (h * 131 + layer.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 60% 55% / 0.85)`;
  }

  function drawSingleLayer(layer, layerTop, options = {}) {
    const w = ui.canvas.clientWidth;
    const events = state.byLayer.get(layer) || [];
    const { laneCount } = state.layout.get(layer) || { laneCount: 0 };
    const layerHeight = getLayerHeight(layer);
    const color = pickColorForLayer(layer);
    const ghost = options.ghost || false;
    const alpha = options.alpha ?? 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ghost ? '#0b1523' : '#0e131b';
    ctx.fillRect(state.leftPad, layerTop, w - state.leftPad - state.rightPad, layerHeight);

    ctx.fillStyle = ghost ? '#84b6ff' : '#6c7f99';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(layer, state.leftPad - 10, layerTop + 2);

    for (const e of events) {
      const evTop = layerTop + 3 + e.__lane * (state.laneHeight + state.laneGap);
      const x1 = yearToX(e.start);
      const x2 = yearToX(e.end);
      const isPoint = e.start === e.end;

      if (x2 < 0 || x1 > w) continue;

      if (isPoint) {
        const cx = clamp(x1, state.leftPad, w - state.rightPad);
        const cy = evTop + (state.laneHeight - 2) / 2;
        const radius = Math.min(6, (state.laneHeight - 2) / 2);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.2, radius * 0.45);
        ctx.strokeStyle = 'rgba(8, 12, 18, 0.85)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0.5, radius - 0.8), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(0.8, radius * 0.35);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = `${e.title}  ${displayRange(e.start, e.end)}`;
        const textX = cx + radius + 8;
        ctx.fillText(label, textX, cy);
        continue;
      }

      const rx = Math.max(x1, state.leftPad);
      const rw = Math.min(x2, w - state.rightPad) - rx;
      if (rw <= 1) continue;

      ctx.fillStyle = color;
      const r = 6;
      roundRect(ctx, rx, evTop, rw, state.laneHeight - 2, r);
      ctx.fill();

      if (rw > 40) {
        ctx.save();
        ctx.beginPath();
        roundRect(ctx, rx, evTop, rw, state.laneHeight - 2, r);
        ctx.clip();
        ctx.fillStyle = 'white';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = `${e.title}  ${displayRange(e.start, e.end)}`;
        ctx.fillText(label, rx + 10, evTop + (state.laneHeight - 2) / 2);
        ctx.restore();
      }
    }

    if (ghost) {
      ctx.strokeStyle = '#5fa8ff';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(state.leftPad, layerTop, w - state.leftPad - state.rightPad, layerHeight);
    }

    ctx.restore();
  }

  function chooseTickStep(pxPerYear) {
    const target = 110 / pxPerYear;
    const bases = [1, 2, 5];
    let p = 1;
    while (true) {
      for (const b of bases) {
        const step = b * p;
        if (step >= target) return step;
      }
      p *= 10;
    }
  }

  function drawAxis(width) {
    const y = state.topPad - 8;
    ctx.strokeStyle = '#2b3546';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    const step = chooseTickStep(state.pxPerYear);
    const startYear = Math.floor(xToYear(0) / step) * step;
    const endYear = Math.ceil(xToYear(width) / step) * step;

    ctx.fillStyle = '#9fb1c9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px system-ui, sans-serif';

    for (let yv = startYear; yv <= endYear; yv += step) {
      const xx = yearToX(yv);
      ctx.strokeStyle = '#253045';
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y - 6);
      ctx.stroke();
      ctx.fillText(fmtYearForAxis(yv), xx, y - 8);
    }
  }

  function draw() {
    const w = ui.canvas.clientWidth;
    const h = ui.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0a0d12');
    grd.addColorStop(1, '#0a0c10');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    drawAxis(w);

    state.layerRects.clear();
    const boxes = [];
    let yCursor = state.topPad;
    for (const layer of state.layerOrder) {
      const height = getLayerHeight(layer);
      boxes.push({ layer, top: yCursor, height });
      state.layerRects.set(layer, { top: yCursor, height });
      yCursor += height + state.layerGap;
    }

    if (state.drag.active && state.drag.layer) {
      const dragged = state.drag.layer;
      const others = boxes.filter((b) => b.layer !== dragged);

      for (const b of others) drawSingleLayer(b.layer, b.top);

      const center = state.drag.overlayY + getLayerHeight(dragged) / 2;
      let idx = 0;
      for (const b of others) {
        const mid = b.top + b.height / 2;
        if (center > mid) idx++;
      }
      state.drag.targetIndex = idx;

      let lineY = state.topPad;
      if (others.length > 0) {
        if (idx === 0) lineY = others[0].top - state.layerGap / 2;
        else if (idx >= others.length) {
          const last = others[others.length - 1];
          lineY = last.top + last.height + state.layerGap / 2;
        } else {
          lineY = others[idx].top - state.layerGap / 2;
        }
      }
      ctx.save();
      ctx.strokeStyle = '#5fa8ff';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(w, lineY);
      ctx.stroke();
      ctx.restore();

      drawSingleLayer(dragged, state.drag.overlayY, { ghost: true, alpha: 0.95 });
    } else {
      for (const b of boxes) drawSingleLayer(b.layer, b.top);
    }
  }

  function displayRange(a, b) {
    const A = a < 0 ? `${-a}BC` : `${a}`;
    const B = b < 0 ? `${-b}BC` : `${b}`;
    return `${A}~${B}`;
  }

  function roundRect(context, x, y, w, h, r) {
    const rr = Math.min(r, h / 2, w / 2);
    context.beginPath();
    context.moveTo(x + rr, y);
    context.arcTo(x + w, y, x + w, y + h, rr);
    context.arcTo(x + w, y + h, x, y + h, rr);
    context.arcTo(x, y + h, x, y, rr);
    context.arcTo(x, y, x + w, y, rr);
    context.closePath();
  }

  // ===================== 交互：缩放、拖拽、菜单 =====================
  function cacheDomHandles() {
    ui.canvas = document.getElementById('c');
    ui.fileInput = document.getElementById('file');
    ui.loadButton = document.getElementById('btn-load');
    ui.resetButton = document.getElementById('btn-reset');
    ui.zoomSlider = document.getElementById('zoomSlider');
    ui.csvText = document.getElementById('csvText');
    ui.toast = document.getElementById('toast');
    ui.testBadge = document.getElementById('testBadge');
    ui.testPanel = document.getElementById('testPanel');
    ui.testLog = document.getElementById('testLog');
    ui.layerMenu = document.getElementById('layerMenu');
    ui.layerMenuDelete = document.getElementById('menuDelete');
    ui.layerMenuCancel = document.getElementById('menuCancel');
    return !!ui.canvas;
  }

  function bindCanvasInteractions() {
    ui.canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    ui.canvas.addEventListener('mouseleave', handleMouseLeave);
    ui.canvas.addEventListener('wheel', handleWheel, { passive: false });
    ui.canvas.addEventListener('dblclick', resetView);
    ui.canvas.addEventListener('contextmenu', handleContextMenu);

    ui.layerMenuDelete?.addEventListener('click', handleMenuDelete);
    ui.layerMenuCancel?.addEventListener('click', hideLayerMenu);
    window.addEventListener('click', (e) => {
      if (ui.layerMenu && !ui.layerMenu.contains(e.target)) hideLayerMenu();
    });
    ui.layerMenu?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideLayerMenu();
    });
  }

  function handleMouseDown(e) {
    hideLayerMenu();
    const rect = ui.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < state.leftPad) {
      for (const [layer, box] of state.layerRects) {
        if (y >= box.top && y <= box.top + box.height) {
          state.drag.active = true;
          state.drag.layer = layer;
          state.drag.grabDy = y - box.top;
          state.drag.mouseY = y;
          state.drag.overlayY = box.top;
          ui.canvas.style.cursor = 'grabbing';
          draw();
          return;
        }
      }
    }
    pointer.isPanning = true;
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    ui.canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e) {
    const rect = ui.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (state.drag.active && state.drag.layer) {
      state.drag.mouseY = y;
      state.drag.overlayY = y - state.drag.grabDy;
      draw();
      return;
    }
    if (pointer.isPanning) {
      const dx = e.clientX - pointer.lastX;
      pointer.lastX = e.clientX;
      pointer.lastY = e.clientY;
      state.viewStart -= dx / state.pxPerYear;
      draw();
      return;
    }
    if (x < state.leftPad) {
      for (const [layer, box] of state.layerRects) {
        if (y >= box.top && y <= box.top + box.height) {
          ui.canvas.style.cursor = 'grab';
          return;
        }
      }
    }
    ui.canvas.style.cursor = 'default';
  }

  function handleMouseUp() {
    ui.canvas.style.cursor = 'default';
    pointer.isPanning = false;
    if (state.drag.active && state.drag.layer) {
      const layer = state.drag.layer;
      const currentIndex = state.layerOrder.indexOf(layer);
      const order = state.layerOrder.slice();
      order.splice(currentIndex, 1);
      let target = state.drag.targetIndex;
      if (target > order.length) target = order.length;
      if (target < 0) target = 0;
      order.splice(target, 0, layer);
      state.layerOrder = order;
      state.layers = state.layerOrder.slice();
      state.drag = { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 };
      draw();
    }
  }

  function handleMouseLeave() {
    pointer.isPanning = false;
    ui.canvas.style.cursor = 'default';
    if (state.drag.active) {
      state.drag = { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 };
      draw();
    }
  }

  function handleWheel(e) {
    e.preventDefault();
    const rect = ui.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const centerX = rect.width / 2;
    const pivotX = e.shiftKey ? centerX : mx;
    const speed = e.ctrlKey || e.metaKey ? 4 : 1;
    const factor = Math.pow(1.0015, -e.deltaY * speed);
    applyZoom(pivotX, factor);
  }

  function handleContextMenu(e) {
    const rect = ui.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= state.leftPad) return;
    for (const [layer, box] of state.layerRects) {
      if (y >= box.top && y <= box.top + box.height) {
        e.preventDefault();
        showLayerMenu(e.clientX, e.clientY, layer);
        return;
      }
    }
  }

  function showLayerMenu(x, y, layer) {
    if (!ui.layerMenu) return;
    menuLayer = layer;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = { w: 196, h: 96 };
    const left = Math.min(x, vw - rect.w - pad);
    const top = Math.min(y, vh - rect.h - pad);
    ui.layerMenu.style.left = `${left}px`;
    ui.layerMenu.style.top = `${top}px`;
    ui.layerMenu.style.display = 'block';
  }

  function hideLayerMenu() {
    if (!ui.layerMenu) return;
    ui.layerMenu.style.display = 'none';
    menuLayer = null;
  }

  function handleMenuDelete(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!menuLayer) {
      hideLayerMenu();
      return;
    }
    const target = menuLayer;
    const ok = confirm(`确认删除图层 “${target}” 吗？\n（该层包含的事件也会被移除）`);
    hideLayerMenu();
    if (ok) {
      const removed = deleteLayer(target);
      toast(removed ? `已删除图层：${target}` : `未找到图层：${target}`);
    }
  }

  // ===================== 数据状态更新 =====================
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function applyZoom(pivotX, k) {
    const yearAtPivot = xToYear(pivotX);
    const newPx = clamp(state.pxPerYear * k, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    state.pxPerYear = newPx;
    state.viewStart = yearAtPivot - (pivotX - state.leftPad) / newPx;
    syncSlider();
    draw();
  }

  function rebuildFromState() {
    state.byLayer = groupBy(state.data, (e) => e.layer || DEFAULT_LAYER_NAME);
    const present = Array.from(state.byLayer.keys());
    if (!state.layerOrder.length) {
      state.layerOrder = present.slice();
    } else {
      for (const layer of present) {
        if (!state.layerOrder.includes(layer)) state.layerOrder.push(layer);
      }
      state.layerOrder = state.layerOrder.filter((layer) => present.includes(layer));
    }
    state.layers = state.layerOrder.slice();
    state.layout = new Map();
    for (const layer of state.layerOrder) {
      const arr = state.byLayer.get(layer) || [];
      state.layout.set(layer, layoutLanes(arr));
    }
  }

  function deleteLayer(layer) {
    if (!layer) return false;
    const before = state.data.length;
    state.data = state.data.filter((e) => e.layer !== layer);
    state.layerOrder = state.layerOrder.filter((l) => l !== layer);
    state.layers = state.layerOrder.slice();
    rebuildFromState();
    draw();
    return state.data.length < before;
  }

  function ingest(events) {
    state.data = state.data.concat(events);
    rebuildFromState();
    resetView();
  }

  function resetView() {
    if (!state.data.length) return;
    const minY = Math.min(...state.data.map((e) => e.start));
    const maxY = Math.max(...state.data.map((e) => e.end));
    const w = ui.canvas.clientWidth - state.leftPad - state.rightPad;
    const years = maxY - minY || 10;
    state.pxPerYear = clamp(w / years, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    state.viewStart = minY - 10 / state.pxPerYear;
    syncSlider();
    draw();
  }

  function syncSlider() {
    ui.zoomSlider.min = String(MIN_PX_PER_YEAR);
    ui.zoomSlider.max = String(MAX_PX_PER_YEAR);
    ui.zoomSlider.value = String(state.pxPerYear);
  }

  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      ui.toast.style.display = 'none';
    }, 1500);
  }

  // ===================== UI 行为 =====================
  function bindUIActions() {
    ui.fileInput?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const text = await f.text();
      const layerName = (f.name || '文件').replace(/\.[^.]+$/, '');
      const rows = parseCSV(text, layerName);
      const events = rowsToEvents(rows);
      if (!events.length) {
        alert(
          '未解析到任何事件。\n请检查：\n• CSV 两列 time,title；\n• 区间分隔符可用 ~ / - / — / 至 等；\n• 年份可写 -221 或 221BC / 公元前221。'
        );
        return;
      }
      ingest(events);
      e.target.value = '';
    });

    ui.loadButton?.addEventListener('click', loadCsvTextarea);
    ui.resetButton?.addEventListener('click', resetView);

    ui.zoomSlider?.addEventListener('input', (e) => {
      const w = ui.canvas.getBoundingClientRect().width;
      const centerX = w / 2;
      const yearAtCenter = xToYear(centerX);
      state.pxPerYear = parseFloat(e.target.value);
      state.viewStart = yearAtCenter - (centerX - state.leftPad) / state.pxPerYear;
      draw();
    });
  }

  function loadCsvTextarea() {
    if (!ui.csvText) return;
    const text = ui.csvText.value;
    const rows = parseCSV(text, TEXT_LAYER_NAME);
    const events = rowsToEvents(rows);
    if (!events.length) {
      alert('左侧文本未解析出事件。\n示例：-2070~-1600,夏');
      return;
    }
    ingest(events);
  }

  // ===================== 自测 =====================
  function runSelfTests() {
    const logItems = [];
    function add(name, fn) {
      try {
        const ok = !!fn();
        logItems.push({ name, ok });
      } catch (err) {
        logItems.push({ name, ok: false, err: String(err) });
      }
    }

    add('parseYearToken: -221 → -221', () => parseYearToken(-221) === -221);
    add('parseYearToken: 221BC → -220', () => parseYearToken('221BC') === -220);
    add('parseYearToken: 公元前221 → -220', () => parseYearToken('公元前221') === -220);

    add('parseTimeField: -2070~-1600', () => {
      const r = parseTimeField('-2070~-1600');
      return r.start === -2070 && r.end === -1600;
    });
    add('parseTimeField: 221BC-207BC', () => {
      const r = parseTimeField('221BC-207BC');
      return r.start === -220 && r.end === -206;
    });
    add('parseTimeField: 221BC 至 207BC', () => {
      const r = parseTimeField('221BC 至 207BC');
      return r.start === -220 && r.end === -206;
    });
    add('parseTimeField: single 1054', () => {
      const r = parseTimeField('1054');
      return r.start === 1054 && r.end === 1054;
    });
    add('parseTimeField: single -1 (BCE)', () => {
      const r = parseTimeField('-1');
      return r.start === -1 && r.end === -1;
    });
    add('parseTimeField: open interval 1949~', () => {
      const r = parseTimeField('1949~');
      return r.start === 1949 && r.end === CURRENT_YEAR;
    });

    add('parseCSV: split by \\n', () => parseCSV('1~2,A\n3~4,B', 'L').length === 2);
    add('parseCSV: split by \\r\\n', () => parseCSV('1~2,A\r\n3~4,B', 'L').length === 2);
    add('parseCSV: BOM + \\n', () => parseCSV('\uFEFF1~2,A\n3~4,B', 'L').length === 2);

    add('rowsToEvents: pipeline basic', () => rowsToEvents(parseCSV('1~2,A', 'L')).length === 1);

    add('ingest: append preserves existing layers', () => {
      const backup = snapshotState();
      try {
        const ev1 = rowsToEvents(parseCSV('1~2,A', 'L1'));
        ingest(ev1);
        const ev2 = rowsToEvents(parseCSV('3~4,B', 'L2'));
        ingest(ev2);
        return state.layerOrder.includes('L1') && state.layerOrder.includes('L2');
      } finally {
        restoreState(backup);
      }
    });

    add('layers order respects import sequence', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'Z1')));
        ingest(rowsToEvents(parseCSV('3~4,B', 'A2')));
        const i1 = state.layerOrder.indexOf('Z1');
        const i2 = state.layerOrder.indexOf('A2');
        return i1 > -1 && i2 > -1 && i1 < i2;
      } finally {
        restoreState(backup);
      }
    });

    add('applyZoom: preserves world at pivot', () => {
      const backup = snapshotState();
      try {
        const rect = ui.canvas.getBoundingClientRect();
        const pivotX = state.leftPad + Math.max(50, rect.width * 0.25);
        const before = xToYear(pivotX);
        applyZoom(pivotX, Math.pow(1.0015, -240));
        const after = xToYear(pivotX);
        return Math.abs(after - before) < 1e-6;
      } finally {
        restoreState(backup);
      }
    });

    add('applyZoom: ctrl/cmd speed multiplier is faster', () => {
      const backup = snapshotState();
      try {
        const rect = ui.canvas.getBoundingClientRect();
        const pivotX = state.leftPad + rect.width / 2;
        const px0 = state.pxPerYear;
        applyZoom(pivotX, Math.pow(1.0015, -100));
        const px1 = state.pxPerYear;
        restorePartial(backup);
        applyZoom(pivotX, Math.pow(1.0015, -100 * 4));
        const px2 = state.pxPerYear;
        return Math.abs(px2 - px0) > Math.abs(px1 - px0);
      } finally {
        restoreState(backup);
      }
    });

    add('reorder: move first to last', () => {
      const backupOrder = state.layerOrder.slice();
      state.layerOrder = ['L1', 'L2', 'L3'];
      state.layers = state.layerOrder.slice();
      const curIdx = state.layerOrder.indexOf('L1');
      const order = state.layerOrder.slice();
      order.splice(curIdx, 1);
      order.splice(order.length, 0, 'L1');
      state.layerOrder = order;
      state.layers = state.layerOrder.slice();
      const ok = JSON.stringify(state.layerOrder) === JSON.stringify(['L2', 'L3', 'L1']);
      state.layerOrder = backupOrder;
      state.layers = state.layerOrder.slice();
      return ok;
    });

    add('deleteLayer: removes data and order', () => {
      const backup = snapshotState();
      try {
        state.data = [];
        state.layerOrder = [];
        state.layers = [];
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        ingest(rowsToEvents(parseCSV('3~4,B', 'L2')));
        const hadL1 = state.layerOrder.includes('L1');
        deleteLayer('L1');
        const noL1 =
          !state.layerOrder.includes('L1') && Array.from(state.byLayer.keys()).every((k) => k !== 'L1');
        return hadL1 && noL1 && state.data.every((e) => e.layer !== 'L1');
      } finally {
        restoreState(backup);
      }
    });

    const pass = logItems.filter((t) => t.ok).length;
    const fail = logItems.length - pass;
    const log = logItems
      .map((t) => `${t.ok ? '✅' : '❌'} ${t.name}${t.err ? `\n   ${t.err}` : ''}`)
      .join('\n');
    console.log('[Timeline Self-tests]\n' + log);

    if (ui.testLog) ui.testLog.textContent = log;
    if (ui.testBadge) {
      ui.testBadge.style.display = 'block';
      ui.testBadge.textContent = `自测：${pass}/${logItems.length} 通过${fail ? '（有失败，点我看详情）' : ''}`;
      ui.testBadge.onclick = () => {
        ui.testPanel.style.display = ui.testPanel.style.display === 'none' ? 'block' : 'none';
      };
    }
  }

  function snapshotState() {
    return {
      data: state.data.slice(),
      layerOrder: state.layerOrder.slice(),
      byLayer: new Map(state.byLayer),
      layout: new Map(state.layout),
      pxPerYear: state.pxPerYear,
      viewStart: state.viewStart,
      topPad: state.topPad,
    };
  }

  function restoreState(backup) {
    state.data = backup.data;
    state.layerOrder = backup.layerOrder;
    state.layers = state.layerOrder.slice();
    state.byLayer = backup.byLayer;
    state.layout = backup.layout;
    state.pxPerYear = backup.pxPerYear;
    state.viewStart = backup.viewStart;
    state.topPad = backup.topPad;
    draw();
  }

  function restorePartial(backup) {
    state.pxPerYear = backup.pxPerYear;
    state.viewStart = backup.viewStart;
    draw();
  }

  // ===================== 启动 =====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

import { formatSpan, formatTimeRange, formatTimeValue } from './time.js';
import { compareProbes, probeResults, PROBE_WINDOWS } from './probes.js';

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return String(value).split(/[,，;；]/).map((entry) => entry.trim()).filter(Boolean);
}

function chips(values) {
  const items = list(values);
  return items.length ? `<div class="chip-list">${items.map((value) => `<span class="chip">${escapeHTML(value)}</span>`).join('')}</div>` : '—';
}

export function toast(message, type = '') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  region.appendChild(item);
  setTimeout(() => item.remove(), type === 'error' ? 6000 : 3500);
}

export function switchTab(name) {
  document.querySelectorAll('[data-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === name)));
  document.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
}

export function closeMenus(except = null) {
  document.querySelectorAll('details[open]').forEach((details) => {
    if (details !== except && !details.closest('dialog')) details.open = false;
  });
}

export function renderProjectSummary(workspace) {
  document.getElementById('project-name').textContent = workspace.name;
  document.getElementById('project-description').textContent = workspace.description || '把专题时间线放入更大的历史背景中。';
  document.getElementById('project-topic').textContent = workspace.topic || '未填写主题';
}

function groupMenu(group) {
  return `<details class="context-menu" data-menu-kind="group" data-group-id="${escapeHTML(group.id)}">
    <summary aria-label="${escapeHTML(group.name)}分组操作">⋯</summary>
    <div class="context-menu-popover">
      <button data-action="rename-group" data-group-id="${escapeHTML(group.id)}">重命名分组</button>
      <button data-action="move-group-up" data-group-id="${escapeHTML(group.id)}">上移分组</button>
      <button data-action="move-group-down" data-group-id="${escapeHTML(group.id)}">下移分组</button>
      <button data-action="toggle-group" data-group-id="${escapeHTML(group.id)}">${group.visible === false ? '显示整组' : '隐藏整组'}</button>
      <button data-action="solo-group" data-group-id="${escapeHTML(group.id)}">独显整组</button>
      <button data-action="dim-group" data-group-id="${escapeHTML(group.id)}">${group.dimmed ? '取消调暗' : '调暗整组'}</button>
    </div>
  </details>`;
}

function layerMenu(layer, groups) {
  return `<details class="context-menu" data-menu-kind="layer" data-layer-id="${escapeHTML(layer.id)}">
    <summary aria-label="${escapeHTML(layer.name)}图层操作">⋯</summary>
    <div class="context-menu-popover">
      <button data-action="rename-layer" data-layer-id="${escapeHTML(layer.id)}">重命名图层</button>
      <button data-action="add-event" data-layer-id="${escapeHTML(layer.id)}">新增事件</button>
      <button data-action="toggle-layer" data-layer-id="${escapeHTML(layer.id)}">${layer.visible === false ? '显示图层' : '隐藏图层'}</button>
      <button data-action="solo-layer" data-layer-id="${escapeHTML(layer.id)}">${layer.solo ? '取消独显' : '独显图层'}</button>
      <button data-action="dim-layer" data-layer-id="${escapeHTML(layer.id)}">${layer.dimmed ? '取消调暗' : '调暗图层'}</button>
      <button data-action="move-layer-up" data-layer-id="${escapeHTML(layer.id)}">上移图层</button>
      <button data-action="move-layer-down" data-layer-id="${escapeHTML(layer.id)}">下移图层</button>
      <label>颜色 <input type="color" data-action="layer-color" data-layer-id="${escapeHTML(layer.id)}" value="${/^#[\da-f]{6}$/i.test(layer.color) ? layer.color : '#4da3ff'}"></label>
      <label>角色 <select data-action="layer-role" data-layer-id="${escapeHTML(layer.id)}"><option value="primary"${layer.role === 'primary' ? ' selected' : ''}>primary</option><option value="context"${layer.role === 'context' ? ' selected' : ''}>context</option><option value="anchor"${layer.role === 'anchor' ? ' selected' : ''}>anchor</option><option value="background"${layer.role === 'background' ? ' selected' : ''}>background</option></select></label>
      <label>移动到 <select data-action="layer-group" data-layer-id="${escapeHTML(layer.id)}">${groups.map((group) => `<option value="${escapeHTML(group.id)}"${group.id === layer.groupId ? ' selected' : ''}>${escapeHTML(group.name)}</option>`).join('')}</select></label>
      <button data-action="export-specific-layer" data-layer-id="${escapeHTML(layer.id)}">导出该层 CSV</button>
      <button class="danger" data-action="delete-layer" data-layer-id="${escapeHTML(layer.id)}">删除图层</button>
    </div>
  </details>`;
}

export function renderLayers(workspace, currentLayerId = null) {
  const container = document.getElementById('layer-groups');
  if (!workspace.groups.length) {
    container.innerHTML = '<div class="empty-hint">添加分组后即可整理图层。</div>';
    return;
  }
  container.innerHTML = workspace.groups.map((group) => {
    const layers = workspace.layers.filter((layer) => layer.groupId === group.id);
    return `<section class="layer-group" data-group-id="${escapeHTML(group.id)}" draggable="true">
      <div class="group-header" data-group-drag="${escapeHTML(group.id)}">
        <button class="disclosure" data-action="toggle-group-collapse" data-group-id="${escapeHTML(group.id)}" aria-label="${group.collapsed ? '展开' : '折叠'}${escapeHTML(group.name)}">${group.collapsed ? '▸' : '▾'}</button>
        <span class="group-name">${escapeHTML(group.name)}</span>
        <span class="group-count">${layers.length}</span>
        ${groupMenu(group)}
      </div>
      <div class="group-layers"${group.collapsed ? ' hidden' : ''}>
        ${layers.map((layer) => `<div class="layer-row role-${escapeHTML(layer.role)}${layer.id === currentLayerId ? ' selected' : ''}" data-layer-id="${escapeHTML(layer.id)}" draggable="true" aria-disabled="${layer.visible === false}">
          <button class="visibility-button" data-action="toggle-layer" data-layer-id="${escapeHTML(layer.id)}" aria-label="${layer.visible === false ? '显示' : '隐藏'}${escapeHTML(layer.name)}">${layer.visible === false ? '○' : '●'}</button>
          <span class="layer-swatch" style="background:${escapeHTML(layer.color)}"></span>
          <span class="layer-info"><span class="layer-name">${escapeHTML(layer.name)}</span><span class="layer-role">${escapeHTML(layer.role)}${layer.lod?.level ? ` · ${escapeHTML(layer.lod.level)}` : ''}${layer.solo ? ' · solo' : ''}</span></span>
          ${layerMenu(layer, workspace.groups)}
        </div>`).join('') || '<div class="empty-hint" style="padding:8px">可把图层拖到此分组</div>'}
      </div>
    </section>`;
  }).join('');
  const importGroup = document.getElementById('import-group-select');
  if (importGroup) importGroup.innerHTML = workspace.groups.map((group) => `<option value="${escapeHTML(group.id)}">${escapeHTML(group.name)}</option>`).join('');
}

export function renderViews(workspace) {
  const container = document.getElementById('saved-views');
  if (!workspace.views.length) {
    container.className = 'compact-list empty-hint';
    container.textContent = '尚未保存视图';
    return;
  }
  container.className = 'compact-list';
  container.innerHTML = workspace.views.map((view) => `<div class="compact-item"><button class="text-button" data-action="restore-view" data-view-id="${escapeHTML(view.id)}"><strong>${escapeHTML(view.name)}</strong><span>${escapeHTML(formatTimeValue(view.view?.start ?? 0))} – ${escapeHTML(formatTimeValue(view.view?.end ?? 0))}</span></button><details class="context-menu"><summary aria-label="视图操作">⋯</summary><div class="context-menu-popover"><button data-action="rename-view" data-view-id="${escapeHTML(view.id)}">重命名</button><button class="danger" data-action="delete-view" data-view-id="${escapeHTML(view.id)}">删除</button></div></details></div>`).join('');
}

export function renderRecents(records) {
  const container = document.getElementById('recent-projects');
  if (!records?.length) {
    container.className = 'compact-list empty-hint';
    container.textContent = '没有最近项目';
    return;
  }
  container.className = 'compact-list';
  container.innerHTML = records.slice(0, 8).map((record) => `<button class="compact-item" data-action="open-recent" data-workspace-id="${escapeHTML(record.id)}"><strong>${escapeHTML(record.name)}</strong><span>${record.layerCount} 层 · ${escapeHTML(new Date(record.updatedAt).toLocaleDateString('zh-CN'))}</span></button>`).join('');
}

export function renderEventDetails(workspace, match) {
  const container = document.getElementById('event-details');
  if (!match) {
    container.innerHTML = '<div class="panel-empty"><strong>选择一个事件</strong><span>点击时间轴事件或搜索结果，查看时间、元数据与来源。</span></div>';
    return;
  }
  const { event, layer } = match;
  const group = workspace.groups.find((entry) => entry.id === layer.groupId);
  const metadata = event.metadata || {};
  const sources = metadata.sources || [];
  container.innerHTML = `<div class="eyebrow">${escapeHTML(group?.name || '未分组')} · ${escapeHTML(layer.role)}</div>
    <h2 class="detail-title">${escapeHTML(event.title)}</h2>
    <div class="detail-time">${escapeHTML(event.rawTime)} → ${escapeHTML(formatTimeRange(event, { compact: false }))}</div>
    <div class="detail-actions"><button data-action="focus-event" data-event-id="${escapeHTML(event.id)}">定位并高亮</button><button data-action="edit-event" data-event-id="${escapeHTML(event.id)}">编辑事件</button><button data-action="add-event" data-layer-id="${escapeHTML(layer.id)}">同层新增</button></div>
    <section class="detail-section"><h3>说明</h3><p>${escapeHTML(metadata.description || '暂无详细说明。')}</p></section>
    <section class="detail-section"><h3>研究元数据</h3><dl class="metadata-grid"><dt>图层</dt><dd>${escapeHTML(layer.name)}</dd><dt>地点</dt><dd>${chips(metadata.location || metadata.locations)}</dd><dt>人物</dt><dd>${chips(metadata.people)}</dd><dt>标签</dt><dd>${chips(metadata.tags)}</dd><dt>可信度</dt><dd>${escapeHTML(metadata.certainty || '未注明')}</dd><dt>研究笔记</dt><dd>${escapeHTML(metadata.notes || '—')}</dd></dl></section>
    <section class="detail-section"><h3>来源与外部链接</h3>${sources.length ? sources.map((source) => { const url = safeUrl(source.url); return `<p><strong>${escapeHTML(source.source || '未命名来源')}</strong>${source.page ? ` · p.${escapeHTML(source.page)}` : ''}${url ? ` · <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">打开链接</a>` : ''}${source.quotation ? `<br>“${escapeHTML(source.quotation)}”` : ''}</p>`; }).join('') : '<p>暂无来源记录。可在编辑面板添加。</p>'}${(metadata.externalLinks || []).map((value) => { const url = safeUrl(value); return url ? `<p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a></p>` : ''; }).join('')}</section>`;
}

function resultButton(record) {
  return `<button class="result-item" data-action="focus-event" data-event-id="${escapeHTML(record.event.id)}"><time>${escapeHTML(formatTimeValue(record.event.start, record.event.startPrecision))}</time><span><strong>${escapeHTML(record.event.title)}</strong><small>${escapeHTML(record.layer.name)} · ${escapeHTML(record.group?.name || '')}</small></span></button>`;
}

export function renderSearchResults(result) {
  const container = document.getElementById('search-results');
  if (!result || !result.total) {
    container.innerHTML = '<div class="panel-empty"><strong>没有匹配结果</strong><span>尝试减少关键词、扩大范围或切换搜索作用域。</span></div>';
    return;
  }
  container.innerHTML = `<div class="eyebrow">${result.total} 个结果 · 按时间排序</div>
    ${result.layers.length ? `<section class="result-group"><h3>图层</h3>${result.layers.map((record) => `<button class="result-item" data-action="select-layer" data-layer-id="${escapeHTML(record.layer.id)}"><time>图层</time><span><strong>${escapeHTML(record.layer.name)}</strong><small>${escapeHTML(record.layer.role)}</small></span></button>`).join('')}</section>` : ''}
    <section class="result-group"><h3>事件</h3>${result.events.slice(0, 500).map(resultButton).join('')}${result.events.length > 500 ? '<p class="empty-hint">仅显示前 500 条；继续过滤可缩小范围。</p>' : ''}</section>`;
}

function renderProbeSingle(workspace, probe, index) {
  const result = probeResults(workspace, probe);
  return `<section class="result-group"><div class="probe-header"><strong>探针 ${index ? 'B' : 'A'} · ${escapeHTML(result.label)}</strong><span>${result.total} 个相交事件</span>
    <div class="probe-controls"><label>窗口<select data-action="probe-window" data-probe-id="${escapeHTML(probe.id)}">${Object.entries(PROBE_WINDOWS).map(([value, preset]) => `<option value="${value}"${probe.windowMode === value ? ' selected' : ''}>${preset.label}</option>`).join('')}<option value="custom"${probe.windowMode === 'custom' ? ' selected' : ''}>自定义</option></select></label><label>移动到<input data-action="probe-time" data-probe-id="${escapeHTML(probe.id)}" value="${escapeHTML(String(probe.time))}"></label>${probe.windowMode === 'custom' ? `<label>之前（年）<input type="number" min="0" step="any" data-action="probe-custom-before" data-probe-id="${escapeHTML(probe.id)}" value="${probe.customBefore || 0}"></label><label>之后（年）<input type="number" min="0" step="any" data-action="probe-custom-after" data-probe-id="${escapeHTML(probe.id)}" value="${probe.customAfter || 0}"></label>` : ''}</div>
    <div class="detail-actions"><button data-action="focus-probe" data-probe-id="${escapeHTML(probe.id)}">定位探针</button><button data-action="remove-probe" data-probe-id="${escapeHTML(probe.id)}">取消固定</button></div></div>
    ${result.groups.map((group) => `<div class="detail-section"><h3>${escapeHTML(group.group.name)}</h3>${group.layers.map((layer) => `<div class="result-group"><h3>${escapeHTML(layer.layer.name)}</h3>${layer.events.map((event) => resultButton({ event, layer: layer.layer, group: group.group })).join('')}</div>`).join('')}</div>`).join('')}</section>`;
}

export function renderProbePanel(workspace) {
  const container = document.getElementById('probe-results');
  if (!workspace.probes.length) {
    container.innerHTML = '<div class="panel-empty"><strong>此时发生什么</strong><span>点击时间轴空白或事件固定探针；Shift 点击可比较两个时点。</span></div>';
    return;
  }
  let comparison = '';
  if (workspace.probes.length === 2) {
    const diff = compareProbes(workspace, workspace.probes[0], workspace.probes[1]);
    const categories = [
      ['spansBoth', '跨越两个时点'], ['firstOnly', '只在 A 时存在'], ['secondOnly', '只在 B 时存在'],
      ['startsBetween', '中间开始'], ['endsBetween', '中间结束'],
    ];
    comparison = `<section class="detail-section"><h3>两个时点比较</h3>${categories.map(([key, label]) => `<div class="result-group"><h3>${label} · ${diff[key].length}</h3>${diff[key].slice(0, 80).map(resultButton).join('') || '<span class="empty-hint">无</span>'}</div>`).join('')}</section>`;
  }
  container.innerHTML = `${workspace.probes.map((probe, index) => renderProbeSingle(workspace, probe, index)).join('')}${comparison}`;
}

export function renderQuality(report) {
  const container = document.getElementById('quality-results');
  if (!report) {
    container.innerHTML = '<div class="panel-empty"><strong>尚无质检报告</strong><span>导入 CSV 或项目包后会显示结构化结果。</span></div>';
    return;
  }
  container.innerHTML = `<div class="quality-summary"><div class="metric"><strong>${report.fileCount}</strong><span>文件</span></div><div class="metric"><strong>${report.successfulEvents}</strong><span>成功事件</span></div><div class="metric"><strong>${report.issues.length}</strong><span>问题</span></div></div>
    <div class="detail-actions"><button data-action="export-quality">下载质检报告</button></div>
    <section class="detail-section"><h3>问题与修复建议</h3>${report.issues.slice(0, 300).map((entry) => `<article class="issue ${escapeHTML(entry.severity || '')}"><strong>${escapeHTML(entry.fileName || report.fileName || '')}${entry.line ? `:${entry.line}` : ''} · ${escapeHTML(entry.type)}</strong><span>${escapeHTML(entry.message)}</span><span>建议：${escapeHTML(entry.suggestion || '检查原始数据。')}</span>${entry.raw ? `<code>${escapeHTML(entry.raw)}</code>` : ''}</article>`).join('') || '<p class="empty-hint">没有发现问题。</p>'}</section>`;
}

export function renderStatistics(stats) {
  const container = document.getElementById('analysis-results');
  if (!stats.eventCount) {
    container.innerHTML = '<div class="panel-empty"><strong>没有可统计事件</strong><span>显示至少一个有数据的图层。</span></div>';
    return;
  }
  const max = Math.max(...stats.bins.map((bin) => bin.count), 1);
  const labelsEvery = Math.max(1, Math.ceil(stats.bins.length / 5));
  container.innerHTML = `<div class="eyebrow">事件记录分布</div><div class="quality-summary"><div class="metric"><strong>${stats.eventCount}</strong><span>事件记录</span></div><div class="metric"><strong>${stats.pointCount}</strong><span>点事件</span></div><div class="metric"><strong>${stats.intervalCount}</strong><span>区间事件</span></div></div>
    <section class="detail-section"><h3>时间跨度 · ${escapeHTML(stats.spanLabel)}</h3><div class="histogram">${stats.bins.map((bin, index) => `<button data-action="zoom-bin" data-start="${bin.start}" data-end="${bin.end}" style="height:${Math.max(2, bin.count / max * 100)}%" title="${escapeHTML(bin.label)}：${bin.count}">${index % labelsEvery === 0 ? `<span>${escapeHTML(formatTimeValue(bin.start))}</span>` : ''}</button>`).join('')}</div></section>
    <section class="detail-section"><h3>按图层</h3>${stats.byLayer.map((layer) => `<div class="compact-item"><strong><span class="layer-swatch" style="display:inline-block;background:${escapeHTML(layer.color)}"></span> ${escapeHTML(layer.name)}</strong><span>${layer.count}</span></div>`).join('')}</section>
    ${['people', 'locations', 'tags'].map((key) => stats.facets[key]?.length ? `<section class="detail-section"><h3>${{ people: '人物', locations: '地点', tags: '标签' }[key]}</h3>${stats.facets[key].slice(0, 15).map((entry) => `<div class="compact-item"><strong>${escapeHTML(entry.label)}</strong><span>${entry.count}</span></div>`).join('')}</section>` : '').join('')}
    <p class="form-help">${escapeHTML(stats.disclaimer)}</p>`;
}

export function renderDiff(diff) {
  const container = document.getElementById('analysis-results');
  if (!diff) {
    container.innerHTML = '<div class="panel-empty"><strong>尚未加载 baseline</strong><span>从“分析”菜单加载另一个 CSV 或项目版本。</span></div>';
    return;
  }
  container.innerHTML = `<div class="eyebrow">${escapeHTML(diff.currentName)} ↔ ${escapeHTML(diff.baselineName)}</div>
    <div class="quality-summary"><div class="metric"><strong>${diff.added.length}</strong><span>新增</span></div><div class="metric"><strong>${diff.removed.length}</strong><span>删除</span></div><div class="metric"><strong>${diff.modified.length + diff.possible.length}</strong><span>变化 / 可能</span></div></div>
    <div class="detail-actions"><button data-action="toggle-diff">时间轴高亮</button><button data-action="export-diff">下载差异报告</button></div>
    <section class="detail-section"><h3>差异列表</h3>${diff.all.slice(0, 500).map((entry) => `<article class="diff-item ${escapeHTML(entry.kind)}"${entry.current?.event?.id ? ` data-action="focus-event" data-event-id="${escapeHTML(entry.current.event.id)}"` : ''}><strong>${escapeHTML(entry.current?.event.title || entry.baseline?.event.title || '')}</strong><small>${escapeHTML(entry.kind)} · ${escapeHTML(entry.changes.join('、'))}${entry.confidence === 'possible' ? ' · 可能匹配，需人工确认' : ''}</small><small>${escapeHTML(entry.baseline?.event.rawTime || '—')} → ${escapeHTML(entry.current?.event.rawTime || '—')}</small></article>`).join('')}</section>`;
}

export function updateViewStatus(workspace, renderInfo = null) {
  document.getElementById('view-range').textContent = `${formatTimeValue(workspace.view.start)} — ${formatTimeValue(workspace.view.end)}`;
  document.getElementById('view-span').textContent = formatSpan(workspace.view.end - workspace.view.start);
  const values = renderInfo ? [...new Set([...renderInfo.statuses.values(), ...renderInfo.density.values()].filter(Boolean))] : [];
  document.getElementById('lod-status').textContent = values.join(' + ') || 'detailed';
  const min = 1 / (366 * 24 * 60 * 60);
  const max = 1e12;
  const span = Math.max(min, Math.min(max, workspace.view.end - workspace.view.start));
  document.getElementById('zoom-slider').value = String(Math.round((Math.log(max) - Math.log(span)) / (Math.log(max) - Math.log(min)) * 1000));
}

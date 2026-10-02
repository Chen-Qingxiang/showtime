(() => {
  'use strict';
  const t = (zh, en) => document.documentElement.lang.startsWith('en') ? en : zh;

  function init({ getLayers, onFit, onToggle, onMenu }) {
    const list = document.getElementById('layerList');
    let signature = '';
    function refresh() {
      const layers = getLayers();
      const next = JSON.stringify([document.documentElement.lang, layers]);
      if (next === signature) return;
      signature = next;
      const focused = list.contains(document.activeElement) ? document.activeElement : null;
      const focusLayer = focused?.closest('li')?.dataset.layer;
      const focusAction = focused?.dataset.layerAction;
      list.replaceChildren();
      if (!layers.length) {
        const empty = document.createElement('li');
        empty.textContent = t('还没有图层，请先添加 CSV 或示例。', 'No layers yet. Add a CSV or example.');
        list.appendChild(empty);
      }
      for (const layer of layers) {
        const row = document.createElement('li');
        row.dataset.layer = layer.name;
        row.className = `layer-list-row${layer.hidden ? ' is-hidden' : ''}`;
        const title = document.createElement('button');
        title.type = 'button'; title.className = 'layer-list-name'; title.dataset.layerAction = 'fit';
        title.title = t(`定位图层：${layer.name}`, `Fit layer: ${layer.name}`);
        const dot = document.createElement('span'); dot.className = 'layer-colour'; dot.style.background = layer.color;
        dot.setAttribute('aria-hidden', 'true'); title.appendChild(dot);
        const name = document.createElement('span'); name.textContent = layer.name;
        title.appendChild(name); row.appendChild(title);
        const count = document.createElement('span'); count.className = 'layer-list-count';
        count.textContent = t(`${layer.count} 个事件`, `${layer.count} events`);
        row.appendChild(count);
        const toggle = document.createElement('button');
        toggle.type = 'button'; toggle.className = 'layer-list-toggle'; toggle.dataset.layerAction = 'toggle';
        toggle.textContent = layer.hidden ? t('显示', 'Show') : t('隐藏', 'Hide');
        toggle.setAttribute('aria-label', t(`${toggle.textContent}图层：${layer.name}`, `${toggle.textContent} layer: ${layer.name}`));
        toggle.setAttribute('aria-pressed', String(!layer.hidden)); row.appendChild(toggle);
        const more = document.createElement('button'); more.type = 'button'; more.dataset.layerAction = 'menu';
        more.className = 'layer-list-more'; more.textContent = '⋯';
        more.setAttribute('aria-label', t(`更多图层操作：${layer.name}`, `More layer actions: ${layer.name}`));
        row.appendChild(more); list.appendChild(row);
        if (layer.name === focusLayer) row.querySelector(`[data-layer-action="${focusAction}"]`)?.focus();
      }
    }
    list.addEventListener('click', event => {
      const button = event.target.closest('button[data-layer-action]');
      if (!button) return;
      const layer = button.closest('li').dataset.layer;
      // Keep the manager open for visibility changes; opening a popup must not dismiss it immediately.
      event.stopPropagation();
      if (button.dataset.layerAction === 'fit') onFit(layer);
      else if (button.dataset.layerAction === 'toggle') onToggle(layer);
      else onMenu(layer, button.getBoundingClientRect());
    });
    return { refresh };
  }
  window.ShowtimeLayerControls = Object.freeze({ init });
})();

/* Canvas presentation and small inspection UI; astronomy and coordinates live in halley.js. */
(() => {
  'use strict';
  const model = window.ShowtimeHalley;
  const texts = {
    en: {
      title: 'Halley Scale', short: 'Halley', return: 'Halley return', observed: 'Historically observed',
      reconstructed: 'Orbital reconstruction', disputed: 'Disputed identification', predicted: 'Predicted',
      perihelion: 'Perihelion', gregorian: 'Gregorian', julian: 'Julian', original: 'Source date',
      since: 'years since', lifetime: '≈ one human lifetime', source: 'Sources', close: 'Close',
      select: 'Select a return', locate: 'Locate on timeline', coverage: 'Data: 1404 BCE–2061 CE',
      outside: 'Outside the dated return table', compressed: 'Zoom in to separate the returns',
      intro: 'The same comet, returning across generations and civilisations. H0 is the 240 BCE return. Each interval has its own length; fractional H marks divide time, not the comet’s position in its orbit.',
      precision: 'Perihelion anchors the scale; a visible apparition lasts longer and depends on location. Ancient dates are model estimates, not exact observation dates. The 1986 and 2061 anchors are published to the day.',
      historical: 'Historical observations constrain this computed perihelion. “Observed” describes the apparition, not a directly measured perihelion instant.',
      reconstruction: 'Back-calculated orbit; no confirmed historical sighting is claimed here. Yeomans & Kiang estimated uncertainties up to about a month before the earliest records.',
      firstRecord: 'The Shiji record is widely accepted as the earliest positive sighting. Yeomans & Kiang (1981) called the identification probable; NASA treats it as positive. The perihelion is computed.',
      babylon: 'Babylonian tablets studied by Stephenson, Yau & Hunger (1985) contain probable observations. The perihelion comes from the 1981 orbital solution.',
      bayeux: 'The 1066 apparition appears in the Bayeux Tapestry. The same return crossed skies in other societies; this date marks perihelion, not the tapestry’s depicted observation.',
      springAutumn: 'The often-cited 613 BCE Spring and Autumn record is not a confirmed Halley sighting here. This orbital solution gives a return in 616 BCE; the record does not move the anchor.',
      earlyCandidate: 'Possible Greek and Chinese records around 467 BCE have been suggested. Their identification is uncertain; the anchor remains the 466 BCE orbital reconstruction.',
      spacecraft: 'The 1986 apparition was studied by an international fleet of spacecraft. NASA gives perihelion as 9 February; no sub-day time is inferred.',
      prediction: 'NASA gives the next perihelion as 28 July 2061. It is a prediction, which may be revised, and is not a historical observation.',
      coordinate: 'Halley coordinate', span: 'Span', during: 'Returns during this interval', years: 'years',
      ephemeris: 'Ephemeris time', on: 'Halley Scale is on', off: 'Halley Scale is off',
      observations: 'See historical records',
    },
    zh: {
      title: '哈雷纪年', short: '哈雷', return: '哈雷回归', observed: '历史观测',
      reconstructed: '轨道反算', disputed: '历史认定存疑', predicted: '未来预测',
      perihelion: '近日点', gregorian: '公历', julian: '儒略历', original: '原表日期',
      since: '年，距上次', lifetime: '≈ 一代人生', source: '数据来源', close: '关闭',
      select: '选择一次回归', locate: '在时间轴定位', coverage: '数据：前1404年—2061年',
      outside: '当前视野超出回归日期表', compressed: '放大以分辨各次回归',
      intro: '同一颗彗星，跨过一代代人生与不同文明的天空。H0 为公元前240年回归。每一段间隔各有实际长度；小数 H 划分时间，不表示彗星在轨道上的位置。',
      precision: '用近日点作为时间锚点；肉眼可见的时段更长，也随地点而变。古代日期是轨道估算，不是精确的观测日。1986与2061年锚点采用来源公布的日期精度。',
      historical: '这次回归有历史观测，近日点由轨道计算得出。“历史观测”指回归曾被记录，不等于近日点时刻由古人直接测得。',
      reconstruction: '由轨道反算得出，此处不声称有确认的历史观测。Yeomans 与 Kiang 估计，早于最早记录的日期误差可能接近一个月。',
      firstRecord: '《史记》这条记录通常被认作最早的可靠观测。1981年论文称其认定为“很可能”，NASA将其列为可靠观测；近日点日期仍由轨道计算。',
      babylon: 'Stephenson、Yau 与 Hunger（1985）研究的巴比伦泥板包含很可能对应此次回归的观测。近日点取自1981年的轨道解。',
      bayeux: '1066年的这次彗星出现在贝叶挂毯中。同一次回归也经过其他文明的天空；这里标的是近日点，不是挂毯描绘的观测时刻。',
      springAutumn: '常被引用的前613年《春秋》“有星孛入于北斗”，在这里不列为确认的哈雷观测。该轨道解对应前616年回归；不会为匹配记载而移动锚点。',
      earlyCandidate: '前467年前后的希腊与中国记录曾被提出作为候选，认定仍有疑问。锚点保持为轨道反算的前466年回归。',
      spacecraft: '1986年回归曾由多国航天器共同探测。NASA公布近日点为2月9日；这里不推定具体时分。',
      prediction: 'NASA公布下一次近日点为2061年7月28日。这是可能更新的预测，不是已经发生的历史观测。',
      coordinate: '哈雷坐标', span: '跨度', during: '期间回归', years: '年',
      ephemeris: '历书时', on: '哈雷纪年已开启', off: '哈雷纪年已关闭',
      observations: '查看观测史料',
    },
  };

  function language() { return document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'; }
  function t(key) { return texts[language()][key] || key; }
  function yearLabel(historicalYear) {
    return historicalYear < 0 ? (language() === 'zh' ? `前${-historicalYear}` : `${-historicalYear} BCE`)
      : String(historicalYear);
  }
  function dateLabel(julianDay, calendar = 'gregorian') {
    const p = model.julianDayToCalendar(julianDay, calendar);
    const year = model.astronomicalToHistoricalYear(p.year);
    return `${yearLabel(year)}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  }
  function returnLabel(entry) { return `${model.formatH(entry.h)} · ${yearLabel(entry.historicalYear)}`; }

  function drawGuides(ctx, frame, top, height) {
    if (!frame || height <= 0) return;
    ctx.save();
    ctx.lineWidth = 1;
    for (const marker of frame.markers) {
      ctx.strokeStyle = marker.entry.status === 'observed' ? 'rgba(143, 196, 193, 0.22)' : 'rgba(143, 196, 193, 0.14)';
      ctx.setLineDash(marker.entry.status === 'observed' ? [3, 6] : [1, 7]);
      ctx.beginPath(); ctx.moveTo(marker.x, top); ctx.lineTo(marker.x, top + height); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ctx, { width, height, leftPad, rightPad, pxPerYear, yearToX }) {
    const left = leftPad;
    const right = width - rightPad;
    const y = 72;
    const frame = { markers: [], hitAreas: [], minorCount: 0, status: t('coverage') };
    ctx.save();
    ctx.fillStyle = '#0e191e'; ctx.fillRect(left, 40, Math.max(0, right - left), 40);
    ctx.fillStyle = '#8fbebb'; ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(t('short'), left - 10, 57);
    ctx.save(); ctx.beginPath(); ctx.rect(left, 40, Math.max(0, right - left), 40); ctx.clip();
    ctx.strokeStyle = '#2b474c'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();

    const visible = model.returns.map((entry) => ({ entry, x: yearToX(entry.time) }))
      .filter(({ x }) => x >= left && x <= right);
    let lastMarkerX = -Infinity;
    let lastLabelRight = left - 8;
    for (const marker of visible) {
      // At geological scales the dated table collapses into a few pixels. Bound work and ink.
      if (marker.x - lastMarkerX < 4) continue;
      lastMarkerX = marker.x;
      frame.markers.push(marker);
      ctx.strokeStyle = '#72aaa8';
      ctx.beginPath(); ctx.moveTo(marker.x, y - 5); ctx.lineTo(marker.x, y + 3); ctx.stroke();
      const label = returnLabel(marker.entry);
      const labelWidth = ctx.measureText(label).width + 18;
      const labelLeft = Math.max(left + 3, Math.min(marker.x - labelWidth / 2, right - labelWidth - 3));
      const canLabel = labelLeft >= lastLabelRight + 12 && labelLeft + labelWidth <= right;
      let x1 = Math.max(left, marker.x - 6);
      let x2 = Math.min(right, marker.x + 6);
      if (canLabel) {
        ctx.fillStyle = '#9ac7c4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        // Small vector comet: stays legible and does not rely on emoji fonts.
        ctx.strokeStyle = '#9ac7c4'; ctx.beginPath();
        ctx.moveTo(labelLeft, 55); ctx.lineTo(labelLeft + 8, 59);
        ctx.moveTo(labelLeft + 2, 53); ctx.lineTo(labelLeft + 8, 57); ctx.stroke();
        ctx.beginPath(); ctx.arc(labelLeft + 10, 59, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(label, labelLeft + 17, 58);
        lastLabelRight = labelLeft + labelWidth;
        x1 = Math.min(x1, labelLeft); x2 = Math.max(x2, lastLabelRight);
      }
      frame.hitAreas.push({ entry: marker.entry, x1, x2, y1: 40, y2: 80, x: marker.x });
    }

    // Only divide genuine, bounded intervals. Close-up date views do not need fractional ticks.
    if (pxPerYear < 120) {
      for (let index = 0; index < model.returns.length - 1; index += 1) {
        const a = model.returns[index]; const b = model.returns[index + 1];
        const gap = (b.time - a.time) * pxPerYear;
        const divisor = gap >= 480 ? 4 : gap >= 240 ? 2 : 1;
        for (let part = 1; part < divisor; part += 1) {
          const h = a.h + part / divisor;
          const x = yearToX(model.fromHalley(h));
          if (x < left + 24 || x > right - 24) continue;
          ctx.strokeStyle = '#39565a'; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = '#5e8588'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(model.formatH(h), x, 58); frame.minorCount += 1;
        }
      }
    }
    const tableWidth = (model.returns.at(-1).time - model.returns[0].time) * pxPerYear;
    if (!visible.length || tableWidth < 16) {
      frame.status = `${t('coverage')} · ${visible.length ? t('compressed') : t('outside')}`;
      // Clear compressed labels, but retain the exact anchors for later zooming.
      ctx.fillStyle = '#0e191e'; ctx.fillRect(left, 40, Math.max(0, right - left), 29);
      ctx.fillStyle = '#6e9396'; ctx.textAlign = 'left';
      ctx.fillText(frame.status, left + 10, 56);
      if (tableWidth < 16) frame.hitAreas = [];
    } else {
      frame.status = `${t('on')}: ${returnLabel(visible[0].entry)} — ${returnLabel(visible.at(-1).entry)}`;
    }
    ctx.restore(); ctx.restore();
    drawGuides(ctx, frame, 80, Math.max(0, height - 80));
    return frame;
  }

  function findReturn(frame, x, y) {
    if (!frame) return null;
    const hits = frame.hitAreas.filter((hit) => x >= hit.x1 && x <= hit.x2 && y >= hit.y1 && y <= hit.y2);
    hits.sort((a, b) => Math.abs(x - a.x) - Math.abs(x - b.x));
    return hits[0]?.entry || null;
  }

  function metaLine(parent, text, className = 'event-tooltip-meta') {
    const node = document.createElement('div'); node.className = className; node.textContent = text;
    parent.appendChild(node); return node;
  }

  function describeReturn(parent, entry, withSources = false) {
    parent.replaceChildren(); parent.dataset.i18nSkip = '';
    metaLine(parent, `${returnLabel(entry)} · 1P/Halley`, 'event-tooltip-title');
    metaLine(parent, `${t('perihelion')}: ${dateLabel(entry.julianDay)} (${t('gregorian')})`);
    metaLine(parent, `${t(entry.status)}${entry.disputed ? ` · ${t('disputed')}` : ''}`);
    const previous = model.getReturn(entry.h - 1);
    if (previous) {
      const gap = ((entry.julianDay - previous.julianDay) / 365.2425).toFixed(1);
      metaLine(parent, language() === 'zh'
        ? `距 ${model.formatH(previous.h)} ${gap} 年 · ${t('lifetime')}`
        : `${gap} ${t('since')} ${model.formatH(previous.h)} · ${t('lifetime')}`);
    }
    if (entry.sourceCalendar === 'julian') {
      metaLine(parent, `${t('original')}: ${dateLabel(entry.julianDay, 'julian')} (${t('julian')}, ${t('ephemeris')})`);
    }
    metaLine(parent, t(entry.noteKey), 'halley-note');
    if (withSources) {
      const list = document.createElement('ul'); list.className = 'halley-sources';
      for (const id of entry.sourceIds) {
        const source = model.sources[id];
        const li = document.createElement('li'); const link = document.createElement('a');
        link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = source.title;
        li.appendChild(link); list.appendChild(li);
      }
      metaLine(parent, t('source')); parent.appendChild(list);
    }
  }

  function appendEventInfo(parent, start, end) {
    const a = model.toHalley(start); const b = model.toHalley(end);
    if (a === null && b === null) return;
    const block = document.createElement('div'); block.dataset.i18nSkip = ''; block.className = 'halley-event-meta';
    const coordinate = a === null || b === null ? t('outside')
      : Math.abs(end - start) < 1e-12 ? model.formatH(a) : `${model.formatH(a)} – ${model.formatH(b)}`;
    metaLine(block, `${t('coordinate')}: ${coordinate}`);
    const delta = model.span(start, end);
    if (delta !== null && end > start) metaLine(block, `${t('span')}: ${Number(delta.toFixed(2))} H`);
    const entries = model.returnsBetween(start, end);
    if (entries.length) metaLine(block, `${t('during')}: ${entries.slice(0, 4).map(returnLabel).join(' · ')}${entries.length > 4 ? ' …' : ''}`);
    parent.appendChild(block);
  }

  function initInfo(onLocate, onObserve) {
    const dialog = document.getElementById('halleyInfo');
    const select = document.getElementById('halleyReturnSelect');
    const detail = document.getElementById('halleyReturnDetail');
    function refresh() {
      const selected = Number(select.value || 17);
      for (const node of dialog.querySelectorAll('[data-halley-text]')) node.textContent = t(node.dataset.halleyText);
      select.replaceChildren();
      for (const entry of model.returns) {
        const option = document.createElement('option'); option.value = String(entry.h);
        option.textContent = `${returnLabel(entry)} · ${t(entry.status)}${entry.disputed ? ` · ${t('disputed')}` : ''}`;
        select.appendChild(option);
      }
      select.value = String(selected); describeReturn(detail, model.getReturn(selected), true);
    }
    select.addEventListener('change', () => describeReturn(detail, model.getReturn(Number(select.value)), true));
    document.getElementById('halleyInfoClose').addEventListener('click', () => dialog.close());
    document.getElementById('halleyLocate').addEventListener('click', () => {
      const entry = model.getReturn(Number(select.value)); dialog.close(); onLocate(entry);
    });
    document.getElementById('halleySeeRecords').addEventListener('click', () => {
      dialog.close(); onObserve?.(Number(select.value));
    });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    refresh();
    return {
      refresh,
      open(entry = model.getReturn(17)) {
        select.value = String(entry.h); describeReturn(detail, entry, true); dialog.showModal();
      },
    };
  }

  window.ShowtimeHalleyScale = Object.freeze({
    rowHeight: 44, draw, drawGuides, findReturn, describeReturn, appendEventInfo, initInfo, t, dateLabel, returnLabel,
  });
})();

/* Small DOM panels; all timeline positions are supplied by the existing app. */
(() => {
  'use strict';
  const model = window.ShowtimeHalley;
  const history = window.ShowtimeHalleyHistory;
  const scale = window.ShowtimeHalleyScale;
  const words = {
    zh: {
      personTitle: '人物与哈雷', personIntro: '选取人物或导入的时间区间，查看期间的哈雷回归。将区间按生卒解读时，距起点的年数就是年龄。',
      personSelect: '人物 / 已导入区间', name: '姓名 / 标题', birth: '出生 / 起点', death: '去世 / 终点', analyze: '分析输入',
      inputs: '支持年份和公历日期；BCE请写240BC。此处的输入不会修改CSV。', manual: '当前输入', example: '示例', imported: '已导入',
      personLocate: '定位人生 / 区间', invalid: '请输入有效起止时间，终点不能早于起点；公元纪年没有0年。',
      span: '跨度', returns: '期间回归', age: '距起点 / 年龄', years: '年', approximate: '约',
      noReturns: '日期表中没有落在这段时间内的回归。', coverage: '部分时间超出回归日期表；结果只覆盖已知区间。',
      limits: '年龄按输入精度估算；年份生卒有边界不确定性。“经历回归”不代表本人亲眼看过彗星。', boundary: '生卒年边界未确定',
      historyTitle: '哈雷观测史料', historyIntro: '同一回归，在不同文明留下的记录。这里是有出处的精选条目；观测日期和图像关联年份不替代近日点。',
      historySelect: '选择回归', all: '全部精选记录', load: '加载为史料图层', none: '本版尚未收录这次回归的史料，不表示没有历史观测。',
      loaded: '本次加入', items: '条史料；已加载的记录不会重复加入。',
      china: '中国', babylon: '巴比伦', europe: '欧洲', accepted: '可靠认定', probable: '很可能对应哈雷', text: '文字记录', depiction: '图像记录',
      observedDate: '记录日期', associatedYear: '图像关联年份', window: '可能日期窗口', separate: '两个记录日', yearOnly: '仅年精度',
      source: '出处', gregorian: '公历定位', close: '关闭', details: '回归资料', observations: '查看本次观测史料',
      future: '这是未来预测，尚无历史观测记录。',
    },
    en: {
      personTitle: 'Lives & Halley', personIntro: 'Choose a person or an imported interval to find its Halley returns. When endpoints mean birth and death, years from the start can be read as age.',
      personSelect: 'Person / imported interval', name: 'Name / title', birth: 'Birth / start', death: 'Death / end', analyze: 'Analyze inputs',
      inputs: 'Use years or Gregorian dates; write 240BC for BCE. These inputs never change your CSV.', manual: 'Current inputs', example: 'Example', imported: 'Imported',
      personLocate: 'Locate life / interval', invalid: 'Enter valid endpoints in chronological order. Historical chronology has no year zero.',
      span: 'Span', returns: 'Returns during this interval', age: 'Years from start / age', years: 'years', approximate: 'about',
      noReturns: 'No return from the dated table falls in this interval.', coverage: 'Some time lies outside the dated table; results cover only the known interval.',
      limits: 'Ages follow input precision; year-only biography boundaries are uncertain. An overlapping return does not establish a personal sighting.', boundary: 'Biography year boundary uncertain',
      historyTitle: 'Halley observations', historyIntro: 'One return, recorded in different civilisations. These are selected, sourced records; observation dates and depicted years do not replace perihelion.',
      historySelect: 'Select a return', all: 'All selected records', load: 'Load as evidence layers', none: 'This edition has no selected record for this return; this does not mean it went unobserved.',
      loaded: 'Added', items: 'records; already loaded records are not duplicated.',
      china: 'China', babylon: 'Babylonia', europe: 'Europe', accepted: 'Accepted identification', probable: 'Probable Halley identification', text: 'Written record', depiction: 'Depiction',
      observedDate: 'Recorded date', associatedYear: 'Depicted year', window: 'Possible-date window', separate: 'Two recorded dates', yearOnly: 'Year precision only',
      source: 'Source', gregorian: 'Gregorian placement', close: 'Close', details: 'Return details', observations: 'See records for this return',
      future: 'This is a future prediction with no historical observation yet.',
    },
  };
  const language = () => document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const t = key => words[language()][key];
  const byId = id => document.getElementById(id);
  function node(parent, tag, text, className) {
    const el = document.createElement(tag); el.textContent = text;
    if (className) el.className = className;
    parent.appendChild(el); return el;
  }
  function dateText(date, calendar) {
    if (date.length === 1) return date[0] < 0 ? (language() === 'zh' ? `前${-date[0]}` : `${-date[0]} BCE`) : String(date[0]);
    const jd = model.calendarToJulianDay(model.historicalToAstronomicalYear(date[0]), date[1], date[2], calendar);
    return scale.dateLabel(jd, calendar);
  }
  function describeRecord(parent, record, withSources = true) {
    node(parent, 'h3', `${model.formatH(record.h)} · ${record.title[language()]}`);
    node(parent, 'p', `${t(record.civilization)} · ${t(record.kind)} · ${t(record.confidence)}`, 'halley-note');
    const kind = record.kind === 'depiction' ? 'associatedYear' : record.dateKind === 'window' ? 'window' : record.dateKind === 'separate' ? 'separate' : 'observedDate';
    const dates = dateText(record.date, record.calendar) + (record.endDate ? ` – ${dateText(record.endDate, record.calendar)}` : '');
    node(parent, 'p', `${t(kind)}: ${dates} · ${record.dateKind === 'year' ? t('yearOnly') : scale.t('julian')}`);
    if (record.dateKind !== 'year') {
      const first = model.timeValueToJulianDay(history.dateToTime(record.date, record.calendar));
      const last = record.endDate ? model.timeValueToJulianDay(history.dateToTime(record.endDate, record.calendar)) : null;
      node(parent, 'p', `${t('gregorian')}: ${scale.dateLabel(first)}${last === null ? '' : ` – ${scale.dateLabel(last)}`}`, 'halley-note');
    }
    node(parent, 'p', record.note[language()]);
    if (withSources) {
      node(parent, 'p', `${t('source')}: ${record.locator}`, 'halley-note');
      const list = node(parent, 'ul', '', 'halley-sources');
      for (const id of record.sourceIds) {
        const li = node(list, 'li', ''); const link = node(li, 'a', history.sources[id].title);
        link.href = history.sources[id].url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
    }
  }
  function init({ getIntervals, parsePerson, locatePerson, openReturn, loadObservations }) {
    const personDialog = byId('halleyPerson'); const picker = byId('halleyPersonSelect');
    const result = byId('halleyPersonResult'); const error = byId('halleyPersonError');
    const historyDialog = byId('halleyHistory'); const returnPicker = byId('halleyHistorySelect');
    const recordsEl = byId('halleyHistoryRecords');
    let profiles = []; let current = null; let manual = null; let selectedRecords = [];
    function example() {
      return { id: 'example:sushi', title: language() === 'zh' ? '苏轼' : 'Su Shi', start: 1037, end: 1101,
        startPrecision: 'year', endPrecision: 'year', startText: '1037', endText: '1101', rangeText: '1037–1101' };
    }
    function renderPerson() {
      result.replaceChildren(); error.textContent = '';
      if (!current) return;
      const summary = model.lifetimeSummary(current.start, current.end, {
        birthPrecision: ['year', 'month'].includes(current.startPrecision) ? current.startPrecision : 'date',
        deathPrecision: ['year', 'month'].includes(current.endPrecision) ? current.endPrecision : 'date',
      });
      node(result, 'h3', current.title);
      node(result, 'p', current.rangeText);
      node(result, 'p', `${t('span')}: ${summary.spanH === null ? '—' : `${Number(summary.spanH.toFixed(3))} H`}`);
      if (summary.startH !== null && summary.endH !== null) node(result, 'p', `${model.formatH(summary.startH)} – ${model.formatH(summary.endH)}`, 'halley-note');
      if (!summary.coverageComplete) node(result, 'p', t('coverage'), 'halley-note');
      node(result, 'h3', t('returns'));
      if (!summary.returns.length) node(result, 'p', t('noReturns'));
      for (const item of summary.returns) {
        const row = node(result, 'article', '', 'halley-card'); row.dataset.returnH = String(item.return.h);
        node(row, 'p', `${scale.returnLabel(item.return)} · ${t('age')}: ${item.approximateAge ? `${t('approximate')} ` : ''}${item.age} ${t('years')}`);
        if (item.boundaryUncertain) node(row, 'p', t('boundary'), 'halley-note');
        const actions = node(row, 'div', '', 'halley-actions');
        node(actions, 'button', t('details')).addEventListener('click', () => { personDialog.close(); openReturn(item.return); });
        node(actions, 'button', t('observations')).addEventListener('click', () => { personDialog.close(); openHistory(item.return.h); });
      }
    }
    function updateProfiles(preferredId = picker.value || 'example:sushi', fill = true) {
      profiles = [example(), ...getIntervals()];
      if (manual) profiles.push(manual);
      picker.replaceChildren();
      for (const profile of profiles) {
        const option = node(picker, 'option', `${profile.title} · ${profile.rangeText} (${t(profile.id.startsWith('example:') ? 'example' : profile.id === 'manual' ? 'manual' : 'imported')})`);
        option.value = profile.id;
      }
      current = profiles.find(profile => profile.id === preferredId) || profiles[0];
      picker.value = current.id;
      if (fill) { byId('halleyPersonName').value = current.title; byId('halleyBirth').value = current.startText; byId('halleyDeath').value = current.endText; }
      renderPerson();
    }
    function renderHistory() {
      recordsEl.replaceChildren();
      const value = returnPicker.value;
      selectedRecords = value === 'all' ? history.records.slice() : history.forReturn(Number(value));
      if (value !== 'all') node(recordsEl, 'p', `${scale.returnLabel(model.getReturn(Number(value)))} · ${scale.t('perihelion')}: ${scale.dateLabel(model.getReturn(Number(value)).julianDay)}`);
      if (!selectedRecords.length) node(recordsEl, 'p', t(value !== 'all' && model.getReturn(Number(value)).status === 'predicted' ? 'future' : 'none'), 'halley-note');
      for (const record of selectedRecords) {
        const card = node(recordsEl, 'article', '', 'halley-card'); card.dataset.recordId = record.id;
        describeRecord(card, record);
      }
      byId('halleyHistoryLoad').disabled = !selectedRecords.length;
      byId('halleyHistoryStatus').textContent = '';
    }
    function updateReturnPicker() {
      const value = returnPicker.value || '17';
      returnPicker.replaceChildren();
      node(returnPicker, 'option', t('all')).value = 'all';
      for (const entry of model.returns) node(returnPicker, 'option', scale.returnLabel(entry)).value = String(entry.h);
      returnPicker.value = value; renderHistory();
    }
    function refresh() {
      for (const el of document.querySelectorAll('[data-halley-panel-text]')) el.textContent = t(el.dataset.halleyPanelText);
      updateProfiles(picker.value, false); updateReturnPicker();
    }
    function openPerson(event) {
      refresh(); updateProfiles(event ? `event:${event.id}` : picker.value || 'example:sushi');
      personDialog.showModal();
    }
    function openHistory(h = 17) {
      refresh(); returnPicker.value = String(h); renderHistory(); historyDialog.showModal();
    }
    picker.addEventListener('change', () => updateProfiles(picker.value));
    byId('halleyPersonForm').addEventListener('submit', event => {
      event.preventDefault();
      const profile = parsePerson(byId('halleyPersonName').value, byId('halleyBirth').value, byId('halleyDeath').value);
      if (!profile) { error.textContent = t('invalid'); return; }
      manual = { ...profile, id: 'manual' }; updateProfiles('manual');
    });
    byId('halleyPersonLocate').addEventListener('click', () => { personDialog.close(); locatePerson(current); });
    returnPicker.addEventListener('change', renderHistory);
    byId('halleyHistoryLoad').addEventListener('click', () => {
      const count = loadObservations(selectedRecords, language());
      byId('halleyHistoryStatus').textContent = `${t('loaded')} ${count} ${t('items')}`;
    });
    for (const [dialog, close] of [[personDialog, 'halleyPersonClose'], [historyDialog, 'halleyHistoryClose']]) {
      byId(close).addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    }
    refresh();
    return { refresh, openPerson, openHistory };
  }
  window.ShowtimeHalleyPanels = Object.freeze({ init, describeRecord });
})();

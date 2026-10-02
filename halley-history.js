/* Selected evidence of apparitions. These dates never replace the perihelion table. */
(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('./halley.js') : root.ShowtimeHalley;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShowtimeHalleyHistory = api;
})(typeof globalThis === 'object' ? globalThis : this, function (model) {
  'use strict';
  function freeze(value) {
    Object.values(value).forEach(item => { if (item && typeof item === 'object') freeze(item); });
    return Object.freeze(value);
  }
  const sources = freeze({
    ...model.sources,
    hunger: {
      title: 'H. Hunger, Cuneiform descriptions of transient phenomena, §3',
      url: 'https://doi.org/10.1017/S1743921319003995',
    },
  });
  // Dates use historical year numbering and the explicitly named source calendar.
  const records = freeze([
    { id: 'china-240', h: 0, civilization: 'china', confidence: 'accepted', kind: 'text',
      date: [-240], calendar: 'julian', dateKind: 'year', sourceIds: ['nasaHistory'], locator: 'NASA, earliest observations',
      title: { zh: '《史记》中的彗星', en: 'The comet in the Shiji' },
      note: { zh: 'NASA认定为最早可靠观测；本条仅用年份定位，不补造观测日。', en: 'NASA accepts this as the earliest positive record. Only the year is placed here; no observation day is invented.' } },
    { id: 'babylon-164', h: 1, civilization: 'babylon', confidence: 'probable', kind: 'text',
      date: [-164, 10, 20], endDate: [-164, 11, 18], calendar: 'julian', dateKind: 'window', sourceIds: ['babylon1985', 'hunger'], locator: 'Hunger, §3, p.168',
      title: { zh: '巴比伦泥板：月份窗口', en: 'Babylonian tablets: a month window' },
      note: { zh: '只保留了月份，没有日号。区间表示可能日期窗口，并非连续观测了整个月。', en: 'The month survives, but the day does not. This is a possible-date window, not a month of continuous sightings.' } },
    { id: 'babylon-87', h: 2, civilization: 'babylon', confidence: 'probable', kind: 'text',
      date: [-87, 8, 24], calendar: 'julian', dateKind: 'day', sourceIds: ['babylon1985', 'hunger'], locator: 'Hunger, §3, p.168',
      title: { zh: '巴比伦天文日记', en: 'A Babylonian astronomical diary' },
      note: { zh: '泥板残损；Hunger将该月十三日换算为8月24日。认定置信度与日期精度分开保留。', en: 'The tablet is fragmentary. Hunger converts month V, day 13 to August 24; identification confidence remains separate from date precision.' } },
    { id: 'china-837', h: 14, civilization: 'china', confidence: 'accepted', kind: 'text',
      date: [837, 4, 8], endDate: [837, 4, 9], calendar: 'julian', dateKind: 'separate', sourceIds: ['yeomans1981'], locator: 'Yeomans & Kiang, p.638, Return of 837',
      title: { zh: '中国记录：女宿与斗宿', en: 'Chinese records: Nyu and Dou mansions' },
      note: { zh: '论文列出4月8日、9日的位置记载；这里连接两个记录日，不推定期间一直可见。', en: 'The paper lists positions on April 8 and 9. The segment connects two recorded dates; visibility between them is not inferred.' } },
    { id: 'china-1066', h: 17, civilization: 'china', confidence: 'accepted', kind: 'text',
      date: [1066, 4, 24], endDate: [1066, 4, 25], calendar: 'julian', dateKind: 'separate', sourceIds: ['yeomans1981'], locator: 'Yeomans & Kiang, p.637, Return of 1066',
      title: { zh: '《宋史·英宗本纪》：昴宿与毕宿', en: 'History of Song: Mao and Bi mansions' },
      note: { zh: '论文引述4月24日在昴宿、25日在毕宿的两条位置记录，与欧洲的1066年回归相对应。', en: 'The paper cites positions in Mao on April 24 and Bi on April 25, associated with the same 1066 return known in Europe.' } },
    { id: 'europe-1066', h: 17, civilization: 'europe', confidence: 'accepted', kind: 'depiction',
      date: [1066], calendar: 'julian', dateKind: 'year', sourceIds: ['nasaHistory'], locator: 'NASA, Bayeux Tapestry and the 1066 apparition',
      title: { zh: '贝叶挂毯中的彗星', en: 'The comet in the Bayeux Tapestry' },
      note: { zh: '图像描绘1066年回归，不把挂毯制作时间当作观测日期。NASA介绍了英格兰与诺曼底对它的不同政治诠释。', en: 'The image depicts the 1066 apparition, rather than dating a sighting by the tapestry’s production. NASA describes differing political interpretations in England and Normandy.' } },
    { id: 'china-1301', h: 20, civilization: 'china', confidence: 'accepted', kind: 'text',
      date: [1301, 9, 16], calendar: 'julian', dateKind: 'day', sourceIds: ['yeomans1981'], locator: 'Yeomans & Kiang, pp.634, 637, Return of 1301',
      title: { zh: '中国记录：井宿位置', en: 'Chinese record: position in Jing' },
      note: { zh: '9月16日的位置记录用于研究此次回归；观测发生在近日点之前。', en: 'The September 16 position helped study this return; the observation precedes perihelion.' } },
    { id: 'cambridge-1301-09', h: 20, civilization: 'europe', confidence: 'accepted', kind: 'text',
      date: [1301, 9, 30], calendar: 'julian', dateKind: 'day', sourceIds: ['yeomans1981'], locator: 'Yeomans & Kiang, p.634',
      title: { zh: '剑桥观测：9月30日', en: 'Cambridge observation: September 30' },
      note: { zh: '论文列出的英格兰剑桥观测，与中国同年记录共同用于早期轨道研究。', en: 'The paper lists this Cambridge observation alongside Chinese evidence used in early orbit studies.' } },
    { id: 'cambridge-1301-10', h: 20, civilization: 'europe', confidence: 'accepted', kind: 'text',
      date: [1301, 10, 6], calendar: 'julian', dateKind: 'day', sourceIds: ['yeomans1981'], locator: 'Yeomans & Kiang, p.634',
      title: { zh: '剑桥观测：10月6日', en: 'Cambridge observation: October 6' },
      note: { zh: '论文列出的第二次剑桥观测；本层保留具体记录日，而非移到近日点线上。', en: 'The second Cambridge observation listed in the paper stays at its recorded date, rather than on the perihelion line.' } },
  ]);
  function getRecord(id) { return records.find(record => record.id === id) || null; }
  function forReturn(h) { return records.filter(record => record.h === h); }
  function dateToTime(date, calendar) {
    const year = model.historicalToAstronomicalYear(date[0]);
    if (date.length === 1) return year;
    return model.julianDayToTimeValue(model.calendarToJulianDay(year, date[1], date[2], calendar));
  }
  function timelineEvents(selected = records, language = 'en') {
    const lang = language === 'zh' ? 'zh' : 'en';
    const civilizations = { china: { zh: '中国', en: 'China' }, babylon: { zh: '巴比伦', en: 'Babylonia' }, europe: { zh: '欧洲', en: 'Europe' } };
    return selected.map(record => ({
      id: `halley-observation:${record.id}`, halleyObservationId: record.id,
      title: `${model.formatH(record.h)} · ${record.title[lang]}`,
      start: dateToTime(record.date, record.calendar), end: dateToTime(record.endDate || record.date, record.calendar),
      startPrecision: record.dateKind === 'year' ? 'year' : 'date',
      endPrecision: record.dateKind === 'year' ? 'year' : 'date',
      layer: `${lang === 'zh' ? '哈雷史料' : 'Halley evidence'}：${civilizations[record.civilization][lang]}`,
    }));
  }
  return Object.freeze({ sources, records, getRecord, forReturn, dateToTime, timelineEvents });
});

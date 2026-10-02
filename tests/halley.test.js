const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const H = require('../halley.js');
const History = require('../halley-history.js');

test('selected observations have frozen provenance and link to real returns in three civilisations', () => {
  assert.equal(History.records.length, 9);
  assert.equal(new Set(History.records.map(r => r.civilization)).size, 3);
  assert.equal(new Set(History.records.map(r => r.id)).size, History.records.length);
  for (const record of History.records) {
    assert.ok(Object.isFrozen(record) && Object.isFrozen(record.date));
    assert.ok(H.getReturn(record.h));
    assert.ok(record.sourceIds.every(id => History.sources[id]?.url.startsWith('https://')));
  }
  assert.equal(History.getRecord('unknown'), null);
  assert.equal(History.forReturn(17).length, 2);
  assert.equal(History.forReturn(30).length, 0);
});

test('Chinese 1066 sightings stay at their source dates, apart from the March perihelion', () => {
  const record = History.getRecord('china-1066');
  const event = History.timelineEvents([record], 'zh')[0];
  const day = H.julianDayToCalendar(H.timeValueToJulianDay(event.start));
  assert.deepEqual([day.year, day.month, day.day], [1066, 4, 30]);
  assert.ok(event.start > H.getReturn(17).time);
  assert.deepEqual(record.date, [1066, 4, 24]);
  assert.equal(record.dateKind, 'separate');
  assert.equal(event.halleyObservationId, record.id);
});

test('Babylonian possible-date window and probable identification are not exact sightings', () => {
  const record = History.getRecord('babylon-164');
  const event = History.timelineEvents([record])[0];
  assert.equal(record.dateKind, 'window');
  assert.equal(record.confidence, 'probable');
  assert.ok(event.start < H.getReturn(1).time && event.end > H.getReturn(1).time);
  near(H.timeValueToJulianDay(event.end) - H.timeValueToJulianDay(event.start), 29);
  assert.equal(H.astronomicalToHistoricalYear(Math.floor(event.start)), -164);
});

test('Bayeux is a depicted year, and translation cannot change observation dates or source data', () => {
  const record = History.getRecord('europe-1066');
  assert.equal(record.kind, 'depiction'); assert.equal(record.dateKind, 'year');
  const before = JSON.stringify(History.records);
  const zh = History.timelineEvents(); const en = History.timelineEvents(History.records, 'zh');
  assert.deepEqual(zh.map(e => [e.id, e.start, e.end]), en.map(e => [e.id, e.start, e.end]));
  assert.equal(JSON.stringify(History.records), before);
});

test('month-precision deaths include their month, not all later returns in the same year', () => {
  const january = H.julianDayToTimeValue(H.calendarToJulianDay(1986, 1, 1));
  const february = H.julianDayToTimeValue(H.calendarToJulianDay(1986, 2, 1));
  assert.equal(H.lifetimeSummary(1900, january, { deathPrecision: 'month' }).returns.at(-1).return.h, 28);
  const result = H.lifetimeSummary(1900, february, { deathPrecision: 'month' });
  assert.equal(result.returns.at(-1).return.h, 29);
  assert.equal(result.returns.at(-1).boundaryUncertain, true);
  const birth = H.julianDayToTimeValue(H.calendarToJulianDay(1900, 2, 1));
  assert.equal(H.lifetimeSummary(birth, 1987, { birthPrecision: 'month' }).returns.at(-1).approximateAge, true);
});

const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual} differs from ${expected}`);

test('47 ordered, consecutive returns have the intended numbering and source provenance', () => {
  assert.equal(H.returns.length, 47);
  const years = [-240, 1066, 1835, 1910, 1986, 2061];
  [0, 17, 27, 28, 29, 30].forEach((h, i) => assert.equal(H.getReturn(h).historicalYear, years[i]));
  H.returns.forEach((entry, i) => {
    assert.equal(entry.h, i - 16);
    assert.ok(entry.sourceIds.every((id) => H.sources[id]?.url.startsWith('https://')));
    if (i) assert.ok(entry.julianDay > H.returns[i - 1].julianDay && entry.time > H.returns[i - 1].time);
  });
});

test('independent calendar transcriptions from Table 4 match Julian-day anchors', () => {
  const samples = [
    [-16, -1403, 10, 15.68109], [-13, -1197, 5, 11.23252], [-5, -615, 7, 28.50346],
    [-1, -314, 9, 8.52367], [0, -239, 5, 25.11796], [1, -163, 11, 12.56604],
    [3, -11, 10, 10.84852], [8, 374, 2, 16.34230], [17, 1066, 3, 20.93405],
    [22, 1456, 6, 9.63257], [24, 1607, 10, 27.54063], [28, 1910, 4, 20.17771],
  ];
  for (const [h, year, month, day] of samples) {
    const entry = H.getReturn(h);
    near(H.calendarToJulianDay(year, month, day, entry.sourceCalendar), entry.julianDay, 1e-8);
  }
});

test('historical numbering has no year zero and preserves a continuous BCE/CE coordinate', () => {
  assert.equal(H.historicalToAstronomicalYear(-240), -239);
  assert.equal(H.historicalToAstronomicalYear(-1), 0);
  assert.equal(H.historicalToAstronomicalYear(1), 1);
  assert.equal(H.historicalToAstronomicalYear(0), null);
  assert.equal(H.astronomicalToHistoricalYear(0), -1);
  assert.equal(H.astronomicalToHistoricalYear(-239), -240);
  assert.ok(H.toHalley(1) > H.toHalley(0));
  near(H.fromHalley(H.toHalley(0)), 0);
  near(H.fromHalley(H.toHalley(1)), 1);
});

test('calendar conversion uses proleptic Gregorian dates for the existing main coordinate', () => {
  const entry = H.getReturn(17);
  const gregorian = H.julianDayToCalendar(entry.julianDay);
  assert.deepEqual([gregorian.year, gregorian.month, gregorian.day], [1066, 3, 26]);
  const julian = H.julianDayToCalendar(entry.julianDay, 'julian');
  assert.deepEqual([julian.year, julian.month, julian.day], [1066, 3, 20]);
  near(entry.time, 1066 + (84 + 0.93405) / 365);
  near(H.calendarToJulianDay(2000, 1, 1.5), 2451545);
});

test('Gregorian and Julian leap rules, fractional days, and BCE dates round-trip', () => {
  for (const [year, month, day, calendar] of [
    [0, 2, 29.5, 'gregorian'], [-239, 5, 25.1, 'julian'],
    [1900, 2, 29, 'julian'], [2000, 2, 29.75, 'gregorian'], [1582, 10, 4, 'julian'],
  ]) {
    const jd = H.calendarToJulianDay(year, month, day, calendar);
    const p = H.julianDayToCalendar(jd, calendar);
    assert.equal(p.year, year); assert.equal(p.month, month); near(p.day + p.fraction, day);
    near(H.timeValueToJulianDay(H.julianDayToTimeValue(jd)), jd);
  }
  assert.equal(H.calendarToJulianDay(1900, 2, 29), null);
  assert.equal(H.calendarToJulianDay(1986, 13, 1), null);
  assert.equal(H.calendarToJulianDay(1986, 1, 32), null);
});

test('every exact perihelion maps to its integer H, including both endpoints', () => {
  for (const entry of H.returns) {
    assert.equal(H.toHalley(entry.time), entry.h);
    assert.equal(H.fromHalley(entry.h), entry.time);
  }
});

test('half, quarter, negative fractional H and arbitrary event times invert monotonically', () => {
  for (let h = -16; h <= 30; h += 0.125) near(H.toHalley(H.fromHalley(h)), h);
  const a = H.getReturn(17); const b = H.getReturn(18);
  near(H.toHalley(a.time + (b.time - a.time) * 0.42), 17.42);
  near(H.fromHalley(-0.5), (H.getReturn(-1).time + H.getReturn(0).time) / 2);
  assert.equal(H.formatH(-0.5), 'H−0.5');
});

test('periods are the published individual intervals rather than a fixed 75-year formula', () => {
  const gap = (h) => H.getReturn(h + 1).time - H.getReturn(h).time;
  assert.ok(gap(9) > 79 && gap(27) < 75);
  assert.ok(Math.abs(gap(9) - gap(27)) > 4);
});

test('unsupported history, future extrapolation and invalid inputs do not fabricate returns', () => {
  for (const v of [-1e10, 5000, NaN, Infinity, -Infinity, null, '1066']) assert.equal(H.toHalley(v), null);
  for (const h of [-17, 31, NaN, Infinity, null]) assert.equal(H.fromHalley(h), null);
  assert.equal(H.getReturn(17.42), null);
  assert.equal(H.span(1000, 3000), null);
  assert.deepEqual(H.returnsBetween(1101, 1037), []);
});

test('613 BCE is a disputed association, never an invented perihelion', () => {
  const entry = H.getReturn(-5);
  assert.equal(entry.historicalYear, -616);
  assert.equal(entry.status, 'reconstructed');
  assert.equal(entry.disputed, true);
  assert.ok(!H.returns.some((r) => r.historicalYear === -613));
  assert.equal(H.getReturn(30).status, 'predicted');
});

test('Su Shi’s interval contains H17 at about age 29 and spans roughly 0.82 H', () => {
  const summary = H.lifetimeSummary(1037, 1101);
  assert.equal(summary.returns.length, 1);
  assert.equal(summary.returns[0].return.h, 17);
  assert.equal(summary.returns[0].age, 29);
  assert.equal(summary.returns[0].approximateAge, true);
  assert.ok(summary.spanH > 0.82 && summary.spanH < 0.83);
  assert.equal(summary.coverageComplete, true);
});

test('year-only biography boundaries remain uncertain; coverage and precise ages are explicit', () => {
  const yearOnly = H.lifetimeSummary(1066, 1066);
  assert.equal(yearOnly.returns[0].boundaryUncertain, true);
  assert.equal(yearOnly.returns[0].age, 0);
  const birth = H.julianDayToTimeValue(H.calendarToJulianDay(1037, 6, 1));
  const precise = H.lifetimeSummary(birth, 1101, { birthPrecision: 'date' });
  assert.equal(precise.returns[0].age, 28);
  assert.equal(precise.returns[0].approximateAge, false);
  const leapYearBirth = H.julianDayToTimeValue(H.calendarToJulianDay(1908, 4, 20));
  assert.equal(H.lifetimeSummary(leapYearBirth, 1911, { birthPrecision: 'date' }).returns[0].age, 2);
  assert.equal(H.lifetimeSummary(-2000, 100).coverageComplete, false);
  assert.equal(H.lifetimeSummary(1101, 1037), null);
});

test('model and source data cannot be changed by presentation or consumers', () => {
  assert.ok(Object.isFrozen(H) && Object.isFrozen(H.returns) && Object.isFrozen(H.getReturn(17)));
  assert.throws(() => H.returns.push({ h: 31 }));
});

function rendererFixture(lang = 'en') {
  const window = { ShowtimeHalley: H };
  vm.runInNewContext(fs.readFileSync(require.resolve('../halley-scale.js'), 'utf8'),
    { window, document: { documentElement: { lang } } });
  const labels = [];
  const context = new Proxy({
    measureText: (text) => ({ width: text.length * 6 }),
    fillText: (text, x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); labels.push({ text, x, y }); },
  }, { get: (target, key) => target[key] || ((...args) => args.forEach((n) => {
    if (typeof n === 'number') assert.ok(Number.isFinite(n));
  })) });
  function render(start, pxPerYear, width = 1280) {
    labels.length = 0;
    return window.ShowtimeHalleyScale.draw(context, { width, height: 600, leftPad: 80, rightPad: 20,
      pxPerYear, yearToX: (year) => 80 + (year - start) * pxPerYear });
  }
  return { render, labels, api: window.ShowtimeHalleyScale };
}

test('renderer bounds work at both extreme zooms and outside the astronomical table', () => {
  const fixture = rendererFixture();
  for (const [start, px] of [[-1e10, 1e-8], [H.getReturn(17).time, 2e9], [3000, 2], [-5000, 2]]) {
    const frame = fixture.render(start, px);
    assert.ok(frame.markers.length <= 47 && frame.minorCount <= 138);
    assert.ok(frame.markers.every((m) => m.x >= 80 && m.x <= 1260));
  }
});

test('fractional ticks adapt to the screen gap and disappear at date-level zoom', () => {
  const fixture = rendererFixture();
  assert.equal(fixture.render(1030, 2).minorCount, 0);
  assert.ok(fixture.render(1030, 4).minorCount > 0);
  assert.ok(fixture.render(1030, 8).minorCount > 0);
  assert.equal(fixture.render(1066, 1000).minorCount, 0);
});

test('actual markers and labels are hit-tested; no invisible return intercepts event content', () => {
  const fixture = rendererFixture(); const frame = fixture.render(1030, 4, 390);
  const marker = frame.markers.find((m) => m.entry.h === 17);
  assert.equal(fixture.api.findReturn(frame, marker.x, 60).h, 17);
  assert.equal(fixture.api.findReturn(frame, marker.x, 100), null);
  assert.equal(fixture.api.findReturn(null, marker.x, 60), null);
  assert.ok(fixture.labels.some((l) => l.text.includes('H17')));
});

test('renderer and history statuses switch language without translating model data', () => {
  const en = rendererFixture(); const zh = rendererFixture('zh-CN');
  assert.equal(en.api.t('observed'), 'Historically observed');
  assert.equal(zh.api.t('observed'), '历史观测');
  assert.equal(zh.api.t('disputed'), '历史认定存疑');
  assert.equal(H.getReturn(17).noteKey, 'bayeux');
});

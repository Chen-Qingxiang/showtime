(function (root, factory) {
  const data = typeof module === 'object' && module.exports
    ? require('./halley-data.js') : root.ShowtimeHalleyData;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShowtimeHalley = api;
})(typeof globalThis === 'object' ? globalThis : this, function (data) {
  'use strict';

  function historicalToAstronomicalYear(year) {
    if (!Number.isInteger(year) || year === 0) return null;
    return year < 0 ? year + 1 : year;
  }

  function astronomicalToHistoricalYear(year) {
    if (!Number.isInteger(year)) return null;
    return year <= 0 ? year - 1 : year;
  }

  function calendarToJulianDay(year, month = 1, day = 1, calendar = 'gregorian') {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12
      || !Number.isFinite(day) || day < 1 || !['julian', 'gregorian'].includes(calendar)) return null;
    const leap = year % 4 === 0 && (calendar === 'julian' || year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day >= days[month - 1] + 1) return null;
    let y = year;
    let m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const a = Math.floor(y / 100);
    const b = calendar === 'gregorian' ? 2 - a + Math.floor(a / 4) : 0;
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
  }

  function julianDayToCalendar(julianDay, calendar = 'gregorian') {
    if (!Number.isFinite(julianDay) || !['julian', 'gregorian'].includes(calendar)) return null;
    const z = Math.floor(julianDay + 0.5);
    const fraction = julianDay + 0.5 - z;
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    const a = calendar === 'gregorian' ? z + 1 + alpha - Math.floor(alpha / 4) : z;
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const dayValue = b - d - Math.floor(30.6001 * e) + fraction;
    const month = e < 14 ? e - 1 : e - 13;
    return { year: month > 2 ? c - 4716 : c - 4715, month, day: Math.floor(dayValue), fraction };
  }

  // ShowTime's existing coordinate: astronomical year + fraction of its Gregorian year.
  function julianDayToTimeValue(julianDay) {
    const parts = julianDayToCalendar(julianDay);
    if (!parts) return null;
    const start = calendarToJulianDay(parts.year);
    const end = calendarToJulianDay(parts.year + 1);
    return parts.year + (julianDay - start) / (end - start);
  }

  function timeValueToJulianDay(value) {
    if (!Number.isFinite(value)) return null;
    const year = Math.floor(value);
    const start = calendarToJulianDay(year);
    return start + (value - year) * (calendarToJulianDay(year + 1) - start);
  }

  const returns = Object.freeze(data.returns.map((entry) => {
    const julianDay = entry.julianDay ?? calendarToJulianDay(...entry.date);
    return Object.freeze({ ...entry, julianDay, time: julianDayToTimeValue(julianDay) });
  }));
  const first = returns[0];
  const last = returns[returns.length - 1];

  function getReturn(h) {
    if (!Number.isInteger(h)) return null;
    return returns[h - first.h] || null;
  }

  function toHalley(time) {
    if (!Number.isFinite(time) || time < first.time || time > last.time) return null;
    if (time === last.time) return last.h;
    let lo = 0;
    let hi = returns.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (returns[mid].time <= time) lo = mid;
      else hi = mid;
    }
    const a = returns[lo];
    const b = returns[hi];
    return a.h + (time - a.time) / (b.time - a.time);
  }

  function fromHalley(h) {
    if (!Number.isFinite(h) || h < first.h || h > last.h) return null;
    if (h === last.h) return last.time;
    const a = getReturn(Math.floor(h));
    const b = getReturn(a.h + 1);
    return a.time + (h - a.h) * (b.time - a.time);
  }

  function returnsBetween(start, end) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return returns.filter((entry) => entry.time >= start && entry.time <= end);
  }

  function span(start, end) {
    const a = toHalley(start);
    const b = toHalley(end);
    return a === null || b === null ? null : b - a;
  }

  function lifetimeSummary(birth, death, options = {}) {
    if (!Number.isFinite(birth) || !Number.isFinite(death) || death < birth) return null;
    const birthPrecision = options.birthPrecision || 'year';
    const deathPrecision = options.deathPrecision || 'year';
    const birthDate = julianDayToCalendar(timeValueToJulianDay(birth));
    const deathDate = julianDayToCalendar(timeValueToJulianDay(death));
    const end = deathPrecision === 'year' ? Math.floor(death) + 1 - 1e-9
      : deathPrecision === 'month' ? julianDayToTimeValue(calendarToJulianDay(
        deathDate.year + (deathDate.month === 12 ? 1 : 0), deathDate.month === 12 ? 1 : deathDate.month + 1)) - 1e-9 : death;
    return {
      startH: toHalley(birth), endH: toHalley(death), spanH: span(birth, death),
      coverageComplete: birth >= first.time && end <= last.time,
      returns: returnsBetween(birth, end).map((entry) => {
        const returnDate = julianDayToCalendar(entry.julianDay);
        const beforeBirthday = returnDate.month < birthDate.month
          || (returnDate.month === birthDate.month
            && returnDate.day + returnDate.fraction < birthDate.day + birthDate.fraction - 1e-9);
        return {
          return: entry,
          // Year-only biographies give an approximate age, never a verified sighting.
          age: birthPrecision === 'year' ? Math.floor(entry.time) - Math.floor(birth)
            : birthPrecision === 'month' ? returnDate.year - birthDate.year - (returnDate.month < birthDate.month ? 1 : 0)
            : returnDate.year - birthDate.year - (beforeBirthday ? 1 : 0),
          approximateAge: birthPrecision === 'year' || birthPrecision === 'month',
          boundaryUncertain: (birthPrecision === 'year' && Math.floor(entry.time) === Math.floor(birth))
            || (deathPrecision === 'year' && Math.floor(entry.time) === Math.floor(death))
            || (birthPrecision === 'month' && returnDate.year === birthDate.year && returnDate.month === birthDate.month)
            || (deathPrecision === 'month' && returnDate.year === deathDate.year && returnDate.month === deathDate.month),
        };
      }),
    };
  }

  function formatH(h, digits = 1) {
    if (!Number.isFinite(h)) return '';
    return `H${Number(h.toFixed(digits))}`.replace('-', '−');
  }

  return Object.freeze({
    returns, sources: data.sources, getReturn, toHalley, fromHalley, span, returnsBetween,
    lifetimeSummary, historicalToAstronomicalYear, astronomicalToHistoricalYear,
    calendarToJulianDay, julianDayToCalendar, julianDayToTimeValue, timeValueToJulianDay, formatH,
  });
});

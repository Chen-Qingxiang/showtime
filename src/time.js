const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
export const TIME_EPSILON = 1e-12;

export function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function daysInMonth(year, month) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

export function dateToTimeValue(year, month, day, hour = 0, minute = 0, second = 0) {
  let elapsedDays = day - 1;
  for (let value = 1; value < month; value += 1) elapsedDays += daysInMonth(year, value);
  const dayFraction = (hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second) / SECONDS_PER_DAY;
  return year + (elapsedDays + dayFraction) / daysInYear(year);
}

export function timeValueToDateParts(value) {
  let year = Math.floor(value);
  let seconds = Math.floor((value - year) * daysInYear(year) * SECONDS_PER_DAY + 1e-6);
  const yearSeconds = daysInYear(year) * SECONDS_PER_DAY;
  if (seconds >= yearSeconds) {
    year += 1;
    seconds = 0;
  }
  seconds = Math.max(0, seconds);
  let dayIndex = Math.floor(seconds / SECONDS_PER_DAY);
  const secondsOfDay = seconds % SECONDS_PER_DAY;
  let month = 1;
  while (month <= 12 && dayIndex >= daysInMonth(year, month)) {
    dayIndex -= daysInMonth(year, month);
    month += 1;
  }
  return {
    year,
    month,
    day: dayIndex + 1,
    hour: Math.floor(secondsOfDay / SECONDS_PER_HOUR),
    minute: Math.floor((secondsOfDay % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    second: secondsOfDay % SECONDS_PER_MINUTE,
  };
}

function normalizeInput(value) {
  let text = String(value ?? '').trim();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

export function parseYearToken(value) {
  const text = normalizeInput(value);
  if (!text) return null;
  let match = text.match(/^(\d+)\s*(?:BC|BCE)$/i);
  if (match) return -(Number(match[1]) - 1);
  match = text.match(/^(?:公元)?前\s*(\d+)$/i);
  if (match) return -(Number(match[1]) - 1);
  match = text.match(/^(\d+)\s*(?:AD|CE)$/i);
  if (match) return Number(match[1]);
  match = text.match(/^公元\s*(\d+)$/i);
  if (match) return Number(match[1]);
  if (/^-?\d+$/.test(text)) return Number(text);
  return null;
}

export function parseDateToken(value) {
  const text = normalizeInput(value);
  const match = text.match(/^(\d{1,9})[/-](\d{1,2})(?:[/-](\d{1,2})(?:[T\s]+(\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] == null ? 1 : Number(match[3]);
  const hour = match[4] == null ? 0 : Number(match[4]);
  const minute = match[5] == null ? 0 : Number(match[5]);
  const second = match[6] == null ? 0 : Number(match[6]);
  if (!Number.isSafeInteger(year) || year <= 0 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  let precision = 'month';
  if (match[3] != null) precision = 'date';
  if (match[4] != null) precision = 'hour';
  if (match[5] != null) precision = 'minute';
  if (match[6] != null) precision = 'second';
  const date = { year, month, day, hour, minute, second };
  return { value: dateToTimeValue(year, month, day, hour, minute, second), precision, date };
}

export function parseTimeToken(value) {
  const date = parseDateToken(value);
  if (date) return date;
  const year = parseYearToken(value);
  if (year == null || !Number.isSafeInteger(year)) return null;
  return { value: year, precision: 'year', date: null };
}

function currentToken(precision, now = new Date()) {
  if (precision === 'year') return { value: now.getFullYear(), precision, date: null };
  const parts = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  };
  if (precision === 'month') Object.assign(parts, { day: 1, hour: 0, minute: 0, second: 0 });
  if (precision === 'date') Object.assign(parts, { hour: 0, minute: 0, second: 0 });
  if (precision === 'hour') Object.assign(parts, { minute: 0, second: 0 });
  if (precision === 'minute') parts.second = 0;
  return { value: dateToTimeValue(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second), precision, date: parts };
}

function makeRange(startToken, endToken, raw, openEnd = false) {
  const reversed = startToken.value > endToken.value;
  const start = reversed ? endToken : startToken;
  const end = reversed ? startToken : endToken;
  return {
    raw,
    start: start.value,
    end: end.value,
    startPrecision: start.precision,
    endPrecision: end.precision,
    startDate: start.date,
    endDate: end.date,
    reversed,
    openEnd,
  };
}

export function parseTimeExpression(value, options = {}) {
  const text = normalizeInput(value);
  if (!text) return null;
  const single = parseTimeToken(text);
  if (single) return makeRange(single, single, text);

  // A date-like token that failed validation must not be mistaken for a hyphen range.
  if (/^\d{1,9}[/-]\d{1,2}(?:[/-]\d{1,2}(?:[T\s]+\d{1,2}(?::\d{1,2}(?::\d{1,2})?)?)?)?$/.test(text)) return null;

  const clock = '(?:[T\\s]+\\d{1,2}(?::\\d{1,2}(?::\\d{1,2})?)?)';
  const date = `(?:\\d{1,9}[/-]\\d{1,2}(?:[/-]\\d{1,2}(?:${clock})?)?)`;
  const year = '(?:-?\\d+|\\d+\\s*(?:BC|BCE|AD|CE)|(?:公元)?前\\s*\\d+|公元\\s*\\d+)';
  const token = `(?:${date}|${year})`;
  const match = text.match(new RegExp(`^\\s*(${token})\\s*(?:~|–|—|－|-|〜|～|至|到)\\s*(${token})?\\s*$`, 'i'));
  if (!match) return null;
  const start = parseTimeToken(match[1]);
  if (!start) return null;
  const openEnd = !match[2];
  const end = openEnd ? currentToken(start.precision, options.now) : parseTimeToken(match[2]);
  if (!end) return null;
  return makeRange(start, end, text, openEnd);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function padYear(value) {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(value));
  return sign + (digits.length < 4 ? digits.padStart(4, '0') : digits);
}

export function formatYear(value, options = {}) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const compact = options.compact !== false;
  let body = String(abs);
  if (compact && abs >= 1e8) body = `${Number((abs / 1e8).toFixed(2))}亿`;
  else if (compact && abs >= 1e4) body = `${Number((abs / 1e4).toFixed(2))}万`;
  return rounded < 0 ? `${body} BCE` : body;
}

export function formatTimeValue(value, precision = 'year', dateParts = null, options = {}) {
  if (precision === 'year') return formatYear(value, options);
  const parts = dateParts || timeValueToDateParts(value);
  const month = `${padYear(parts.year)}-${pad2(parts.month)}`;
  if (precision === 'month') return month;
  const date = `${month}-${pad2(parts.day)}`;
  if (precision === 'date') return date;
  const hour = `${date} ${pad2(parts.hour)}:00`;
  if (precision === 'hour') return hour;
  const minute = `${date} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
  if (precision === 'minute') return minute;
  return `${minute}:${pad2(parts.second)}`;
}

export function formatTimeRange(event, options = {}) {
  const start = formatTimeValue(event.start, event.startPrecision, event.startDate, options);
  const end = formatTimeValue(event.end, event.endPrecision, event.endDate, options);
  return Math.abs(event.start - event.end) <= TIME_EPSILON ? start : `${start}~${end}`;
}

export function formatSpan(span) {
  const years = Math.abs(span);
  if (!Number.isFinite(years)) return '未知';
  if (years >= 1e9) return `${Number((years / 1e9).toFixed(2))} 十亿年`;
  if (years >= 1e8) return `${Number((years / 1e8).toFixed(2))} 亿年`;
  if (years >= 1e4) return `${Number((years / 1e4).toFixed(2))} 万年`;
  if (years >= 1) return `${Number(years.toFixed(2))} 年`;
  const days = years * 365.2425;
  if (days >= 1) return `${Number(days.toFixed(2))} 天`;
  const hours = days * 24;
  if (hours >= 1) return `${Number(hours.toFixed(2))} 小时`;
  const minutes = hours * 60;
  if (minutes >= 1) return `${Number(minutes.toFixed(2))} 分钟`;
  return `${Number((minutes * 60).toFixed(2))} 秒`;
}

export function precisionRank(precision) {
  return { year: 1, month: 2, date: 3, hour: 4, minute: 5, second: 6 }[precision] || 0;
}

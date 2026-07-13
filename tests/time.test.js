import test from 'node:test';
import assert from 'node:assert/strict';
import { dateToTimeValue, formatTimeRange, parseTimeExpression } from '../src/time.js';

test('解析正负年份与 BCE/中文公元前', () => {
  assert.equal(parseTimeExpression('2024').start, 2024);
  assert.equal(parseTimeExpression('-221').start, -221);
  assert.equal(parseTimeExpression('221 BCE').start, -220);
  assert.equal(parseTimeExpression('公元前221').start, -220);
  assert.equal(parseTimeExpression('221 CE').start, 221);
});

test('解析年份区间、日期区间和反向区间', () => {
  assert.deepEqual([parseTimeExpression('960~1127').start, parseTimeExpression('960~1127').end], [960, 1127]);
  const dates = parseTimeExpression('1914-07-28~1918-11-11');
  assert.equal(dates.startPrecision, 'date');
  assert.ok(dates.end > dates.start);
  const reversed = parseTimeExpression('1127~960');
  assert.equal(reversed.reversed, true);
  assert.deepEqual([reversed.start, reversed.end], [960, 1127]);
});

test('解析年月日、时分秒与开区间', () => {
  assert.equal(parseTimeExpression('1949-10').startPrecision, 'month');
  assert.equal(parseTimeExpression('1949-10-01').startPrecision, 'date');
  assert.equal(parseTimeExpression('1969-07-20 20:17').startPrecision, 'minute');
  assert.equal(parseTimeExpression('1969-07-20T20:17:40').startPrecision, 'second');
  const open = parseTimeExpression('1949-10-01~', { now: new Date('2020-04-05T06:07:08Z') });
  assert.equal(open.openEnd, true);
  assert.equal(open.endPrecision, 'date');
});

test('拒绝无效日期和时钟', () => {
  assert.equal(parseTimeExpression('2021-02-29'), null);
  assert.equal(parseTimeExpression('2020-13-01'), null);
  assert.equal(parseTimeExpression('2020-02-02 24:00'), null);
});

test('支持极大年份与精确格式化', () => {
  assert.equal(parseTimeExpression('-13800000000~-13700000000').start, -13800000000);
  const date = parseTimeExpression('1969-07-20 20:17:40');
  assert.equal(formatTimeRange(date, { compact: false }), '1969-07-20 20:17:40');
  assert.ok(dateToTimeValue(2020, 3, 1) > 2020);
});

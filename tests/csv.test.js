import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimelineCSV, serializeTimelineCSV } from '../src/csv.js';

test('解析表头、注释、BOM、CRLF 与标准两列', () => {
  const text = '\ufefftime,title\r\n# note\r\n960~1127,北宋\r\n\r\n';
  const { events, report } = parseTimelineCSV(text, { layerId: 'song', layerName: '宋代' });
  assert.equal(events.length, 1);
  assert.equal(events[0].title, '北宋');
  assert.equal(report.ignoredComments, 1);
  assert.ok(report.ignoredBlank >= 1);
});

test('解析标题中的逗号和转义双引号', () => {
  const { events } = parseTimelineCSV('1942,"《春望》, 杜甫"\n1967,"论文 ""Medium"" 出版"', { layerId: 'l', layerName: 'L' });
  assert.equal(events[0].title, '《春望》, 杜甫');
  assert.equal(events[1].title, '论文 "Medium" 出版');
});

test('坏行不阻断有效行且问题不会静默', () => {
  const { events, report } = parseTimelineCSV('bad,A\n2000,\n2010~2000,反向\n2001,B', { layerId: 'l', layerName: 'L' });
  assert.equal(events.length, 3);
  assert.ok(report.issues.some((entry) => entry.type === 'invalid_date' && entry.line === 1));
  assert.ok(report.issues.some((entry) => entry.type === 'empty_title'));
  assert.ok(report.issues.some((entry) => entry.type === 'reversed_interval'));
});

test('检测未闭合引号、额外列和重复事件', () => {
  const { events, report } = parseTimelineCSV('2000,"bad\n2001,A,B\n2002,C\n2002,C', { layerId: 'l', layerName: 'L' });
  assert.equal(events.length, 3);
  assert.ok(report.issues.some((entry) => entry.type === 'quote'));
  assert.ok(report.issues.some((entry) => entry.type === 'comma'));
  assert.ok(report.issues.some((entry) => entry.type === 'duplicate_event'));
  assert.notEqual(events[1].id, events[2].id);
});

test('导出后可重新解析且仍为严格两列', () => {
  const original = parseTimelineCSV('time,title\n2000,"A,B"', { layerId: 'l', layerName: 'L' }).events;
  const csv = serializeTimelineCSV(original);
  const next = parseTimelineCSV(csv, { layerId: 'l', layerName: 'L' }).events;
  assert.equal(next[0].title, 'A,B');
  assert.equal(csv.split('\r\n')[0], 'time,title');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV } = require('../csv.js');

test('CSV: quoted multiline titles remain a single event', () => {
  const rows = parseCSV('time,title\n1037~1101,"苏轼,\n字子瞻"\n1066,回归', '人物');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, '苏轼,\n字子瞻');
  assert.equal(rows[1].sourceLine, 4);
  assert.ok(rows.every(row => row.layer === '人物'));
});
test('CSV: BOM, CRLF, escaped quotes and Chinese text survive import', () => {
  const rows = parseCSV('\uFEFFtime,title\r\n1066,"中国, \"\"星孛\"\" ☄"\r\n');
  assert.equal(rows[0].title, '中国, "星孛" ☄');
  assert.equal(rows.length, 1);
});
test('CSV: quotes in comments do not consume later records', () => {
  const rows = parseCSV('# unmatched "quote\n  # another "comment\n1066,彗星');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceLine, 3);
});
test('CSV: # inside a quoted title is data', () => {
  const rows = parseCSV('1066,"first line\n# second line"');
  assert.equal(rows[0].title, 'first line\n# second line');
});
test('CSV: unclosed quotes report their starting line', () => {
  assert.throws(() => parseCSV('time,title\n1066,"first\nsecond'), /第 2 行/);
});
test('CSV: optional header, blank lines and comments are not event rows', () => {
  const rows = parseCSV('\n# source\nTIME,TITLE\n\n1066,彗星\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time, '1066');
});
test('CSV: existing two-column and unquoted comma conventions remain supported', () => {
  const rows = parseCSV('1037~1101,Su Shi, poet\n1066,');
  assert.equal(rows[0].title, 'Su Shi,poet');
  assert.equal(rows[1].title, '');
});
test('CSV: a large pasted file preserves the first and last records', () => {
  const rows = parseCSV(Array.from({ length: 10000 }, (_, i) => `${i},Event ${i}`).join('\n'));
  assert.equal(rows.length, 10000);
  assert.equal(rows[9999].title, 'Event 9999');
});

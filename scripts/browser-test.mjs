import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createZip } from '../src/zip.js';

const require = createRequire(import.meta.url);
const bundledCore = process.env.PLAYWRIGHT_CORE_PATH
  || path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', '.pnpm', 'node_modules', 'playwright-core');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try { ({ chromium } = require(bundledCore)); }
  catch { throw new Error('未找到 Playwright。请安装 playwright，或设置 PLAYWRIGHT_CORE_PATH。'); }
}

const baseURL = process.argv[2] || process.env.SHOWTIME_BASE_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : '/usr/bin/google-chrome');
const browser = await chromium.launch({ headless: true, executablePath });
const consoleErrors = [];

async function watch(page) {
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
}

const temp = await mkdtemp(path.join(os.tmpdir(), 'showtime-browser-'));
const legacyZip = path.join(temp, 'legacy.zip');
await writeFile(legacyZip, createZip([
  { name: '02_context.csv', data: 'time,title\n1069~1085,王安石变法' },
  { name: '01_main.csv', data: 'time,title\n1079,乌台诗案' },
]));

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(12000);
  await watch(page);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  if (!await page.evaluate(() => Boolean(window.__SHOWTIME__))) {
    console.error(`Loaded ${page.url()} · ${await page.title()} · scripts=${await page.locator('script').count()} · body=${(await page.locator('body').innerText()).slice(0, 160)}`);
  }
  await page.waitForFunction(() => Boolean(window.__SHOWTIME__));
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.selfTests?.passed), true);
  assert.equal(await page.locator('h1#project-name').isVisible(), true);

  await page.locator('#project-menu > summary').click();
  await page.getByRole('button', { name: '打开“苏轼与北宋背景”' }).click();
  await page.waitForFunction(() => window.__SHOWTIME__.workspace.name === '苏轼与北宋背景');
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.workspace.layers.length), 6);
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.workspace.views.length), 2);

  const viewBeforeSearch = await page.evaluate(() => ({ ...window.__SHOWTIME__.workspace.view }));
  await page.locator('#global-search').fill('乌台诗案');
  await page.waitForFunction(() => document.querySelectorAll('#search-results .result-item').length > 0);
  await page.locator('#search-results .result-item').first().click();
  assert.match(await page.locator('#event-details').innerText(), /乌台诗案/);

  await page.locator('#global-search').fill('');
  await page.waitForFunction((expected) => {
    const view = window.__SHOWTIME__.workspace.view;
    return view.start === expected.start && view.end === expected.end;
  }, viewBeforeSearch);
  const canvas = page.locator('#timeline-canvas');
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width * 0.55, y: 80 } });
  await page.locator('[data-action="add-second-probe"]').click();
  await canvas.click({ position: { x: box.width * 0.68, y: 90 } });
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.workspace.probes.length), 2);
  assert.match(await page.locator('#probe-results').innerText(), /两个时点比较/);

  await page.locator('#data-files').setInputFiles({
    name: 'single.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('time,title\n1080,单文件导入事件'),
  });
  await page.waitForFunction(() => window.__SHOWTIME__.workspace.layers.length >= 7);
  await page.locator('#data-files').setInputFiles([
    { name: 'multi-a.csv', mimeType: 'text/csv', buffer: Buffer.from('time,title\n1081,多文件甲') },
    { name: 'multi-b.csv', mimeType: 'text/csv', buffer: Buffer.from('time,title\n1082,多文件乙') },
  ]);
  await page.waitForFunction(() => window.__SHOWTIME__.workspace.layers.length >= 9);
  await page.locator('#data-files').setInputFiles(legacyZip);
  await page.waitForFunction(() => window.__SHOWTIME__.workspace.layers.length >= 11);
  assert.match(await page.locator('#quality-results').innerText(), /成功事件/);

  await page.locator('#project-menu > summary').click();
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  await page.waitForFunction(() => /保存/.test(document.querySelector('#autosave-status').textContent));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__SHOWTIME__?.workspace?.layers?.length >= 11);
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.workspace.name), '苏轼与北宋背景');
  assert.equal(await page.evaluate(() => window.__SHOWTIME__.selfTests?.passed), true);

  const [projectDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => document.querySelector('[data-action="export-project"]').click()),
  ]);
  assert.match(projectDownload.suggestedFilename(), /\.showtime\.zip$/);
  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => document.querySelector('[data-action="export-svg"]').click()),
  ]);
  assert.match(svgDownload.suggestedFilename(), /\.svg$/);
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => document.querySelector('[data-action="export-png"]').click()),
  ]);
  assert.match(pngDownload.suggestedFilename(), /\.png$/);

  await page.getByText('分析', { exact: true }).first().click();
  await page.getByRole('button', { name: '统计全部可见图层' }).click();
  assert.match(await page.locator('#analysis-results').innerText(), /事件记录/);
  if (process.argv[3]) await page.screenshot({ path: path.resolve(process.argv[3]), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  mobile.setDefaultTimeout(12000);
  await watch(mobile);
  await mobile.goto(baseURL, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => Boolean(window.__SHOWTIME__));
  assert.equal(await mobile.locator('#global-search').isVisible(), true);
  assert.equal(await mobile.locator('#timeline-canvas').isVisible(), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.equal(await mobile.evaluate(() => document.body.classList.contains('left-collapsed') && document.body.classList.contains('right-collapsed')), true);
  if (process.argv[4]) await mobile.screenshot({ path: path.resolve(process.argv[4]), fullPage: true });
  await mobile.locator('.panel-toggle.left').click();
  assert.equal(await mobile.evaluate(() => !document.body.classList.contains('left-collapsed') && document.body.classList.contains('right-collapsed')), true);
  await mobile.locator('.panel-toggle.left').click();
  await mobile.locator('.panel-toggle.right').click();
  assert.equal(await mobile.evaluate(() => document.body.classList.contains('left-collapsed') && !document.body.classList.contains('right-collapsed')), true);
  await mobile.locator('.panel-toggle.right').click();
  await mobile.close();
  await page.close();

  assert.deepEqual(consoleErrors, []);
  console.log('Browser verification passed: desktop full/single/multi/legacy import, search, probes, IndexedDB restore, PNG/SVG/project export, statistics, self-tests and mobile layout.');
} catch (error) {
  if (consoleErrors.length) console.error(consoleErrors.join('\n'));
  throw error;
} finally {
  await browser.close();
}

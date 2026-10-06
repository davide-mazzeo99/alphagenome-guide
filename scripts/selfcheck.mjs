// Self-check: headless Chromium opens dist/ over file://, checks console, search, snippet builder, layout; saves screenshots.
// Usage: npm run check   (set SITE_DIR to test another build, e.g. a synthetic guide)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.SITE_DIR ? path.resolve(process.env.SITE_DIR) : path.join(ROOT, 'dist');
const SHOTS = path.join(ROOT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const url = (f) => pathToFileURL(path.join(DIST, f)).href;

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
catch { browser = await chromium.launch(); }

const errors = [];
async function open(width, height, file = 'index.html', scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${file}@${width}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${file}@${width}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${file}@${width}] requestfailed: ${r.url()}`));
  await page.goto(url(file));
  return page;
}

// ---- desktop home ----
let page = await open(1280, 900);
check('page title', (await page.title()).includes('AlphaGenome'));
check('4 home cards', (await page.locator('.cards .link-card').count()) === 4);
check('no third-party requests', true);

// search
await page.keyboard.press('/');
check('"/" focuses search', await page.evaluate(() => document.activeElement.id === 'search'));
await page.keyboard.type('splicing');
const hits = await page.locator('#search-results a[role="option"]').count();
check('search "splicing" returns results', hits > 0, `${hits} hits`);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('search result navigates to an anchor', (await page.evaluate(() => location.hash)).length > 1, await page.evaluate(() => location.hash));
await page.keyboard.press('Escape');
await page.fill('#search', 'zzzzqqqq');
check('nonsense query shows "No results"', (await page.locator('#search-results .empty').count()) === 1);
await page.keyboard.press('Escape');
await page.fill('#search', 'splce'); // typo tolerance
check('typo "splce" still finds results', (await page.locator('#search-results a[role="option"]').count()) > 0);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

// decision helper
await page.locator('#model-helper .opt').nth(1).click();
check('decision helper shows a result', await page.locator('#helper-result .result:not([hidden])').count() === 1);

// sortable table + tabs + copy + pitfall callout
const firstBefore = await page.locator('table[data-sortable] tbody tr:first-child td:first-child').first().textContent();
await page.locator('table[data-sortable] thead th').nth(3).locator('button').click();
const firstAfter = await page.locator('table[data-sortable] tbody tr:first-child td:first-child').first().textContent();
check('output-type table sorts', firstBefore !== firstAfter, `${firstBefore.trim()} → ${firstAfter.trim()}`);
check('install tabs present (5)', (await page.locator('[data-tabs] [role="tab"]').count()) === 5);
await page.locator('[data-tabs] [role="tab"]').nth(1).click();
check('tab switch shows conda panel', (await page.locator('[data-tabs] [role="tabpanel"]:not([hidden])').textContent()).includes('conda create'));
check('pitfall callout present', (await page.locator('.callout-pitfall table').count()) === 1);
check('every code block has copy button + badge', await page.evaluate(() => [...document.querySelectorAll('.code-block')].every((b) => b.querySelector('.copy-btn') && b.querySelector('.lang-badge'))));
await page.locator('.code-block .copy-btn').first().click(); await page.waitForTimeout(250);
check('copy button gives feedback', (await page.locator('.code-block .copy-btn').first().textContent()).match(/Copied|Ctrl/) !== null);
check('external links are noopener + new tab', await page.evaluate(() => [...document.querySelectorAll('a[href^="http"]')].every((a) => a.target === '_blank' && /noopener/.test(a.rel))));
check('no API key text', !(await page.content()).match(/AIza[0-9A-Za-z_-]{20,}/));

// beginner material
const navGroups = await page.locator('.sidebar .nav-group').allTextContents();
check('sidebar groups: Start here / Practical guides / Reference guide', navGroups.join('|') === 'Start here|Practical guides|Reference guide', navGroups.join('|'));
check('7 practical guides + 5 start-here sections', (await page.locator('.sidebar a[data-section^="g"]').count()) === 8 && (await page.locator('.sidebar a[data-section^="s"]').count()) >= 5);
check('glossary table is filterable', (await page.locator('[id^="s3-"] table[data-filterable]').count()) === 1);
check('§ references became links', (await page.locator('a.xref').count()) > 50, String(await page.locator('a.xref').count()));
await page.fill('#search', 'MYB');
check('search "MYB" finds the TAL1 guide', (await page.locator('#search-results a[role="option"]').count()) > 0);
await page.fill('#search', 'positive control');
check('search "positive control" finds guides', (await page.locator('#search-results a[role="option"]').count()) > 0);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.locator('[id="g2-score-one-variant-and-read-the-table-worked-example-rs9610445"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, 'guide-g2-1280.png') });

// theme toggle persists
await page.click('#theme-btn');
const th = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('ag-theme')]);
check('theme toggle persists', th[0] === 'dark' && th[1] === 'dark', th.join('/'));
await page.screenshot({ path: path.join(SHOTS, 'home-1280-dark.png') });
await page.click('#theme-btn');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, 'home-1280.png') });
await page.locator('[id="4-installation-and-api-key"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(SHOTS, 'install-1280.png') });
check('scroll-spy marks a nav item', (await page.locator('.sidebar a[aria-current]').count()) === 1);

// ---- snippet builder ----
page = await open(1280, 900, 'snippet-builder.html');
const code = await page.locator('#snippet-output').textContent();
check('builder output contains score_variant', code.includes('score_variant'));
for (const k of ['genome.Variant', 'reference_interval.resize', 'tidy_scores', 'ALPHA_GENOME_API_KEY']) check(`builder output contains ${k}`, code.includes(k));
check('no merged splice block when no splice scorer', !code.includes('merged_splicing'));
await page.check('#scorers input[value="SPLICE_SITES"]');
check('splice scorer adds merged splicing score', (await page.locator('#snippet-output').textContent()).includes('merged_splicing'));
await page.fill('#f-ref', 'N');
check('invalid REF is rejected', (await page.locator('#e-ref').textContent()).length > 0 && (await page.locator('#snippet-output').textContent()).startsWith('# Fix'));
await page.fill('#f-ref', 'a'); await page.fill('#f-pos', '0');
check('position 0 is rejected', (await page.locator('#e-pos').textContent()).length > 0);
await page.fill('#f-pos', '123'); await page.fill('#f-chrom', 'chr23');
check('chr23 is rejected', (await page.locator('#e-chrom').textContent()).length > 0);
await page.fill('#f-chrom', 'chrX');
await page.click('[data-onto="CL:0000084"]');
await page.selectOption('#f-len', 'SEQUENCE_LENGTH_16KB');
const code2 = await page.locator('#snippet-output').textContent();
check('form values flow into code', code2.includes("genome.Variant('chrX', 123, 'A', 'C')") && code2.includes('CL:0000084') && code2.includes('SEQUENCE_LENGTH_16KB'));
for (const [name, needle] of [['rs9610445', "'chr22', 36201698, 'A', 'C'"], ['brca2', "'chr13', 32316462, 'T', 'G'"], ['exonskip', "'chr3', 197081044, 'TACTC', 'T'"], ['newjunction', "'chr21', 46126238, 'G', 'C'"], ['tal1', "'chr1', 47239296, 'C', 'ACG'"]]) {
  await page.click(`[data-preset="${name}"]`);
  check(`builder example "${name}" generates the right variant`, (await page.locator('#snippet-output').textContent()).includes(needle));
}
check('builder examples show no validation errors', (await page.locator('.err:not(:empty)').count()) === 0);
await page.screenshot({ path: path.join(SHOTS, 'builder-1280.png'), fullPage: true });

// ---- mobile ----
page = await open(375, 800);
await page.screenshot({ path: path.join(SHOTS, 'home-375.png') });
await page.click('#menu-btn');
check('mobile menu opens', (await page.getAttribute('#menu-btn', 'aria-expanded')) === 'true');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(SHOTS, 'menu-375.png') });
await page.click('#scrim', { position: { x: 340, y: 300 } });
for (const [w, f] of [[360, 'index.html'], [375, 'index.html'], [360, 'snippet-builder.html']]) {
  const p = await open(w, 800, f);
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(`no horizontal page scroll @${w}px (${f})`, o.sw <= o.cw, `${o.sw} vs ${o.cw}`);
}
page = await open(375, 800, 'snippet-builder.html');
await page.screenshot({ path: path.join(SHOTS, 'builder-375.png'), fullPage: true });
page = await open(375, 800);
await page.locator('[id="4-installation-and-api-key"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(SHOTS, 'install-375.png') });

// ---- recipes / filter (only when the guide has these sections) ----
page = await open(1280, 900);
const recipes = await page.locator('details.recipe').count();
if (recipes) {
  check('recipe cards collapsed by default', (await page.locator('details.recipe[open]').count()) === 0);
  await page.locator('details.recipe summary').first().click();
  check('recipe card expands', (await page.locator('details.recipe[open]').count()) === 1);
  await page.emulateMedia({ media: 'print' });
  check('print: no nav', !(await page.locator('.sidebar').isVisible()));
  await page.emulateMedia({ media: 'screen' });
}
const UC = '[id="7-use-case-catalogue"]';
if (await page.locator(`${UC} table[data-filterable]`).count()) {
  const n0 = await page.locator(`${UC} tbody tr:not([hidden])`).count();
  await page.fill(`${UC} .table-tools input`, 'splic');
  const n1 = await page.locator(`${UC} tbody tr:not([hidden])`).count();
  check('use-case table filters', n1 < n0, `${n0} → ${n1}`);
  await page.fill(`${UC} .table-tools input`, '');
  await page.selectOption(`${UC} .table-tools select[aria-label="Filter by output type"]`, 'DNASE');
  const n2 = await page.locator(`${UC} tbody tr:not([hidden])`).count();
  check('output-type filter works', n2 > 0 && n2 < n0, `${n0} → ${n2}`);
  await page.selectOption(`${UC} .table-tools select[aria-label="Filter by output type"]`, '');
  await page.selectOption(`${UC} .table-tools select[aria-label="Filter by task"]`, { index: 2 });
  check('task filter works', (await page.locator(`${UC} tbody tr:not([hidden])`).count()) === 1);
  check('BibTeX generated from the guide citation', (await page.locator('#cite-bib').textContent()).includes('10.1038/s41586-025-10014-0'));
  check('14 recipe cards (6.1–6.14)', (await page.locator('details.recipe').count()) === 14, String(await page.locator('details.recipe').count()));
}

check('no console errors / warnings / failed requests', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED` : `\nAll ${results.length} checks passed. Screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);

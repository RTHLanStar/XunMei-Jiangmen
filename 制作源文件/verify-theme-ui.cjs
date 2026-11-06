/* Theme, token and layout acceptance checks for the nine static pages.
   Serves site/dist over HTTP, drives Chromium through the shared runtime
   helper, and writes a JSON report. No uploads, no installs, no downloads. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'site', 'dist');
const OUT = path.join(ROOT, '材料', '主题与视觉验收');
const { chromium, executablePath } = require('./browser-runtime.cjs');

const PAGES = ['index', 'stories', 'letters', 'about', 'travel', 'food', 'routes', 'faq', 'tour'];
const WIDTHS = [320, 375, 768, 1280, 1440];
const PRINT_WHITELIST = new Set(['#fff', '#111', '#888', '#eee']);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function serve() {
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
      const file = path.resolve(DIST, '.' + pathname);
      if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(400); res.end(); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const failures = [];
const report = { checkedAt: new Date().toISOString(), engine: 'Chromium via browser-runtime.cjs', checks: [] };

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) failures.push(name + (detail ? ' :: ' + JSON.stringify(detail) : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' :: ' + JSON.stringify(detail)));
}

function hexes(css) {
  return new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(h => h.toLowerCase()));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const parseRgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

async function main() {
  // ---- static: token convergence -------------------------------------------------
  const tokensCss = fs.readFileSync(path.join(DIST, 'tokens.css'), 'utf8');
  const bundleCss = fs.readFileSync(path.join(DIST, 'site.css'), 'utf8');
  const allowed = hexes(tokensCss);
  const stray = [...hexes(bundleCss)].filter(h => !allowed.has(h) && !PRINT_WHITELIST.has(h));
  check('token-convergence:no-stray-hex', stray.length === 0, { stray });
  check('token-convergence:gold-in-use', (bundleCss.match(/var\(--gold\)/g) || []).length >= 1);
  check('token-convergence:no-duplicate-sans', (bundleCss.match(/--sans\s*:/g) || []).length === 1);
  check('token-convergence:no-duplicate-serif', (bundleCss.match(/--serif\s*:/g) || []).length === 1);
  check('token-convergence:no-duplicate-orange', (bundleCss.match(/--orange\s*:/g) || []).length === 3,
    { note: 'light + dark override + print override only' });
  check('token-convergence:dark-block-present', /:root\[data-theme="dark"\]/.test(bundleCss));
  for (const name of PAGES) {
    const html = fs.readFileSync(path.join(DIST, name + '.html'), 'utf8');
    const linkAt = html.indexOf('site-');
    const bootAt = html.indexOf('data-theme-source');
    check(`head-order:${name}:theme-before-css`, bootAt > -1 && linkAt > -1 && bootAt < linkAt, { bootAt, linkAt });
    check(`head-order:${name}:single-theme-color-meta`, (html.match(/id="theme-color"/g) || []).length === 1);
    check(`head-order:${name}:toggle-present`, html.includes('data-theme-toggle'));
  }

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath, args: ['--force-color-profile=srgb'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];

  try {
    // ---- theme resolution ---------------------------------------------------------
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`${scheme}:${e.message}`));
      await page.goto(`${base}/index.html`, { waitUntil: 'load' });
      const state = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        source: document.documentElement.dataset.themeSource,
        bg: getComputedStyle(document.body).backgroundColor
      }));
      check(`theme:auto-${scheme}`, state.theme === scheme && state.source === 'auto', state);
      const expected = scheme === 'dark' ? 'rgb(20, 28, 26)' : 'rgb(245, 240, 230)';
      check(`theme:auto-${scheme}-background`, state.bg === expected, { got: state.bg, expected });
      const meta = await page.getAttribute('#theme-color', 'content');
      check(`theme:auto-${scheme}-meta`, meta === (scheme === 'dark' ? '#0f2824' : '#183d36'), { meta });
      await ctx.close();
    }

    // ---- three-state cycle and persistence ----------------------------------------
    const page = await context.newPage();
    page.on('pageerror', e => errors.push('cycle:' + e.message));
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    const seen = [];
    for (let i = 0; i < 3; i += 1) {
      await page.click('[data-theme-toggle]');
      seen.push(await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        source: document.documentElement.dataset.themeSource,
        stored: localStorage.getItem('jiangmen-theme'),
        label: document.querySelector('[data-theme-toggle]').getAttribute('aria-label')
      })));
    }
    check('theme:cycle-returns-to-auto', seen[2].source === 'auto' && seen[2].stored === null, seen);
    check('theme:cycle-labels-differ', new Set(seen.map(s => s.label)).size === 3, seen.map(s => s.label));

    // explicit dark must survive navigation
    await page.click('[data-theme-toggle]');
    const explicit = await page.evaluate(() => document.documentElement.dataset.themeSource);
    await page.goto(`${base}/travel.html`, { waitUntil: 'load' });
    const afterNav = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      source: document.documentElement.dataset.themeSource
    }));
    check('theme:persists-across-pages', afterNav.source === explicit && afterNav.theme === explicit, { explicit, afterNav });

    // ---- contrast in both palettes -----------------------------------------------
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
      const p = await ctx.newPage();
      await p.goto(`${base}/travel.html`, { waitUntil: 'load' });
      const samples = await p.evaluate(() => {
        const rgb = sel => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).color : null;
        };
        const bg = sel => {
          const el = document.querySelector(sel);
          return el ? getComputedStyle(el).backgroundColor : null;
        };
        return {
          body: getComputedStyle(document.body).backgroundColor,
          h1: rgb('h1'),
          lead: rgb('.page-lead'),
          cardTitle: rgb('.guide-card h2'),
          cardMeta: rgb('.card-meta'),
          link: rgb('.card-actions a'),
          cardBg: bg('.guide-card'),
          orange: rgb('.card-index')
        };
      });
      const toArr = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const body = toArr(samples.body);
      const pairs = [
        ['h1', samples.h1, 4.5], ['lead', samples.lead, 4.5],
        ['card-title', samples.cardTitle, 4.5], ['card-meta', samples.cardMeta, 4.5],
        ['link', samples.link, 4.5], ['orange-index', samples.orange, 4.5]
      ];
      const results = pairs.map(([label, value, min]) => {
        const ratio = contrast(toArr(value), body);
        return { label, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min };
      });
      check(`contrast:${scheme}`, results.every(r => r.ok), results);
      const cardRatio = contrast(toArr(samples.cardTitle), toArr(samples.cardBg));
      check(`contrast:${scheme}-card-surface`, cardRatio >= 4.5, { ratio: Math.round(cardRatio * 100) / 100 });
      await ctx.close();
    }

    // ---- print keeps paper and ink -------------------------------------------------
    await page.goto(`${base}/travel.html`, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      color: getComputedStyle(document.body).color
    }));
    check('print:paper-and-ink', printed.bg === 'rgb(255, 255, 255)' && printed.color === 'rgb(17, 17, 17)', printed);
    await page.emulateMedia({ media: 'screen' });

    // ---- layout: overflow, grid columns, header collision --------------------------
    const overflow = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of PAGES) {
        await page.goto(`${base}/${name}.html`, { waitUntil: 'load' });
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth
        }));
        if (m.scroll > m.client + 1) overflow.push({ page: name, width, ...m });
      }
    }
    check('layout:no-horizontal-overflow', overflow.length === 0, overflow);

    for (const [width, expected] of [[1440, 3], [1024, 2], [640, 1]]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/travel.html`, { waitUntil: 'load' });
      const columns = await page.evaluate(() => {
        const grid = document.querySelector('.guide-grid');
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      });
      check(`layout:guide-grid-columns-${width}`, columns === expected, { got: columns, expected });
    }

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`${base}/index.html`, { waitUntil: 'load' });
    const header = await page.evaluate(() => {
      const brand = document.querySelector('.site-header .brand').getBoundingClientRect();
      const toggle = document.querySelector('[data-theme-toggle]').getBoundingClientRect();
      return { brandRight: Math.round(brand.right), toggleLeft: Math.round(toggle.left), toggleWidth: Math.round(toggle.width) };
    });
    check('layout:header-toggle-no-overlap-320', header.brandRight <= header.toggleLeft, header);
    check('layout:toggle-touch-target', header.toggleWidth >= 44, header);

    // ---- heading scale is consistent across pages ---------------------------------
    await page.setViewportSize({ width: 1280, height: 900 });
    const h1s = {};
    for (const name of PAGES) {
      await page.goto(`${base}/${name}.html`, { waitUntil: 'load' });
      const size = await page.evaluate(() => {
        const el = document.querySelector('h1');
        return el ? getComputedStyle(el).fontSize : null;
      });
      h1s[name] = size;
    }
    check('layout:h1-consistent', new Set(Object.values(h1s)).size === 1, h1s);

    check('runtime:no-page-errors', errors.length === 0, errors);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
  }

  report.passed = failures.length === 0;
  report.failures = failures;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, '主题与视觉验证.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\n' + (report.passed ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED'));
  process.exit(report.passed ? 0 : 1);
}

main().catch(error => { console.error(error); process.exit(1); });

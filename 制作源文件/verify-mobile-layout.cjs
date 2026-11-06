/* Mobile geometry regression. Uses an actual mobile viewport, not innerWidth:
   mobile browsers can enlarge innerWidth together with overflowing content. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), assert = require('assert');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'site/dist');
const out = path.join(root, '材料/手机布局回归'); fs.mkdirSync(out, { recursive: true });
const red = process.argv.includes('--red');
const report = { checkedAt: new Date().toISOString(), engine: 'Chromium mobile emulation; not a real WeChat engine', checks: [], failures: [] };
const oldCss = fs.readFileSync(path.join(__dirname, 'fixtures/legacy-site.css'), 'utf8');
const mime = { '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  const relative = pathname.startsWith('/v2.2/') ? pathname.slice(6) : pathname.slice(1);
  const file = path.resolve(dist, relative || 'index.html');
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
function measure() {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  return {
    viewport: { inner: innerWidth, client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
    photos: [...document.querySelectorAll('.photo-window')].filter(w => w.getBoundingClientRect().width).map(w => {
      const img = w.querySelector('img'), figure = w.closest('figure'), card = w.closest('.guide-card,.route-card');
      return { id: card?.id || (w.closest('.guide-cover') ? 'cover' : 'daily-letter'), isCover: !!w.closest('.guide-cover'), window: box(w), image: box(img), figure: box(figure), card: card ? box(card) : null, loaded: img.complete && img.naturalWidth > 0 };
    })
  };
}
function checkGeometry(state, width, { ratio = true, loaded = false } = {}) {
  assert(state.viewport.client <= width + 1, `client width ${state.viewport.client} exceeds configured viewport ${width}`);
  assert(state.viewport.scroll <= width + 1, `document scrollWidth ${state.viewport.scroll} exceeds configured viewport ${width}; innerWidth=${state.viewport.inner}`);
  for (const p of state.photos) {
    for (const [label, r] of [['window', p.window], ['image', p.image], ['figure', p.figure]]) {
      assert(r.left >= -1 && r.right <= width + 1, `${p.id} ${label} escapes viewport: ${JSON.stringify(r)}`);
    }
    assert(p.window.height > 1, `${p.id} photo space collapsed`);
    assert(Math.abs(p.image.width - p.window.width) < 1 && Math.abs(p.image.height - p.window.height) < 1, `${p.id} image and photo window dimensions disagree`);
    assert(p.image.top >= p.window.top - 1 && p.image.bottom <= p.window.bottom + 1, `${p.id} image escapes photo window vertically`);
    assert(p.figure.bottom >= p.window.bottom - 1, `${p.id} image escapes its figure`);
    if (p.card) assert(p.figure.left >= p.card.left - 1 && p.figure.right <= p.card.right + 1 && p.figure.top >= p.card.top - 1 && p.figure.bottom <= p.card.bottom + 1, `${p.id} figure escapes card`);
    if (ratio) { const expected = width > 700 ? (p.isCover ? 4 / 3 : p.id === 'daily-letter' ? 3 / 2 : 16 / 10) : 16 / 10; assert(Math.abs(p.window.width / p.window.height - expected) < .015, `${p.id} photo aspect ${p.window.width / p.window.height} expected ${expected}`); }
    if (loaded) assert(p.loaded, `${p.id} photo did not load`);
  }
}
async function loadPhotos(page) {
  for (const image of await page.locator('.place-photo img').all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(img => img.complete ? undefined : new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Photo loading timeout')), 10000);
      img.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
    }));
  }
}
async function scenario(browser, base, file, width, dpr, mode) {
  const context = await browser.newContext({ viewport: { width, height: width > 700 ? 390 : 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(), entry = { file, width, dpr, mode }, errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let release; const pendingPhotos = new Promise(resolve => release = resolve);
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() === 'stylesheet' && mode === 'stale-css') return route.fulfill({ status: 200, contentType: 'text/css', body: oldCss });
    if (request.resourceType() === 'stylesheet' && mode === 'css-failed') return route.abort('failed');
    if (request.resourceType() === 'image' && /\/assets\/(travel|food)\//.test(request.url())) await pendingPhotos;
    return route.continue();
  });
  try {
    await page.goto(base + file + '.html', { waitUntil: 'domcontentloaded' });
    if (mode === 'text-200') await page.addStyleTag({ content: 'body {-webkit-text-size-adjust:200%!important;text-size-adjust:200%!important}' });
    if (mode === 'no-aspect-ratio') await page.addStyleTag({ content: '.photo-window {aspect-ratio:auto!important}' });
    entry.before = await page.evaluate(measure);
    checkGeometry(entry.before, width, { ratio: mode !== 'css-failed' && mode !== 'stale-css' });
    release(); await loadPhotos(page); await page.evaluate(() => document.fonts.ready);
    entry.after = await page.evaluate(measure);
    checkGeometry(entry.after, width, { ratio: mode !== 'css-failed' && mode !== 'stale-css', loaded: true });
    for (let i = 0; i < entry.before.photos.length; i++) assert(Math.abs(entry.before.photos[i].window.height - entry.after.photos[i].window.height) < 1, `${entry.after.photos[i].id} photo height shifts after loading`);
    assert.equal(errors.length, 0, errors.join('\n'));
    if ((width === 390 && dpr === 3 && ['travel', 'food'].includes(file)) || mode !== 'normal') {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `${file}-${width}-${dpr}-${mode}.png`) });
    }
    entry.passed = true;
  } catch (error) {
    entry.passed = false; entry.error = error.message;
    report.failures.push({ file, width, dpr, mode, error: error.message });
    release();
    await page.screenshot({ path: path.join(out, `FAIL-${file}-${width}-${dpr}-${mode}.png`) }).catch(() => {});
  } finally { release(); await context.close(); report.checks.push(entry); }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/v2.2/`;
  const browser = await chromium.launch({ executablePath });
  try {
    if (!red) for (const width of [320, 375, 390, 414, 430, 844]) for (const dpr of [2, 3]) for (const file of ['index', 'stories', 'letters', 'about', 'travel', 'food', 'routes', 'faq', 'tour']) await scenario(browser, base, file, width, dpr, 'normal');
    for (const file of ['travel', 'food', 'routes']) for (const mode of red ? ['stale-css', 'css-failed'] : ['text-200', 'no-aspect-ratio', 'stale-css', 'css-failed']) await scenario(browser, base, file, 390, 3, mode);
    report.passed = report.failures.length === 0;
    fs.writeFileSync(path.join(out, red ? '修复前红灯.json' : '验证结果.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, failures: report.failures }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

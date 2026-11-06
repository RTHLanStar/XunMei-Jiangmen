/* Browser verification for the photographic attraction page, served from a subdirectory. */
const { chromium } = require('C:/Users/QiuLiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'site/dist');
const out = path.join(root, '材料/旅行照片验证');
fs.mkdirSync(out, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, '材料/旅行照片/manifest.json'), 'utf8'));
const research = JSON.parse(fs.readFileSync(path.join(root, '材料/旅行内容研究-景点.json'), 'utf8'));
const report = { checkedAt: new Date().toISOString(), checks: [], errors: [], failed: [] };
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (!pathname.startsWith('/v2.2/')) { res.writeHead(404); return res.end('Wrong deployment prefix'); }
  const relative = pathname.slice('/v2.2/'.length) || 'index.html';
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function loadAllPhotos(page) {
  const images = page.locator('.place-photo img');
  for (let i = 0; i < await images.count(); i++) {
    const image = images.nth(i);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(img => img.complete && img.naturalWidth > 0 ? undefined : new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Photo load timed out: ' + img.src)), 10000);
      img.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
      img.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Photo failed: ' + img.src)); }, { once: true });
    }));
  }
}

async function checkRandomCover(page) {
  const cover = page.locator('.guide-cover');
  const id = await cover.getAttribute('data-photo-id');
  const photo = manifest.find(photo => photo.id === id);
  assert(photo, 'Cover must use a verified destination photograph');
  assert.equal(await cover.locator('img').getAttribute('src'), photo.src);
  assert.equal(await cover.locator('img').getAttribute('alt'), photo.alt);
  assert.equal(await cover.locator('figcaption a').getAttribute('href'), '#place-' + photo.id);
  assert.equal(await cover.locator('.cover-caption').innerText(), photo.caption);
  const credit = cover.locator('.photo-required-credit');
  assert.equal(await credit.isVisible(), Boolean(photo.required_credit));
  if (photo.required_credit) assert.equal(await credit.innerText(), photo.required_credit);
  assert.equal(await cover.locator('img').evaluate(img => getComputedStyle(img).objectFit), photo.preserve_full ? 'contain' : 'cover');
  return id;
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/v2.2/`;
  report.basePath = '/v2.2/';
  const browser = await chromium.launch({ executablePath: 'C:/Users/QiuLiang/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  try {
    assert(manifest.length > 0, 'Photo manifest must be nonempty');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.failed.push(response.url()); });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + 'travel.html', { waitUntil: 'networkidle' });
      await checkRandomCover(page);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('[name=q]').count(), 0, 'Attraction search field should be removed');
      assert.equal(await page.getByText('找景点', { exact: true }).count(), 0);
      assert.equal(await page.locator('.place-photo img').count(), manifest.length + 1, 'One cover and one image for every licensed photo record');
      const eager = page.locator('.guide-cover img');
      assert.equal(await eager.getAttribute('loading'), 'eager');
      assert.equal(await eager.getAttribute('fetchpriority'), 'high');
      const cardImages = page.locator('.guide-card .place-photo img');
      assert.deepEqual(await cardImages.evaluateAll(images => images.map(img => img.loading)), manifest.map(() => 'lazy'));
      await loadAllPhotos(page);
      assert(await page.evaluate(width => document.documentElement.clientWidth <= width + 1 && document.documentElement.scrollWidth <= width + 1, width), 'Page overflow at ' + width);
      const loaded = await page.locator('.place-photo img').evaluateAll(images => images.map(img => ({ src: img.getAttribute('src'), currentSrc: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, alt: img.alt, renderedWidth: img.getBoundingClientRect().width })));
      assert(loaded.every(img => img.loaded && img.alt.length > 4));
      assert(loaded.every(img => img.currentSrc.startsWith(locationOrigin(base) + '/v2.2/')), 'All responsive photos must resolve within the deployed subdirectory');
      await page.evaluate(() => scrollTo(0, 0));
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: path.join(out, `travel-photos-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(out, `travel-photos-first-screen-${width}.png`) });
        await page.locator('.guide-toolbar').scrollIntoViewIfNeeded();
        await page.evaluate(() => scrollTo(0, document.querySelector('.guide-toolbar').getBoundingClientRect().top + scrollY - 115));
        await page.screenshot({ path: path.join(out, `travel-photos-cards-${width}.png`) });
      }
      report.checks.push({ name: 'responsive-photos', width, noOverflow: true, photos: loaded });
    }

    const assetPaths = new Set();
    for (const photo of manifest) {
      const card = page.locator('#place-' + photo.id);
      const image = card.locator('.place-photo img');
      assert.equal(await image.getAttribute('alt'), photo.alt);
      const src = await image.getAttribute('src'), srcset = await image.getAttribute('srcset');
      assert.equal(src, photo.src);
      assert(srcset.includes(photo.small + ' 480w') && srcset.includes(photo.src + ' ' + photo.width + 'w'));
      assert(await image.getAttribute('sizes'));
      assert(Number(await image.getAttribute('width')) > 0 && Number(await image.getAttribute('height')) > 0, 'Photos reserve layout space');
      for (const local of [photo.src, photo.small]) {
        assert(!/^(?:https?:|\/|data:)/.test(local) && !local.includes('..'), 'Photo must use a relative local path');
        assert(fs.existsSync(path.join(dist, local)), 'Missing photo ' + local);
        assetPaths.add(new URL(local, base).pathname);
      }
      await card.locator('.source-details summary').click();
      if (photo.required_credit) {
        assert.equal(await card.locator('.photo-required-credit').innerText(), photo.required_credit);
        assert.equal(await card.locator('.photo-required-credit').evaluate(el => getComputedStyle(el).textAlign), 'center');
        assert.equal(await image.evaluate(img => getComputedStyle(img).objectFit), 'contain');
      }
      const credit = card.locator('.photo-credit');
      assert(await credit.isVisible());
      assert((await credit.innerText()).includes(photo.author));
      assert.equal(await credit.locator('a').nth(0).getAttribute('href'), photo.source_url);
      assert.equal(await credit.locator('a').nth(1).getAttribute('href'), photo.license_url);
      await card.locator('.source-details summary').click();
    }
    report.photoBytes = [...new Set(manifest.flatMap(photo => [photo.src, photo.small]))].reduce((total, file) => total + fs.statSync(path.join(dist, file)).size, 0);
    report.checks.push({ name: 'local-srcset-alt-reserved-size-source-and-license', passed: true });

    const coverIds = [];
    for (let i = 0; i < 6; i++) {
      await page.reload({ waitUntil: 'networkidle' });
      const id = await checkRandomCover(page);
      if (coverIds.length) assert.notEqual(id, coverIds.at(-1), 'Consecutive refreshes must not repeat the cover');
      coverIds.push(id);
    }
    const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
    await deniedContext.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw Error('Storage denied'); } }));
    const deniedPage = await deniedContext.newPage();
    await deniedPage.goto(base + 'travel.html', { waitUntil: 'networkidle' });
    await checkRandomCover(deniedPage);
    assert.equal(await deniedPage.locator('[data-guide-item]:visible').count(), research.places.length);
    await deniedContext.close();
    report.checks.push({ name: 'random-cover-six-refreshes-metadata-and-storage-denied', passed: true, coverIds });

    await page.goto(base + 'travel.html?area=' + encodeURIComponent('新会') + '#places');
    await page.waitForFunction(() => document.querySelector('[name=area]').value === '新会');
    assert.equal(await page.locator('[data-guide-item]:visible').count(), research.places.filter(p=>p.region==='新会区').length);
    await page.locator('[name=area]').selectOption('开平');
    assert.equal(await page.locator('[data-guide-item]:visible').count(), research.places.filter(p=>p.region==='开平市').length);
    await page.locator('button[type=reset]').click();
    await page.waitForFunction(count => [...document.querySelectorAll('[data-guide-item]')].filter(card => !card.hidden).length === count, research.places.length);
    await page.locator('[data-save="place-zili"]').click();
    await page.locator('[data-only-saved]').click();
    assert.equal(await page.locator('[data-guide-item]:visible').count(), 1);
    assert(await page.locator('#place-zili').isVisible());
    await page.reload();
    assert.equal(await page.locator('[data-save="place-zili"]').getAttribute('aria-pressed'), 'true');
    // Reload intentionally reapplies the URL's original region; show all before clicking a map.
    await page.locator('button[type=reset]').click();
    await page.waitForFunction(count => [...document.querySelectorAll('[data-guide-item]')].filter(card => !card.hidden).length === count, research.places.length);
    for (const place of research.places) {
      const link = page.locator('#place-' + place.id + ' .card-actions a');
      const url = new URL(await link.getAttribute('href'));
      assert.equal(url.origin, 'https://uri.amap.com');
      assert.equal(url.searchParams.get('keyword'), place.mapQuery);
      assert.equal(await link.getAttribute('target'), '_blank');
    }
    await context.route('https://uri.amap.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Map destination verified</title>' }));
    const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
    await page.locator('#place-zili .card-actions a').click({ timeout: 5000 });
    const popup = await popupPromise;
    assert(popup, 'Clicking the map link should open the destination in a new tab');
    await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).searchParams.get('keyword'), research.places.find(place => place.id === 'zili').mapQuery);
    await popup.close();
    report.checks.push({ name: 'region-url-reset-wishlist-reload-and-map-destinations', passed: true });

    const failedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await failedContext.route('**/*', route => assetPaths.has(new URL(route.request().url()).pathname) ? route.abort('failed') : route.continue());
    const failedPage = await failedContext.newPage();
    failedPage.on('pageerror', error => report.errors.push(error.message));
    await failedPage.goto(base + 'travel.html');
    const failedPhotos = failedPage.locator('.place-photo');
    for (let i = 0; i < await failedPhotos.count(); i++) {
      await failedPhotos.nth(i).scrollIntoViewIfNeeded();
      await failedPhotos.nth(i).locator('.photo-unavailable').waitFor({ state: 'visible' });
      assert((await failedPhotos.nth(i).locator('.photo-window').getAttribute('class')).includes('photo-failed'));
    }
    assert.equal(await failedPage.locator('[data-guide-item]:visible').count(), research.places.length);
    assert(await failedPage.evaluate(() => document.documentElement.scrollWidth <= 391 && document.documentElement.clientWidth <= 391));
    await failedPage.locator('#place-longdi').scrollIntoViewIfNeeded();
    await failedPage.screenshot({ path: path.join(out, 'travel-photos-failure.png') });
    await failedContext.close();
    report.checks.push({ name: 'failed-photos-readable-fallback', passed: true });

    const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const noJs = await noJsContext.newPage();
    await noJs.goto(base + 'travel.html');
    assert.equal(await noJs.locator('[data-guide-item]:visible').count(), research.places.length);
    assert.equal(await noJs.locator('.place-photo img').count(), manifest.length + 1);
    assert(await noJs.locator('.guide-toolbar').isHidden());
    assert(await noJs.locator('[data-save]').first().isHidden());
    await noJs.locator('.source-details summary').first().click();
    assert(await noJs.locator('.photo-credit').first().isVisible());
    assert(await noJs.locator('#place-longdi .card-actions a').isVisible());
    assert(await noJs.evaluate(() => document.documentElement.scrollWidth <= 391 && document.documentElement.clientWidth <= 391));
    await noJsContext.close();
    report.checks.push({ name: 'no-js-content-photos-native-source-details-map', passed: true });
    assert.equal(report.errors.length, 0); assert.equal(report.failed.length, 0);
    report.passed = true;
    console.log('PASS: photographic travel page at 320/390/768/1440, all responsive photos, source credits, subdirectory deployment, maps/wishlist, failed-image fallback and noJS.');
  } catch (error) {
    report.passed = false; report.error = error.stack;
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, '验证结果.json'), JSON.stringify(report, null, 2));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

function locationOrigin(url) { return new URL(url).origin; }

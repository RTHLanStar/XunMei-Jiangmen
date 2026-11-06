const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/QiuLiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'site', 'dist');
  const reportDir = path.join(root, '材料', '脚本接入验证');
  fs.mkdirSync(reportDir, { recursive: true });
  const server = http.createServer((req, res) => {
    const filename = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!filename.startsWith(dist + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Users/QiuLiang/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe', headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width:390, height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true });
    for (const name of ['index','travel','food','routes','stories','letters','about']) {
      const page = await context.newPage();
      const sdkResponses = [], errors = [];
      page.on('response', r => { if (r.url().startsWith('https://trtc.io/knocket-sdk/sdk.js?')) sdkResponses.push(r.status()); });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/${name}.html`, {waitUntil:'domcontentloaded'});
      await page.waitForTimeout(2500);
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scripts: [...document.scripts].filter(s => s.src.startsWith('https://trtc.io/knocket-sdk/sdk.js?')).map(s => ({src:s.src, async:s.async})),
        images: [...document.querySelectorAll('.place-photo img')].filter(img => {const r=img.getBoundingClientRect();return r.width > 390 || r.right > 391 || r.left < -1;}).map(img=>img.alt)
      }));
      const passed = layout.clientWidth === 390 && layout.scrollWidth <= 391 && layout.scripts.length === 1 && layout.scripts[0].async && layout.images.length === 0;
      results.push({page:name+'.html',passed,layout,sdkResponses,errors});
      if (['travel','food'].includes(name)) await page.screenshot({path:path.join(reportDir,name+'-390.png')});
      await page.close();
    }
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
  const report = {date:new Date().toISOString(),engine:'Chromium mobile simulation; not real WeChat',passed:results.every(r=>r.passed),results};
  fs.writeFileSync(path.join(reportDir,'验证结果.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(!report.passed) process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

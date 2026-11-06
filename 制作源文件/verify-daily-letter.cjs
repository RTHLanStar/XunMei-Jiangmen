/* Isolated browser checks: no deployment and no visible browser. */
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const {execFileSync} = require('child_process');
const {chromium} = require('C:/Users/QiuLiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'site/dist');
const output = path.join(root, '材料/今日来信验证');
const py = `import runpy; x=runpy.run_path(${JSON.stringify(path.join(__dirname, 'verify-daily-letter.py'))}); t=x['DailyLetterChecks'](); t.setUp(); print(t.render())`;
const moduleHTML = execFileSync('python', ['-c', py], {encoding:'utf8', env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const fixture = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>来信模块验证</title><link rel="stylesheet" href="site.css"><link rel="stylesheet" href="daily-letter.css"><main>'+moduleHTML+'</main><script defer src="daily-letter.js"></script></html>';
const photos = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root, '材料/旅行照片/manifest.json'), 'utf8')).map(p=>[p.id,p]));
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/letter-qa.html') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); return res.end(fixture); }
  const file = path.resolve(dist, '.'+decodeURIComponent(url.pathname));
  if (!file.startsWith(dist+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const type = {'.css':'text/css','.js':'text/javascript','.webp':'image/webp','.woff2':'font/woff2'}[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, {'Content-Type':type}); fs.createReadStream(file).pipe(res);
});

(async () => {
  fs.mkdirSync(output, {recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}/letter-qa.html`;
  const browser = await chromium.launch({headless:true,executablePath:'C:/Users/QiuLiang/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe'});
  const report = {passed:false, checks:[]};
  const errors = [];
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    const photoRequests = new Set();
    page.on('request',request=>{if(request.url().includes('/assets/travel/'))photoRequests.add(request.url());});
    await page.goto(url,{waitUntil:'networkidle'});
    assert.equal(photoRequests.size,1,'Only the currently displayed photo may load at startup.');
    report.checks.push('initially-one-photo-request');
    await page.evaluate(()=>{Math.random=()=>0;});
    const visited = [];
    for(let index=0;index<20;index++) {
      const state = await page.locator('#daily-letter-card').evaluate(card=>({
        id:card.dataset.letterId,food:card.dataset.foodId,
        alt:card.querySelector('img').alt,src:card.querySelector('img').getAttribute('src'),
        caption:card.querySelector('figcaption').textContent,
        source:card.querySelector('.photo-credit').textContent,
        preserve:card.querySelector('figure').classList.contains('preserve-photo'),
        placeHref:card.querySelector('[data-daily-letter-place]').getAttribute('href'),
        foodHref:card.querySelector('[data-daily-letter-food]').getAttribute('href')
      }));
      const photo = photos[state.id];
      assert.equal(state.alt,photo.alt); assert.equal(state.src,photo.src);
      assert(state.caption.includes(photo.caption)); assert(state.source.includes(photo.author));
      assert.equal(state.preserve,!!photo.preserve_full);
      if(photo.required_credit) assert(state.caption.includes(photo.required_credit));
      assert.equal(state.placeHref,`travel.html#place-${state.id}`);
      assert.equal(state.foodHref,`food.html#food-${state.food}`);
      visited.push(state.id);
      await page.locator('[data-daily-letter-next]').click();
    }
    assert.equal(new Set(visited).size,20);
    report.checks.push('twenty-letter-photo-caption-credit-and-link-consistency');
    const rapid = await page.evaluate(()=>{
      const ids=[]; const button=document.querySelector('[data-daily-letter-next]');
      for(let i=0;i<100;i++){button.click();ids.push(document.querySelector('#daily-letter-card').dataset.letterId);}
      return ids;
    });
    assert(rapid.every((id,i)=>!i||id!==rapid[i-1]));
    assert.equal(await page.locator('#daily-letter-card').count(),1);
    assert.equal(await page.locator('#daily-letter-card img').count(),1);
    report.checks.push('one-hundred-rapid-clicks-without-consecutive-repeat');
    await page.route('**/assets/travel/qiming-*.webp',route=>route.abort());
    await page.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(()=>{Math.random=()=>0;});
    await page.locator('[data-daily-letter-next]').click();
    await page.waitForFunction(()=>document.querySelector('#daily-letter-card .photo-window').classList.contains('photo-failed'));
    assert(await page.locator('#daily-letter-card .photo-unavailable').isVisible());
    await page.evaluate(()=>{window.staleLetterImage=document.querySelector('#daily-letter-card img');});
    await page.locator('[data-daily-letter-next]').click();
    await page.waitForFunction(()=>document.querySelector('#daily-letter-card img').naturalWidth>0);
    await page.evaluate(()=>window.staleLetterImage.dispatchEvent(new Event('error')));
    assert.equal(await page.locator('#daily-letter-card .photo-failed').count(),0);
    assert(!(await page.locator('#daily-letter-card .photo-unavailable').isVisible()));
    report.checks.push('failed-photo-fallback-next-photo-recovers-stale-error-ignored');
    const geometry=[];
    for(const width of [320,390,1440]) {
      await page.setViewportSize({width,height:1000});
      const measure=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        photoWidth:document.querySelector('#daily-letter-card img').getBoundingClientRect().width,
        buttonHeight:document.querySelector('[data-daily-letter-next]').getBoundingClientRect().height}));
      assert(measure.scrollWidth<=width); assert(measure.photoWidth>0); assert(measure.buttonHeight>=44);
      geometry.push(measure);
      await page.locator('#daily-letter').screenshot({path:path.join(output,`模块-${width}.png`)});
    }
    report.checks.push('320-390-1440-no-overflow-and-touch-targets'); report.geometry=geometry;
    const noJS = await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:900}});
    await noJS.goto(url,{waitUntil:'networkidle'});
    assert(await noJS.locator('.daily-letter-poem').isVisible());
    assert(await noJS.locator('[data-daily-letter-place]').isVisible());
    assert(await noJS.locator('[data-daily-letter-food]').isVisible());
    assert(!(await noJS.locator('[data-daily-letter-next]').isVisible()));
    report.checks.push('no-javascript-readable-first-letter-and-links');
    assert.deepEqual(errors,[]); report.checks.push('no-browser-script-errors');
    report.passed=true; report.visited=visited; report.browserErrors=errors;
  } finally {
    fs.writeFileSync(path.join(output,'独立模块验证.json'),JSON.stringify(report,null,2));
    await browser.close(); await new Promise(resolve=>server.close(resolve));
  }
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});

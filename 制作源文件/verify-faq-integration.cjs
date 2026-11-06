/* Read-only integration review of shipped FAQ/tour pages and print restoration. */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const {chromium, executablePath} = require('./browser-runtime.cjs');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'site/dist'), out = path.join(root, '材料/站内问答验证');
const report = {engine: 'Headless Chromium; mobile simulation, not WeChat hardware', checks: [], brokenLinks: [], errors: []};
const pages = ['index','stories','letters','about','travel','food','routes','faq','tour'];
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.json':'application/json'};
const server = http.createServer((req,res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/v2\.2\//, '');
  const file = path.resolve(dist, rel || 'index.html');
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) {res.writeHead(404); res.end(); return;}
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
function detailState() {return [...document.querySelectorAll('.faq-item')].map(item => ({id:item.id, open:item.open, hidden:item.hidden}));}
(async () => {
  fs.mkdirSync(out,{recursive:true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/v2.2/`;
  const browser = await chromium.launch({executablePath});
  try {
    for (const name of pages) {
      const html = fs.readFileSync(path.join(dist, name + '.html'),'utf8');
      assert(/class="site-utility"/.test(html), name);
      const utility = html.match(/<!--site-utility:start-->([\s\S]*?)<!--site-utility:end-->/)[1];
      assert(/href="tour.html"/.test(utility) && /href="faq.html"/.test(utility), name);
    }
    report.checks.push({allNinePagesHaveBothFooterEntrances:true});
    for (const name of ['faq','tour']) {
      const html = fs.readFileSync(path.join(dist, name + '.html'),'utf8');
      for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
        const href = match[1].replace(/&amp;/g,'&');
        const url = new URL(href,base+name+'.html');
        if (url.origin !== new URL(base).origin) continue;
        const file = path.join(dist,decodeURIComponent(url.pathname).replace(/^\/v2\.2\//,''));
        if (!fs.existsSync(file)) report.brokenLinks.push({page:name,href,reason:'missing file'});
        else if (url.hash) {
          const id = decodeURIComponent(url.hash.slice(1));
          const content = fs.readFileSync(file,'utf8');
          if (![...content.matchAll(/\bid="([^"]+)"/g)].some(m=>m[1]===id)) report.brokenLinks.push({page:name,href,reason:'missing anchor'});
        }
      }
      for (const width of [320,390,1440]) {
        const context = await browser.newContext({viewport:{width,height:900},isMobile:width<650,hasTouch:width<650});
        await context.route('https://**',route=>route.abort());
        const page = await context.newPage();
        page.on('pageerror',error=>report.errors.push({page:name,width,error:error.message}));
        await page.goto(base+name+'.html');
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('h1').count(),1);
        assert.equal(await page.getByRole('navigation',{name:'主导航',exact:true}).count(),1);
        assert.equal(await page.getByRole('navigation',{name:'阅读与使用帮助',exact:true}).count(),1);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), name+width);
        const headings = await page.locator('h1,h2,h3,h4').evaluateAll(nodes=>nodes.map(n=>({level:Number(n.tagName.slice(1)),text:n.textContent})));
        for(let i=1;i<headings.length;i++) assert(headings[i].level<=headings[i-1].level+1,JSON.stringify(headings));
        const controls = await page.locator('.topbar nav a,.site-utility nav a,.faq-controls input,.faq-controls select,.faq-controls button,.tour-step-link').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,height:n.getBoundingClientRect().height})).filter(n=>n.height>0));
        assert(controls.every(control=>control.height>=43.5),JSON.stringify(controls));
        if(name==='faq') {
          await page.locator('#faq-query').fill('火'.repeat(80));
          assert(await page.locator('#faq-empty').isVisible());
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
          await page.goto(base+'faq.html?q='+encodeURIComponent('火'.repeat(500))+'#q-10');
          assert.equal(await page.locator('#faq-query').inputValue(),'');
          assert(await page.locator('#q-10').evaluate(n=>n.open&&!n.hidden));
          assert(!new URL(page.url()).searchParams.has('q'));
          await page.goto(base+'faq.html?q='+encodeURIComponent('火'.repeat(500)));
          assert.equal((await page.locator('#faq-query').inputValue()).length,80);
          await page.locator('#faq-query').fill('陈皮');
          await page.locator('#faq-category').selectOption('food');
          await page.locator('#q-18 summary').click();
          const original = await page.evaluate(detailState);
          const visibleCount = original.filter(n=>!n.hidden).length;
          await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
          await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
          const printing = await page.evaluate(detailState);
          assert(printing.filter(n=>!n.hidden).every(n=>n.open));
          assert.deepEqual(printing.filter(n=>n.hidden),original.filter(n=>n.hidden));
          await page.emulateMedia({media:'print'});
          assert.equal(await page.locator('.faq-item:visible').count(),visibleCount);
          assert.equal(await page.locator('.faq-controls').isVisible(),false);
          if(width===390) await page.pdf({path:path.join(out,'faq-filtered-integration.pdf'),format:'A4',printBackground:true});
          await page.emulateMedia({media:'screen'});
          await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
          assert.deepEqual(await page.evaluate(detailState),original);
          assert.equal(await page.locator('#faq-query').inputValue(),'陈皮');
          assert.equal(await page.locator('#faq-category').inputValue(),'food');
          await page.locator('#faq-clear').click();
          await page.locator('#q-3 summary').click();
          if(width===320) await page.locator('#q-3').screenshot({path:path.join(out,'faq-integrated-320-expanded.png')});
        }
        if(width===320) {await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:path.join(out,name+'-integrated-320-top.png')});}
        report.checks.push({name,width,headingLevels:headings.map(h=>h.level),overflow:false,controls44px:true,queryAndPrint:name==='faq'});
        await context.close();
      }
    }
    assert.deepEqual(report.brokenLinks,[]);
    assert.deepEqual(report.errors,[]);
    report.passed=true;
    fs.writeFileSync(path.join(out,'集成审查.json'),JSON.stringify(report,null,2));
    console.log('PASS: Shipped FAQ/tour 6 viewport cases; 9 footer entrances, all local links, heading levels, touch controls, 500-char query/hash conflicts, print filter and details restoration.');
  } finally {await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{report.failure=error.message;fs.writeFileSync(path.join(out,'集成审查.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;});

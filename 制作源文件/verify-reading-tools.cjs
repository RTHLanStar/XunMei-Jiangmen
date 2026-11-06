/* Integrated reading/sharing/printing regression on the actual /v2.2/ pages. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/建议优化验证');fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/v2\.2\//,'').replace(/^\//,'');const file=path.resolve(dist,rel||'index.html');if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
const report={passed:false,checks:[],errors:[],localFailures:[],engine:'Chromium desktop and mobile viewport; not actual WeChat hardware'};
const pass=name=>report.checks.push({name,passed:true});
function assertLocal(href,file){if(/^(https?:|mailto:)/.test(href))return;const u=new URL(href,'http://local/v2.2/'+file+'.html'),f=path.join(dist,u.pathname.slice(6));assert(fs.existsSync(f),href);if(u.hash)assert(fs.readFileSync(f,'utf8').includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),href);}
async function geometry(page,width){assert(await page.evaluate(w=>document.documentElement.clientWidth<=w+1&&document.documentElement.scrollWidth<=w+1,width),'overflow '+width);}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v2.2/`;
 const browser=await chromium.launch({executablePath});
 const create=async options=>{const c=await browser.newContext(options);await c.route('**/*',r=>r.request().url().startsWith(base)||r.request().url().startsWith('data:')?r.continue():r.abort());return c;};
 try{
  const c=await create({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();
  p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)report.localFailures.push(r.url());});
  for(const file of ['index','stories','letters','about','travel','food','routes','faq','tour']){
   await p.goto(base+file+'.html',{waitUntil:'domcontentloaded'});assert.equal(await p.locator('h1').count(),1);assert.equal(await p.locator('header nav a').count(),5);assert.equal(await p.locator('.site-utility a[href="faq.html"]').count(),1);assert.equal(await p.locator('.site-utility a[href="tour.html"]').count(),1);
   assert.equal(await p.locator('meta[property="og:title"]').count(),1);assert.equal(await p.locator('link[rel="canonical"]').count(),1);
   for(const href of await p.locator('a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href'))))assertLocal(href,file);
  }pass('nine-pages:metadata-utility-links-local-anchors');
  await p.goto(base+'faq.html');assert.equal(await p.locator('.faq-item').count(),87);assert.equal(await p.locator('.faq-item:visible').count(),87);
  await p.locator('#faq-query').fill('我想去陈皮村');assert(await p.locator('#q-10').isVisible());
  await p.locator('#faq-query').fill('不存在abcxyz');assert(await p.locator('#faq-empty').isVisible());
  await p.locator('.faq-shortcuts a[href="#q-7"]').click();assert.equal(await p.locator('#faq-query').inputValue(),'');assert(await p.locator('#q-7').getAttribute('open')!==null);
  await p.goto(base+'faq.html?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E#q-10');assert(await p.locator('#q-10').getAttribute('open')!==null);assert.equal(await p.locator('#faq-query').inputValue(),'');
  await p.locator('#faq-query').fill('锦江温泉');const found=await p.locator('.faq-item:visible').count();assert(found>0&&found<87);
  pass('faq:87-static-answers-search-no-results-deep-link-unfilters-safe-query');
  for(const file of ['faq','tour'])for(const width of [320,390,768,1440]){
   await p.setViewportSize({width,height:900});await p.goto(base+file+'.html');await p.evaluate(()=>document.fonts.ready);await geometry(p,width);
   if(file==='tour'){for(const img of await p.locator('.tour-step img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(x=>x.decode());assert(await img.evaluate(x=>x.complete&&x.naturalWidth>0));}await p.evaluate(()=>window.scrollTo(0,0));}
   if(width===320){await p.addStyleTag({content:'body{-webkit-text-size-adjust:200%!important;text-size-adjust:200%!important}'});await geometry(p,width);}
   if(width===390||width===1440)await p.screenshot({path:path.join(out,file+'-'+width+'.png')});
  }pass('faq-tour:four-widths-text200-visual-snapshots');
  await p.setViewportSize({width:1024,height:900});
  for(const file of ['travel','food','routes','faq']){
   await p.goto(base+file+'.html');
   if(file==='travel')await p.locator('[name=area]').selectOption('新会');
   if(file==='food')await p.locator('[name=q]').fill('外海');
   if(file==='faq')await p.locator('#faq-query').fill('锦江温泉');
   const selector=file==='faq'?'.faq-item':file==='routes'?'.route-card':'[data-guide-item]';
   const visible=await p.locator(selector+':visible').evaluateAll(x=>x.map(n=>n.id));
   const before=await p.locator('main details').evaluateAll(x=>x.map(d=>[d.id,d.open]));
   await p.emulateMedia({media:'print'});
   assert.equal(await p.locator('header').isVisible(),false);assert.equal(await p.locator('.site-utility').isVisible(),false);
   assert.deepEqual(await p.locator(selector+':visible').evaluateAll(x=>x.map(n=>n.id)),visible);
   if(file==='faq'){assert.equal(await p.locator('.faq-item:visible:not([open])').count(),0);assert(await p.locator('.faq-item:visible .faq-answer').first().isVisible());}
   else{assert(await p.locator('.source-details:visible .photo-credit').first().isVisible());}
   await p.screenshot({path:path.join(out,file+'-print.png')});
   await p.emulateMedia({media:'screen'});await p.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('main details')].map(d=>[d.id,d.open]))===JSON.stringify(expected),before);
   await p.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++};});await p.locator('[data-print-page]').click();assert.equal(await p.evaluate(()=>window.__printCalls),1);
  }pass('print:four-pages-current-filter-provenance-expanded-restored-user-click');
  const no=await create({javaScriptEnabled:false,viewport:{width:320,height:844}}),n=await no.newPage();
  await n.goto(base+'faq.html');assert.equal(await n.locator('.faq-item').count(),87);assert(await n.locator('.faq-controls').isHidden());assert(await n.locator('[data-print-tools]').isHidden());await n.locator('#q-10 summary').click();assert(await n.locator('#q-10 .faq-answer').isVisible());await geometry(n,320);
  await n.goto(base+'tour.html');assert.equal(await n.locator('.tour-step-link').count(),4);await geometry(n,320);await no.close();pass('no-js:all-answers-and-tour-readable-controls-hidden');
  const offline=await browser.newContext({viewport:{width:390,height:844}});await offline.route('https://**/*',r=>r.abort());const f=await offline.newPage();await f.goto(require('node:url').pathToFileURL(path.join(dist,'faq.html')).href);await f.locator('#faq-query').fill('外海面');assert(await f.locator('#q-17').isVisible());await offline.close();pass('file-protocol:local-faq-search-no-fetch');
  assert.equal(report.errors.length,0);assert.equal(report.localFailures.length,0);report.passed=true;await c.close();
 }catch(error){report.failure=error.stack;process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'浏览器验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();

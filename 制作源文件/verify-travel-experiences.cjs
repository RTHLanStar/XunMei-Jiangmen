/* Integrated /v2.2/ regression against generated pages, not module fixtures. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/旅行体验验证');
fs.mkdirSync(out,{recursive:true});
const photos=new Map(JSON.parse(fs.readFileSync(path.join(root,'材料/旅行照片/manifest.json'),'utf8')).map(p=>[p.id,p]));
const foods=new Map(JSON.parse(fs.readFileSync(path.join(root,'材料/美食照片/site-manifest.json'),'utf8')).map(p=>[p.id,p]));
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local'),f=path.resolve(dist,decodeURIComponent(u.pathname).replace(/^\/v2\.2\//,'').replace(/^\//,'')||'index.html');if(!f.startsWith(dist+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
const report={checkedAt:new Date().toISOString(),engine:'Chromium, mobile emulation; not an actual WeChat device',checks:[],errors:[]};
const check=(name,detail={})=>report.checks.push({name,passed:true,...detail});
function localLink(href,file){const u=new URL(href,'http://local/v2.2/'+file+'.html');assert.equal(u.origin,'http://local');assert(u.pathname.startsWith('/v2.2/'));const f=path.join(dist,u.pathname.slice(6));assert(fs.existsSync(f),href);if(u.hash)assert(fs.readFileSync(f,'utf8').includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),href);}
async function geometry(p,width){const r=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(r.client<=width+1&&r.scroll<=width+1,JSON.stringify(r));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v2.2/`;
 const b=await chromium.launch({executablePath});
 try{
  const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'index.html');await p.locator('#daily-letter').scrollIntoViewIfNeeded();
  assert.equal(await p.locator('#daily-letter-card').count(),1);assert.equal(await p.locator('#daily-letter img').count(),1);
  assert(await p.locator('[data-daily-letter-next]').isVisible());
  await p.evaluate(()=>{Math.random=()=>0;});
  const seen=[];
  for(let i=0;i<20;i++){
   const card=p.locator('#daily-letter-card'),id=await card.getAttribute('data-letter-id'),photo=photos.get(id);seen.push(id);
   assert(photo);assert.equal(await card.locator('img').getAttribute('alt'),photo.alt);
   assert((await card.locator('figcaption').textContent()).includes(photo.caption));
   assert((await card.locator('.photo-credit').textContent()).includes(photo.author));
   assert.equal(await card.locator('.photo-credit a').first().getAttribute('href'),photo.source_url);
   if(photo.required_credit)assert((await card.locator('.photo-required-credit').textContent()).includes(photo.required_credit));
   if(photo.preserve_full)assert.equal(await card.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
   for(const href of await card.locator('[data-daily-letter-place],[data-daily-letter-food]').evaluateAll(a=>a.map(x=>x.getAttribute('href'))))localLink(href,'index');
   await p.locator('[data-daily-letter-next]').click();assert.notEqual(await card.getAttribute('data-letter-id'),id);
  }
  assert.equal(new Set(seen).size,20);check('daily-letter:20-destinations-metadata-links-and-no-repeat');
  await geometry(p,390);await p.locator('#daily-letter').screenshot({path:path.join(out,'今日来信-390.png')});
  await p.goto(base+'routes.html');const routeIds=new Set();
  const allowed={'half-day':['jianghai-half-day'],'one-day':['old-town','heshan-water-village','taishan-duanfen'],'two-days':['city-xinhui','city-kaiping']};
  for(const duration of ['half-day','one-day','two-days'])for(const interest of ['architecture','nature','food']){
   await p.locator(`label:has([name=route-duration][value="${duration}"])`).click();await p.locator(`label:has([name=route-interest][value="${interest}"])`).click();
   assert(await p.locator(`[name=route-duration][value="${duration}"]`).isChecked());assert(await p.locator(`[name=route-interest][value="${interest}"]`).isChecked());await p.locator('[data-route-finder-form] button').click();
   const picks=await p.locator('#route-finder-results [data-route-pick]').evaluateAll(a=>a.map(x=>x.dataset.routePick));assert(picks.length>0);
   for(const id of picks){assert(allowed[duration].includes(id),duration+':'+id);routeIds.add(id);localLink('#'+id,'routes');}
   await geometry(p,390);
  }
  assert.equal(routeIds.size,6);check('route-finder:nine-combinations-six-routes-duration-boundaries');
  await p.locator('#route-finder').screenshot({path:path.join(out,'今天怎么逛-390.png')});
  for(const [file,count,lookup] of [['travel',20,foods],['food',14,photos]]){
   await p.goto(base+file+'.html');assert.equal(await p.locator('.companion-details').count(),count);
   for(const detail of await p.locator('.companion-details').all()){
    assert(!(await detail.getAttribute('open')));await detail.locator('summary').click();
    for(const link of await detail.locator('.companion-link').all()){
     const href=await link.getAttribute('href');localLink(href,file);const id=href.split('#')[1].replace(/^(food|place)-/,'');const photo=lookup.get(id);assert(photo);
     assert.equal(await link.locator('img').getAttribute('src'),photo.small);
     if(photo.kind==='ai')assert((await link.textContent()).includes('AI 菜式示意'));
     if(photo.preserve_full)assert.equal(await link.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
     if(photo.required_credit)assert((await detail.textContent()).includes(photo.required_credit));
    }
    await geometry(p,390);
   }
   await p.setViewportSize({width:320,height:844});await geometry(p,320);await p.addStyleTag({content:'body{-webkit-text-size-adjust:200%!important;text-size-adjust:200%!important}'});await geometry(p,320);
   // Capture evidence separately from the preceding 200% mobile text-size stress check.
   const captureContext=await b.newContext({viewport:{width:320,height:900},deviceScaleFactor:1,isMobile:false,reducedMotion:'reduce'});
   await captureContext.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
   const capturePage=await captureContext.newPage();await capturePage.goto(base+file+'.html',{waitUntil:'networkidle'});await capturePage.evaluate(()=>document.fonts.ready);
   const captureCard=capturePage.locator('.guide-card').first();await captureCard.locator('.companion-details>summary').click();await capturePage.addStyleTag({content:'.skip,.topbar.site-header{display:none!important}'});
   await captureCard.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{img.loading='eager';if(img.decode)await img.decode();})));await captureCard.scrollIntoViewIfNeeded();
   await captureCard.screenshot({path:path.join(out,file+'-互荐-320.png'),scale:'css',animations:'disabled'});await captureContext.close();await p.setViewportSize({width:390,height:844});
  }
  check('reciprocal-links:all20places14foods-attribution-ai-labels-expanded-mobile');
  await p.goto(base+'food.html');await p.locator('[name=q]').fill('长堤');assert.equal(await p.locator('[data-guide-item]:visible').count(),0,'Cross-link text must not pollute food search');check('food-search-excludes-companion-text');
  const no=await b.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}});await no.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());const n=await no.newPage();
  for(const file of ['index','routes','travel','food']){await n.goto(base+file+'.html');await geometry(n,320);if(file==='index'){assert(await n.locator('#daily-letter-card').isVisible());assert(await n.locator('[data-daily-letter-next]').isHidden());}if(file==='routes'){assert(await n.locator('[data-route-finder-form]').isHidden());assert(await n.locator('#route-finder-results').isVisible());}if(['travel','food'].includes(file)){await n.locator('.companion-details summary').first().click();assert(await n.locator('.companion-list').first().isVisible());}}
  await no.close();check('no-js:readable-letter-default-route-native-details');
  for(const file of ['index','routes','letters']){
   const d=await b.newContext({viewport:{width:320,height:844}});await d.route('**/*',r=>new URL(r.request().url()).origin!==new URL(base).origin||r.request().resourceType()==='stylesheet'?r.abort():r.continue());const t=await d.newPage();await t.goto(base+file+'.html');await geometry(t,320);await d.close();
  }
  check('css-failure:index-routes-letters-width320');
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.passed=true;await c.close();
 }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}
 finally{await b.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'集成验证.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();

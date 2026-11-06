const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(root,'材料/旅行指南验证');fs.mkdirSync(out,{recursive:true});
const destinations=JSON.parse(fs.readFileSync(path.join(root,'材料/旅行内容研究-景点.json'),'utf8')).places;
const foods=JSON.parse(fs.readFileSync(path.join(root,'材料/旅行内容研究-美食.json'),'utf8')).foods;
const expanded=JSON.parse(fs.readFileSync(path.join(root,'材料/美食与路线扩充-2026-10-16.json'),'utf8'));
const photos=new Map(JSON.parse(fs.readFileSync(path.join(root,'材料/旅行照片/manifest.json'),'utf8')).map(photo=>[photo.id,photo]));
const foodPhotos=new Map(JSON.parse(fs.readFileSync(path.join(root,'材料/美食照片/site-manifest.json'),'utf8')).map(photo=>[photo.id,photo]));
const expectedRoutes=[{id:'old-town',coverId:'qiming'},{id:'city-xinhui',coverId:'bird'},{id:'city-kaiping',coverId:'zili'},...expanded.routes];
const foodCountForRegion=region=>foods.filter(food=>food.district.replace(/[区市]$/,'')===region).length;
function assertLocalLink(link,file){
 const u=new URL(link,'http://local/'+file+'.html'),local=path.join(root,'site/dist',decodeURIComponent(u.pathname));
 assert(fs.existsSync(local),'Missing local URL '+link);
 if(u.hash&&local.endsWith('.html'))assert(fs.readFileSync(local,'utf8').includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),'Missing fragment '+link);
}
(async()=>{
 const b=await chromium.launch({executablePath});
 const report={checks:[],errors:[],failed:[]};
 try{
 const c=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.failed.push(r.url())});
 for(const w of [320,390,768,1440]){
  await p.setViewportSize({width:w,height:900});
  for(const file of ['index','stories','letters','about','travel','food','routes','faq','tour']){
   await p.goto('http://127.0.0.1:8765/'+file+'.html',{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
   assert(await p.locator('h1').count()===1);assert(await p.evaluate(width=>document.documentElement.clientWidth<=width+1&&document.documentElement.scrollWidth<=width+1,w),file+' overflow '+w);
   assert.equal(await p.locator('header nav a').count(),5);
   // The user-requested Knocket SDK adds its own remote stylesheet.
   const localStyles=await p.locator('link[rel=stylesheet]').evaluateAll(links=>links.filter(link=>new URL(link.href).origin===location.origin).map(link=>link.href));
   assert.equal(localStyles.length,1,JSON.stringify({file,localStyles}));
   if(['travel','food','routes'].includes(file)){
    const resources=await p.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
    assert(!resources.some(x=>/\.mp4|scene-|film-poster|atlas-data|jiangmen-atlas/.test(x)),'Travel page downloads media');
    if(w===390||w===1440)await p.screenshot({path:path.join(out,file+'-'+w+'.png'),fullPage:true});
   }
   report.checks.push({file,width:w,noOverflow:true});
  }
 }
 await p.goto('http://127.0.0.1:8765/travel.html?area='+encodeURIComponent('新会')+'#places');
 await p.waitForFunction(()=>document.querySelector('[name=area]').value==='新会');
 assert.equal(await p.locator('[data-guide-item]:visible').count(),destinations.filter(x=>x.region==='新会区').length);
 assert.equal(await p.locator('[name=q]').count(),0,'Attraction page should browse by region without a search field');
 await p.locator('button[type=reset]').click();await p.waitForFunction(count=>[...document.querySelectorAll('[data-guide-item]')].filter(x=>!x.hidden).length===count,destinations.length);
 const regions=['蓬江','江海','新会','台山','开平','鹤山','恩平'];
 assert(destinations.length>=20,'Expanded guide must cover at least 20 destinations');
 for(const region of regions){
  await p.locator('[name=area]').selectOption(region);
  const expected=destinations.filter(x=>x.region.replace(/[区市]$/,'')===region).length;
  assert(expected>0,'Missing region '+region);
  assert.equal(await p.locator('[data-guide-item]:visible').count(),expected);
 }
 await p.locator('button[type=reset]').click();await p.waitForFunction(count=>[...document.querySelectorAll('[data-guide-item]')].filter(x=>!x.hidden).length===count,destinations.length);
 report.checks.push({name:'seven-regions-and-expanded-destinations',count:destinations.length,passed:true});
 await p.locator('[data-save="place-bird"]').click();assert.equal(await p.locator('[data-save="place-bird"]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-only-saved]').click();assert.equal(await p.locator('[data-guide-item]:visible').count(),1);
 await p.locator('[data-save="place-bird"]').click();assert(await p.locator('.guide-empty').isVisible());assert.equal(await p.evaluate(()=>document.activeElement.hasAttribute('data-only-saved')),true);
 await p.locator('button[type=reset]').click();await p.locator('[data-save="place-bird"]').click();
 await p.goto('http://127.0.0.1:8765/food.html');
 assert.equal(await p.locator('[data-guide-item]').count(),foods.length);
 for(const food of foods){
  const card=p.locator('#food-'+food.id),figure=card.locator('figure.place-photo'),photo=foodPhotos.get(food.id);
  assert(photo,'Missing food photo record '+food.id);assert.equal(await figure.count(),1,'Missing food figure '+food.id);
  assert.equal(await figure.locator('img').count(),1);assert.equal(await figure.locator('img').getAttribute('alt'),photo.alt);assert(photo.alt.trim(),'Empty food alt '+food.id);
  assert.equal(await figure.locator('img').getAttribute('src'),photo.src);assertLocalLink(photo.src,'food');assertLocalLink(photo.small,'food');
  assert((await figure.locator('figcaption').textContent()).includes(photo.caption)&&photo.caption.trim(),'Missing food caption '+food.id);
  assert((await card.locator('.photo-credit').textContent()).trim(),'Missing food credit '+food.id);
  if(photo.kind==='ai')assert((await figure.locator('figcaption').textContent()).includes('AI'),'AI food caption must disclose origin '+food.id);
 }
 for(const region of regions){
  await p.locator('[name=area]').selectOption(region);
  assert.equal(await p.locator('[data-guide-item]:visible').count(),foodCountForRegion(region),'Food region '+region);
 }
 await p.locator('[name=area]').selectOption('开平');assert.equal(await p.locator('[data-guide-item]:visible').count(),foodCountForRegion('开平'));
 await p.locator('[name=q]').fill('不存在的美食ABC');assert(await p.locator('.guide-empty').isVisible());
 await p.locator('button[type=reset]').click();await p.waitForFunction(count=>[...document.querySelectorAll('[data-guide-item]')].filter(x=>!x.hidden).length===count,foods.length);
 report.checks.push({name:'food-photos-captions-and-seven-region-filters',count:foods.length,passed:true});
 await p.locator('[data-save="food-waihai-noodles"]').click();
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('jiangmen-travel-wishlist')));assert(saved.includes('place-bird')&&saved.includes('food-waihai-noodles'));
 await p.reload();assert.equal(await p.locator('[data-save="food-waihai-noodles"]').getAttribute('aria-pressed'),'true');
 report.checks.push({name:'filter-empty-reset-wishlist-cross-page-reload',passed:true});
 const second=await c.newPage();await second.goto('http://127.0.0.1:8765/travel.html');await second.evaluate(()=>localStorage.removeItem('jiangmen-travel-wishlist'));await p.waitForFunction(()=>document.querySelector('[data-save="food-waihai-noodles"]').getAttribute('aria-pressed')==='false');await second.close();
 await p.goto('http://127.0.0.1:8765/routes.html');
 assert.equal(expectedRoutes.length,6);assert.equal(await p.locator('.route-card').count(),expectedRoutes.length);
 assert.equal(await p.locator('.route-card figure.place-photo').count(),expectedRoutes.length);
 for(const route of expectedRoutes){
  const card=p.locator('#'+route.id),photo=photos.get(route.coverId);
  assert(photo,'Missing route cover record '+route.id);assert.equal(await card.count(),1,'Missing route '+route.id);
  const figure=card.locator('figure.place-photo');assert.equal(await figure.locator('img').getAttribute('src'),photo.src);
  assert.equal(await figure.locator('img').getAttribute('alt'),photo.alt);assert(photo.alt.trim(),'Empty route cover alt '+route.id);
  assert((await figure.locator('figcaption').textContent()).includes(photo.caption),'Wrong route cover caption '+route.id);
  assertLocalLink(photo.src,'routes');assertLocalLink(photo.small,'routes');
  const sourceLinks=await card.locator('.photo-credit a[href]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  assert(sourceLinks.includes(photo.source_url),'Missing matching route photo source '+route.id);
  assert((await card.locator('.photo-credit').textContent()).includes(photo.author),'Missing route photo attribution '+route.id);
  const stepLinks=await card.locator('.route-steps a[href]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  assert(stepLinks.length>0,'Missing route steps '+route.id);
  for(const link of stepLinks){assert(!/^(https?:|mailto:)/.test(link)&&link.includes('#'),'Route step must link to a local stop '+link);assertLocalLink(link,'routes');}
 }
 assert.equal(expanded.advice.length,4);assert.equal(await p.locator('[id^="advice-"]').count(),expanded.advice.length);
 for(const advice of expanded.advice){
  const card=p.locator('#advice-'+advice.id);assert.equal(await card.locator('h3').textContent(),advice.title);assert((await card.locator('p').textContent()).includes(advice.text));
  const links=await card.locator('a[href]').evaluateAll(anchors=>anchors.map(anchor=>anchor.getAttribute('href')));
  assert.deepEqual(links,advice.links.map(link=>link.href));for(const link of links)assertLocalLink(link,'routes');
 }
 report.checks.push({name:'six-routes-attributed-covers-local-stops-and-four-advice-groups',routes:expectedRoutes.length,advice:expanded.advice.length,passed:true});
 await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedRoute=text}}}));
 await p.locator('[data-copy-route]').first().click();assert((await p.evaluate(()=>window.__copiedRoute)).includes('老城慢逛'));
 await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));
 await p.locator('[data-copy-route]').nth(1).click();assert(await p.locator('.route-card').nth(1).locator('textarea').isVisible());assert.equal(await p.locator('button textarea').count(),0,'Copy fallback must not be inside an interactive button');
 report.checks.push({name:'clipboard-success-mock-and-real-fallback',passed:true});
 const restricted=await b.newContext({viewport:{width:390,height:844}});await restricted.addInitScript(()=>{Storage.prototype.setItem=Storage.prototype.getItem=function(){throw Error('denied')}});const r=await restricted.newPage();await r.goto('http://127.0.0.1:8765/food.html');await r.locator('[data-save]').first().click();assert((await r.locator('[data-wishlist-status]').innerText()).includes('仅在本页'));await restricted.close();
 const nojs=await b.newContext({javaScriptEnabled:false}),n=await nojs.newPage();await n.goto('http://127.0.0.1:8765/travel.html');assert.equal(await n.locator('[data-guide-item]:visible').count(),destinations.length);assert(await n.locator('.guide-toolbar').isHidden());assert(await n.locator('[data-save]').first().isHidden());await n.locator('.source-details summary').first().click();assert(await n.locator('.guide-sources').first().isVisible());await nojs.close();
 await p.goto(require('url').pathToFileURL(path.join(root,'site/dist/food.html')).href);assert.equal(await p.locator('[data-guide-item]:visible').count(),foods.length);await p.locator('[name=area]').selectOption('开平');assert.equal(await p.locator('[data-guide-item]:visible').count(),foodCountForRegion('开平'));
 // Every local URL/fragment in the 7-page site resolves to the current static files.
 for(const file of ['index','stories','letters','about','travel','food','routes','faq','tour']){
  await p.goto('http://127.0.0.1:8765/'+file+'.html');
  const links=await p.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
  for(const link of links){if(/^(https?:|mailto:)/.test(link))continue;assertLocalLink(link,file)}
 }
 report.checks.push({name:'storage-denied-nojs-file-protocol-local-links',passed:true});
 assert.equal(report.errors.length,0);assert.equal(report.failed.length,0);report.passed=true;
 fs.writeFileSync(path.join(out,'验证结果.json'),JSON.stringify(report,null,2));console.log('PASS: 36 layouts, 9-page navigation, food photos and region counts, 6 route covers/sources, 4 advice groups, filters, wishlist persistence/cross-tab/focus, copy fallback, restricted storage, noJS, file://, local links.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});

/* Integration checks against the generated pages; no shared generator/QA mutation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,executablePath}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/旅行护照验证');
const places=JSON.parse(fs.readFileSync(path.join(root,'材料/旅行内容研究-景点.json'),'utf8')).places;
const visitedKey='jiangmen-travel-visited-v1',wishKey='jiangmen-travel-wishlist';
const report={passed:false,checks:[],errors:[],localFailures:[]};fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(dist,'.'+decodeURIComponent(req.url.split('?')[0]));if(file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));}else{res.statusCode=404;res.end();}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath});
 const setup=async options=>{const context=await browser.newContext(options);await context.route('**/*',route=>route.request().url().startsWith(base)||route.request().url().startsWith('data:')?route.continue():route.abort());return context;};
 const watch=page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)report.localFailures.push(r.url());});};
 try{
  const context=await setup({viewport:{width:390,height:844},acceptDownloads:true});
  await context.addInitScript(()=>{if(!localStorage.getItem('passport-integrated-seed')){localStorage.setItem('jiangmen-letter-stamps','[0,2]');localStorage.setItem('jiangmen-letter-draft',JSON.stringify({scene:0,recipient:'同行的朋友',message:'沿途的风景，慢慢记得。'}));localStorage.setItem('jiangmen-travel-wishlist',JSON.stringify(['place-zili','place-bird','food-waihai-noodles','place-invalid']));localStorage.setItem('passport-integrated-seed','yes');}});
  const page=await context.newPage();watch(page);await page.goto(base+'/travel.html');
  assert.equal(await page.locator('button[data-visit-id]').count(),20);assert.equal(await page.locator('#travel-passport-data').count(),1);
  await page.locator('[data-visit-id="zili"]').click();await page.locator('[data-visit-id="bird"]').click();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),visitedKey),['zili','bird']);
  await page.goto(base+'/letters.html');assert.equal(await page.locator('#travel-passport-data').count(),1);
  await page.waitForFunction(()=>document.querySelector('[data-passport-count="visited"]').textContent==='2');
  assert.equal(await page.locator('[data-passport-count="wishlist"]').textContent(),'2');assert.equal(await page.locator('[data-passport-count="regions"]').textContent(),'2');
  assert.equal(await page.locator('#recipient').inputValue(),'同行的朋友');assert.equal(await page.locator('#message').inputValue(),'沿途的风景，慢慢记得。');
  assert.equal(await page.locator('[data-passport].owned').count(),2);
  await page.locator('.travel-passport-manage summary').click();await page.locator('#travel-passport [data-visit-id="zili"]').click();
  assert.equal(await page.locator('[data-passport-count="visited"]').textContent(),'1');assert.equal(await page.locator('[data-passport-count="wishlist"]').textContent(),'2');
  assert.equal(await page.locator('[data-passport-region="开平市"]').getAttribute('class'),'travel-passport-stamp');
  const second=await context.newPage();watch(second);await second.goto(base+'/travel.html');assert.equal(await second.locator('[data-visit-id="zili"]').getAttribute('aria-pressed'),'false');await second.locator('[data-visit-id="qiming"]').click();await page.waitForFunction(()=>document.querySelector('[data-passport-count="visited"]').textContent==='2');
  await second.locator('[data-save="place-qiming"]').click();await page.waitForFunction(()=>document.querySelector('[data-passport-count="wishlist"]').textContent==='3');
  assert.equal(await page.evaluate(()=>localStorage.getItem('jiangmen-letter-stamps')),'[0,2]');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jiangmen-letter-draft')).message),'沿途的风景，慢慢记得。');
  report.checks.push('Real travel→letters, independent wishlist, cancel last region stamp, cross-tab visited/wishlist, culture stamps and draft preserved');
  // Exercise all 20 real buttons, leaving the profile in its maximum content state.
  for(const place of places){const button=second.locator('[data-visit-id="'+place.id+'"]');if(await button.getAttribute('aria-pressed')!=='true')await button.click();}
  await page.waitForFunction(()=>document.querySelector('[data-passport-count="visited"]').textContent==='20');assert.equal(await page.locator('[data-passport-count="regions"]').textContent(),'7');
  await page.locator('[data-passport-name]').fill('山海之间慢慢走过江门的二十字旅行者甲乙丙丁');assert((await page.locator('[data-passport-name]').inputValue()).length<=20);
  await page.locator('.travel-passport-manage summary').click();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'letters overflow '+width);if(width===320||width===1440){await page.evaluate(()=>{document.activeElement.blur();document.querySelector('#travel-passport').scrollIntoView({block:'start',behavior:'instant'});});report.checks.push({width,skipTop:await page.locator('.skip').evaluate(el=>el.getBoundingClientRect().top)});await page.screenshot({path:path.join(out,'整合-页面-'+width+'.png')});await page.locator('#travel-passport').screenshot({path:path.join(out,'整合-护照-'+width+'.png'),style:'.site-header,.skip{visibility:hidden!important}'});}}
  await page.locator('[data-passport-preview]').click();await page.locator('[data-passport-image]').waitFor({state:'visible'});assert(await page.locator('[data-passport-image]').evaluate(img=>img.complete&&img.naturalWidth===1400&&img.naturalHeight===1740));
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-passport-export]').click();const download=await downloadPromise;await download.saveAs(path.join(out,'整合-旅行纪念卡-20景点.png'));assert(fs.statSync(path.join(out,'整合-旅行纪念卡-20景点.png')).size>10000);
  assert.equal(await page.locator('[data-passport-image]').evaluate(img=>{const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});img.dispatchEvent(event);return event.defaultPrevented;}),false);
  await page.locator('[data-passport-close-preview]').click();
  // The original postcard export still works after the new passport export.
  const oldDownload=page.waitForEvent('download');await page.locator('#card-form button[type="submit"]').click();await oldDownload;
  assert.equal(await page.locator('#recipient').inputValue(),'同行的朋友');assert.equal(await page.locator('[data-passport-count="visited"]').textContent(),'20');
  report.checks.push('20 real visit buttons, seven region stamps, 20-character input, 320/390/768/1440 widths, 1400×1740 PNG, save-menu fallback, original postcard export');
  await second.close();
  await page.evaluate(key=>{localStorage.removeItem(key);window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));},visitedKey);
  await page.waitForFunction(()=>document.querySelector('[data-passport-count="visited"]').textContent==='0');
  await page.locator('[data-passport-name]').fill('');await page.locator('[data-passport-preview]').click();assert((await page.locator('[data-passport-canvas]').getAttribute('aria-label')).includes('行前'));
  const pretripDownload=page.waitForEvent('download');await page.locator('[data-passport-export]').click();await (await pretripDownload).saveAs(path.join(out,'整合-行前卡-空记录.png'));
  report.checks.push('pageshow refresh and empty-record pretrip PNG');await context.close();
  const denied=await setup({viewport:{width:320,height:800}});await denied.addInitScript(()=>{localStorage.setItem('jiangmen-travel-visited-v1','["bird"]');localStorage.setItem('jiangmen-travel-wishlist','["place-zili"]');Storage.prototype.setItem=function(){throw Error('write denied');};});const dp=await denied.newPage();watch(dp);await dp.goto(base+'/travel.html');await dp.locator('[data-visit-id="zili"]').click();await dp.locator('[data-save="place-qiming"]').click();assert((await dp.locator('[data-visited-storage-status]').textContent()).includes('去过记录仅当前页有效（2 处）'));assert((await dp.locator('[data-visited-storage-status]').textContent()).includes('想去清单也仅当前页有效'));assert.equal(await dp.evaluate(key=>localStorage.getItem(key),visitedKey),'["bird"]');assert.equal(await dp.evaluate(key=>localStorage.getItem(key),wishKey),'["place-zili"]');await dp.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await dp.waitForTimeout(40);assert.equal(await dp.locator('[data-visit-id="zili"]').getAttribute('aria-pressed'),'true');assert.equal(await dp.locator('[data-save="place-qiming"]').getAttribute('aria-pressed'),'true');assert(await dp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await denied.close();
  report.checks.push('Real guide custom event with write-denied memory state, unchanged stored values and pageshow memory retention');
  const nojs=await setup({javaScriptEnabled:false,viewport:{width:320,height:800}}),np=await nojs.newPage();await np.goto(base+'/letters.html');assert(await np.locator('[data-passport-export]').isHidden());assert(await np.locator('#travel-passport [data-visit-id]').first().isHidden());await np.locator('.travel-passport-manage summary').click();assert.equal(await np.locator('#travel-passport a[href^="travel.html#place-"]:visible').count(),20);assert(await np.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await nojs.close();report.checks.push('Actual no-JS page keeps all 20 usable guide links and hides enhancement controls');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.localFailures,[]);report.passed=true;
  console.log('PASS: integrated passport with actual travel/letters pages and original postcard. '+report.checks.length+' check groups.');
 }finally{fs.writeFileSync(path.join(out,'整合验证结果.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

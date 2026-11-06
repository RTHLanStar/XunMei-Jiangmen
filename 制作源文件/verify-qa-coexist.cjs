/* Contract tests: no messages are sent to the actual online service. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/在线离线问答验证');fs.mkdirSync(out,{recursive:true});
const sdk='https://trtc.io/knocket-sdk/sdk.js?identifier=7cacdcf02616dcfa4e&v=1792068177788';
const files=['index','stories','letters','about','travel','food','routes','faq','tour'];
const report={checkedAt:new Date().toISOString(),passed:false,checks:[],errors:[],scope:'Chromium模拟；在线按钮使用已核对SDK接口的替身，不发送客服消息、不验证云端回答。'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/v2\.2\//,'');const f=path.resolve(dist,rel||'index.html');if(!f.startsWith(dist+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
const fake=(ready)=>`(()=>{let ready=${ready},events=[];window.__chatOpens=0;window.__chatReady=()=>{ready=true;events.forEach(fn=>fn());events=[]};window.contactWidget={show(){window.__widgetShown=true},showChat(){window.__chatOpens++},on(name,fn){if(name==='ready'){if(ready)fn();else events.push(fn)}}}})();`;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v2.2/`,browser=await chromium.launch({executablePath});
 const context=async(mode,options={})=>{const c=await browser.newContext(options);await c.route('**/*',r=>{const u=r.request().url();if(u===sdk)return mode==='failed'?r.abort():r.fulfill({contentType:'text/javascript',body:fake(mode==='ready')});return u.startsWith(base)||u.startsWith('data:')?r.continue():r.abort();});c.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));return c;};
 const pass=name=>report.checks.push({name,passed:true});
 try{
  const c=await context('ready',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage();
  for(const file of files){
   const html=fs.readFileSync(path.join(dist,file+'.html'),'utf8');assert.equal(html.split(sdk).length-1,1);assert.equal((html.match(/src="online-help.js/g)||[]).length,1);
   await p.goto(base+file+'.html');assert.equal(await p.evaluate(()=>window.__chatOpens),0);
   assert.equal(await p.locator('.site-utility a[href="faq.html"]').innerText(),'离线问答');
   await p.locator('.site-utility [data-online-chat]').click();assert.equal(await p.evaluate(()=>window.__chatOpens),1);assert(await p.evaluate(()=>window.__widgetShown));
   for(const width of [320,390,844]){await p.setViewportSize({width,height:844});assert(await p.evaluate(w=>document.documentElement.clientWidth<=w+1&&document.documentElement.scrollWidth<=w+1,width),file+' overflow '+width);}
  }pass('9-pages:exact-original-sdk-both-entries-user-only-opening-27-layouts');await c.close();
  const delayed=await context('delayed',{viewport:{width:320,height:844}}),d=await delayed.newPage();await d.goto(base+'faq.html');await d.locator('.qa-modes [data-online-chat]').click();assert.equal(await d.evaluate(()=>window.__chatOpens),0);assert.match(await d.locator('.qa-modes [data-online-status]').innerText(),/正在连接/);await d.evaluate(()=>window.__chatReady());assert.equal(await d.evaluate(()=>window.__chatOpens),1);assert.equal(await d.locator('[aria-busy=true]').count(),0);await d.locator('#faq-query').fill('陈皮');assert(await d.locator('.faq-item:visible').count()>0);await d.screenshot({path:path.join(out,'faq-320-both.png')});await delayed.close();pass('delayed-sdk:wait-for-ready-open-once-local-search-independent');
  const failed=await context('failed',{viewport:{width:390,height:844}}),f=await failed.newPage();await f.goto(base+'faq.html');await f.locator('.qa-modes [data-online-chat]').click();await f.waitForFunction(()=>document.querySelector('.qa-modes [data-online-status]').textContent.includes('暂未连接'),{},{timeout:16000});assert.equal(await f.locator('[aria-busy=true]').count(),0);await f.locator('#faq-query').fill('外海面');assert(await f.locator('#q-17').isVisible());await failed.setOffline(true);await f.locator('.qa-modes [data-online-chat]').click();assert.match(await f.locator('.qa-modes [data-online-status]').innerText(),/网络不可用/);await f.locator('#faq-clear').click();assert.equal(await f.locator('.faq-item:visible').count(),94);await f.screenshot({path:path.join(out,'faq-390-offline.png')});await failed.close();pass('failed-sdk-and-offline:bounded-wait-local-94-answers-still-work');
  const no=await context('failed',{javaScriptEnabled:false,viewport:{width:320,height:844}}),n=await no.newPage();await n.goto(base+'faq.html');assert.equal(await n.locator('[data-online-chat]:visible').count(),0);await n.locator('#q-10 summary').click();assert(await n.locator('#q-10 .faq-answer').isVisible());await no.close();pass('no-js:online-explanation-and-all-static-answers');
  assert.deepEqual(report.errors,[]);report.passed=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}
 finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'共存功能验证.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();

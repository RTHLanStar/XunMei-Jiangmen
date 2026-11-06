/* Runs the shipped HTML/JS locally; also serves the current CSS sources before bundling. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/风物轮播验证');
const report={checkedAt:new Date().toISOString(),checks:[],pageErrors:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.vtt':'text/vtt'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/v2\.2\//,'');
 const file=path.resolve(dist,rel||'index.html');
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 if(!process.argv.includes('--bundle')&&/^site-[\da-f]+\.css$/.test(rel))res.end(['style.css','pages.css','letters.css','polish.css','readability.css','guide.css'].map(name=>fs.readFileSync(path.join(dist,name),'utf8')).join('\n'));
 else fs.createReadStream(file).pipe(res);
});
let browser,base;
async function ready(page,index){await page.waitForFunction(index=>document.getElementById('chapter-title').textContent===['楼的远望','街的回声','水的来信','味的归途'][index]&&document.getElementById('chapter-art').getAttribute('aria-busy')==='false',index)}
async function selected(page){return Number(await page.locator('[data-chapter][aria-selected="true"]').getAttribute('data-chapter'))}
async function gesture(page,points,{cancel=false,pinch=false}={}){
 await page.locator('.chapter-image').evaluate((el,{points,cancel,pinch})=>{
  const emit=(type,p,id=1)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===1,button:0,buttons:type==='pointerup'?0:1,clientX:p[0],clientY:p[1]}));
  emit('pointerdown',points[0]);if(pinch)emit('pointerdown',[points[0][0]+30,points[0][1]],2);
  for(const p of points.slice(1))emit('pointermove',p);
  emit(cancel?'pointercancel':'pointerup',points.at(-1));if(pinch)emit('pointerup',[points[0][0]+30,points[0][1]],2);
 },{points,cancel,pinch});
}
async function check(name,fn,{reduce=false}={}){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3,reducedMotion:reduce?'reduce':'no-preference'});
 // External support SDK is unrelated to carousel navigation; no test contacts its service.
 await context.route('https://trtc.io/**',route=>route.abort());
 const page=await context.newPage();page.setDefaultTimeout(6000);page.on('pageerror',e=>report.pageErrors.push({name,message:e.message}));
 const result={name,passed:false};
 try{await page.goto(base+'index.html',{waitUntil:'load'});await ready(page,0);await fn(page,result);result.passed=true;console.log('PASS',name)}
 catch(e){result.error=e.stack;console.log('FAIL',name,e.message)}
 finally{report.checks.push(result);await context.close()}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}/v2.2/`;
 browser=await chromium.launch({executablePath,headless:true});
 fs.mkdirSync(out,{recursive:true});
 try{
  await check('simplified-controls-and-synchronized-content',async(p,r)=>{
   assert.equal(await p.locator('.chapter-controls, #chapter-prev, #chapter-next, #carousel-status, #carousel-hint, .carousel-hint').count(),0,'Removed navigation controls and swipe hint must not remain in the DOM');
   assert.equal(await p.getByText('左右滑动图片，继续读信',{exact:false}).count(),0);
   const dangling=await p.locator('#journey [aria-describedby]').evaluateAll(elements=>elements.flatMap(el=>el.getAttribute('aria-describedby').split(/\s+/).filter(id=>id&&!document.getElementById(id))));
   assert.deepEqual(dangling,[],'Chapter descriptions must not reference deleted elements');
   for(const i of [1,2,3,0]){await p.locator(`#tab-${i}`).click();await ready(p,i);assert.equal(await selected(p),i);assert.equal(await p.locator('#chapter-number').textContent(),`0${i+1} / 04`);assert.equal(await p.locator('#chapter-art').getAttribute('aria-label'),['开平 · 碉楼与村落','开平 · 赤坎骑楼意象','江门 · 西江水岸意象','新会 · 陈皮与手艺'][i]+'的AI艺术演绎')}
   await p.locator('#chapter').focus();await p.keyboard.press('ArrowLeft');await ready(p,3);assert.equal(await selected(p),3);
   assert((await p.locator('#chapter-visit').getAttribute('href')).includes('place-chenpi'));
   await p.locator('#journey').screenshot({path:path.join(out,'手机版轮播.png')});
   r.finalChapter=await p.locator('#chapter-title').textContent();
  });
  await check('swipe-intent-cancel-and-pinch',async(p,r)=>{
   await gesture(p,[[280,150],[180,153],[100,154]]);await ready(p,1);assert.equal(await selected(p),1);
   await gesture(p,[[100,150],[180,152],[280,153]]);await ready(p,0);
   for(const [points,options] of [[[[200,100],[204,140],[80,260]],{}],[[[200,100],[170,102]],{}],[[[260,100],[100,102]],{cancel:true}],[[[260,100],[100,102]],{pinch:true}]]){
    await gesture(p,points,options);assert.equal(await selected(p),0,'Vertical, short, cancelled and pinch gestures must not change chapter');
   }
   const touch=await p.locator('.chapter-image').evaluate(el=>getComputedStyle(el).touchAction);assert(touch.includes('pan-y')&&touch.includes('pinch-zoom'));r.touchAction=touch;
   await p.waitForTimeout(1200);assert.equal(await selected(p),0,'Slides must not autoplay');
  });
  await check('keyboard-tabs-and-reduced-motion',async p=>{
   await p.locator('#tab-0').focus();await p.keyboard.press('ArrowRight');await ready(p,1);assert.equal(await p.locator(':focus').getAttribute('id'),'tab-1');
   await p.keyboard.press('End');await ready(p,3);await p.keyboard.press('Home');await ready(p,0);
   await p.locator('#chapter').focus();await p.keyboard.press('ArrowLeft');await ready(p,3);
   await p.keyboard.press('ArrowRight');await ready(p,0);
   assert.equal(await p.locator('#chapter-art').evaluate(el=>el.getAnimations({subtree:true}).length),0);
  },{reduce:true});
  await check('native-chromium-touch-swipe-and-vertical-scroll',async(p,r)=>{
   const cdp=await p.context().newCDPSession(p);
   async function touch(points){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:points[0][0],y:points[0][1]}]});
    for(const point of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point[0],y:point[1]}]});await p.waitForTimeout(25)}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }
   await p.locator('.chapter-image').scrollIntoViewIfNeeded();let b=await p.locator('.chapter-image').boundingBox();
   await touch([[b.x+b.width*.8,b.y+b.height*.5],[b.x+b.width*.6,b.y+b.height*.5],[b.x+b.width*.4,b.y+b.height*.5],[b.x+b.width*.2,b.y+b.height*.5]]);await ready(p,1);
   await p.locator('.chapter-image').scrollIntoViewIfNeeded();b=await p.locator('.chapter-image').boundingBox();const before=await p.evaluate(()=>scrollY);
   await touch([[b.x+b.width*.5,b.y+b.height*.8],[b.x+b.width*.5,b.y+b.height*.6],[b.x+b.width*.5,b.y+b.height*.4],[b.x+b.width*.5,b.y+b.height*.2]]);
   await p.waitForTimeout(150);assert.equal(await selected(p),1,'Vertical scrolling must not advance the slide');const after=await p.evaluate(()=>scrollY);assert(after>before+20,'Vertical movement on the image should scroll the page');r.verticalScrollPixels=after-before;
   r.engine='Headless Chromium touch emulation; not a real WeChat test';await cdp.detach();
  });
  await check('late-image-response-cannot-replace-current-slide',async p=>{
   let release;const held=new Promise(resolve=>release=resolve);
   await p.route('**/assets/scene-1.webp',async route=>{await held;await route.continue()});
   try{await p.locator('#tab-1').click();await p.locator('#tab-2').click();await ready(p,2);release();await p.waitForTimeout(400);assert.equal(await selected(p),2);assert((await p.locator('#chapter-art img').last().getAttribute('src')).endsWith('scene-2.webp'));assert.equal(await p.locator('#chapter-title').textContent(),'水的来信');assert.equal(await p.locator('#chapter-number').textContent(),'03 / 04')}
   finally{release()}
  });
  await check('collection-blocks-navigation-until-settled',async(p,r)=>{
   // Hold the real asynchronous loader during collection, then release it unchanged.
   await p.evaluate(()=>{const original=Jiangmen.loadScene;let release;const held=new Promise(resolve=>release=resolve);window.releaseScene=release;Jiangmen.loadScene=async i=>{await held;return original(i)}});
   await p.locator('#collect').click();assert.equal(await p.locator('#chapter').getAttribute('aria-busy'),'true');
   for(const i of [0,1,2,3])assert(await p.locator(`#tab-${i}`).isDisabled());
   await gesture(p,[[280,150],[100,153]]);assert.equal(await selected(p),0);
   await p.locator('#tab-2').evaluate(el=>el.click());assert.equal(await selected(p),0,'Disabled chapter tabs must not navigate during collection');
   await p.locator('#chapter').focus();await p.keyboard.press('ArrowRight');assert.equal(await selected(p),0);
   await p.evaluate(()=>window.releaseScene());await ready(p,1);assert.equal(await p.locator('#progress').textContent(),'已收集 1 / 4 枚文化印记');
   assert.equal(await p.locator('.chapter-fragments').count(),0);for(const i of [0,1,2,3])assert(await p.locator(`#tab-${i}`).isEnabled());r.selected=await selected(p);
  });
  await check('failed-image-keeps-navigation-and-retry',async p=>{
   await p.route('**/assets/scene-1.webp',route=>route.abort());await p.locator('#tab-1').click();await ready(p,1);
   assert(await p.locator('.chapter-art-error').isVisible());assert(await p.locator('#collect').isDisabled());assert(await p.locator('#tab-2').isEnabled());
   await p.unroute('**/assets/scene-1.webp');await p.locator('#tab-1').click();await ready(p,1);
   assert.equal(await p.locator('.chapter-art-error').count(),0);assert(await p.locator('#collect').isEnabled());
   await gesture(p,[[280,150],[100,153]]);await ready(p,2);
  });
  await check('narrow-and-enlarged-text-stays-in-viewport',async(p,r)=>{
   r.widths=[];
   for(const width of [320,375,390,430,844,1440]){await p.setViewportSize({width,height:844});await p.locator('#journey').scrollIntoViewIfNeeded();await p.waitForTimeout(150);const size=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert(size.scroll<=width+1,`${width}px viewport overflowed to ${size.scroll}px`);r.widths.push(width)}
   await p.setViewportSize({width:1440,height:1600});
   await p.locator('#journey').evaluate(el=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,el.offsetTop-125)});
   await p.locator('#journey').screenshot({path:path.join(out,'桌面版轮播.png')});
   await p.setViewportSize({width:320,height:844});await p.addStyleTag({content:'#journey{font-size:200%} #journey .chapter-tabs button{font-size:26px}'});const size=await p.evaluate(()=>document.documentElement.scrollWidth);assert(size<=321);
  });
 }finally{report.passed=report.checks.every(c=>c.passed)&&report.pageErrors.length===0;fs.writeFileSync(path.join(out,'验证结果.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));console.log('RESULT',report.passed?'PASS':'FAIL');if(!report.passed)process.exitCode=1}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

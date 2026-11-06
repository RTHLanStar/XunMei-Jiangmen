/* Verify the shipped CSS timeline, accessible title and unchanged page geometry. */
const {chromium,executablePath}=require('./browser-runtime.cjs');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/标题动效验证');
fs.mkdirSync(out,{recursive:true});
const title='山海有归处。侨乡有来信。';
const report={checkedAt:new Date().toISOString(),engine:'Chromium; mobile emulation, not WeChat hardware',checks:[]};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.vtt':'text/vtt'};
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/v2\.2\//,'');
 const file=path.resolve(dist,rel||'index.html');
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
function state(){
 const h=document.querySelector('#hero-title'),r=h.getBoundingClientRect();
 const chars=[...h.querySelectorAll('.hero-type-char')];
 return {visible:chars.filter(c=>Number(getComputedStyle(c).opacity)>.5).length,
 cursors:chars.filter(c=>Number(getComputedStyle(c,'::after').opacity)>.5&&getComputedStyle(c,'::after').display!=='none').length,
 rect:[r.x,r.y,r.width,r.height],next:document.querySelector('.intro').getBoundingClientRect().top,
 width:document.documentElement.scrollWidth};
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/v2.2/`;
 const browser=await chromium.launch({executablePath});
 try{
  for(const [width,large] of [[320,false],[390,false],[430,false],[844,false],[1440,false],[320,true],[390,true]]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700,reducedMotion:'no-preference'});
   await context.route('https://**',r=>r.abort());
   await context.route('**/index.html',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(dist,'index.html'),'utf8').replace('</head>','<style>.hero-type-char,.hero-type-char::after{animation-play-state:paused!important}</style></head>')}));
   const p=await context.newPage();await p.goto(base+'index.html');await p.evaluate(()=>document.fonts.ready);
   if(large)await p.addStyleTag({content:'#hero-title{font-size:70px!important}'});
   assert.equal(await p.getByRole('heading',{level:1,name:title,exact:true}).count(),1);
   await p.evaluate(()=>{window.titleAnimations=document.querySelector('#hero-title').getAnimations({subtree:true});});
   const states=[];
   for(const [time,count] of [[0,0],[750,4],[1150,6],[1600,8],[3000,12],[6000,12]]){
    await p.evaluate(t=>window.titleAnimations.forEach(a=>{a.pause();a.currentTime=t;}),time);
    const s=await p.evaluate(state);assert.equal(s.visible,count,`width ${width}, time ${time}`);
    assert.equal(s.cursors,time>0&&time<3000?1:0,'Only the active character has a caret');
    assert(s.width<=width+1,`Overflow at ${width}`);states.push(s);
    if(width===390&&!large&&[750,1150,3000].includes(time))await p.locator('.hero-copy').screenshot({path:path.join(out,`title-${time}ms-390.png`)});
   }
   for(const s of states){assert.deepEqual(s.rect,states[0].rect);assert.equal(s.next,states[0].next);}
   await p.locator('#hero-title').evaluate(h=>{h.innerHTML='山海有归处。<br>侨乡有来信。';});
   const baseline=await p.evaluate(state);assert.deepEqual(baseline.rect,states[0].rect);assert.equal(baseline.next,states[0].next);
   report.checks.push({width,large,progressive:true,oneShot:true,noLayoutShift:true,accessible:true});await context.close();
  }
  for(const mode of ['reduce','no-css','no-js','normal']){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='normal'?'no-preference':'reduce',javaScriptEnabled:mode!=='no-js'});
   await context.route('https://**',r=>r.abort());
   if(mode==='no-css')await context.route('**/*.css',r=>r.abort());
   const p=await context.newPage();await p.goto(base+'index.html');
   if(mode==='normal')await p.waitForFunction(()=>[...document.querySelectorAll('.hero-type-char')].every(c=>getComputedStyle(c).opacity==='1')&&[...document.querySelectorAll('.hero-type-char')].every(c=>getComputedStyle(c,'::after').opacity==='0'));
   const s=await p.evaluate(state);assert.equal(s.visible,12);assert.equal(await p.locator('#hero-title').textContent(),title);
   if(mode==='reduce')assert.equal(await p.locator('#hero-title').evaluate(h=>h.getAnimations({subtree:true}).length),0);
   if(mode==='normal'){await p.emulateMedia({reducedMotion:'reduce'});assert.equal((await p.evaluate(state)).visible,12);}
   report.checks.push({mode,fullTitleReadable:true});await context.close();
  }
  report.passed=true;fs.writeFileSync(path.join(out,'验证结果.json'),JSON.stringify(report,null,2));console.log('PASS: 11 title scenarios; progressive reveal, sentence pause, single caret, unchanged layout, accessible heading, reduced motion, no CSS/JS and real-time finish.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

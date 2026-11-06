/* Hidden, local-only browser validation for sharing/print presentation. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium,executablePath}=require('./browser-runtime.cjs');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site/dist'),out=path.join(root,'材料/分享与打印验证');
const css=fs.readFileSync(path.join(dist,'presentation.css'),'utf8');
const js=fs.readFileSync(path.join(dist,'presentation.js'),'utf8');
const tools='<div class="print-tools" data-print-tools hidden><button type="button" data-print-page>打印这一页</button><span>保留当前筛选结果和资料来源，可保存为 PDF。</span><p data-print-status role="status" hidden></p></div>';
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');
  let relative=decodeURIComponent(url.pathname).replace(/^\/v2\.2\//,'');
  const file=path.resolve(dist,relative||'index.html');
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  let data=fs.readFileSync(file);
  if(file.endsWith('.html')){
    let html=data.toString().replace(/<script\b[^>]*src="https:\/\/trtc\.io[^>]*><\/script>/g,'');
    if(url.searchParams.has('qa-presentation')) html=html.replace('</head>','<style>'+css+'</style></head>');
    data=Buffer.from(html);
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/v2.2/`,report={checks:[],errors:[]};
 let browser;
 try{
  browser=await chromium.launch({executablePath});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>report.errors.push(error.message));
  for(const file of ['travel','food','routes',...(fs.existsSync(path.join(dist,'faq.html'))?['faq']:[])]){
    console.log('Checking presentation:',file);
    await page.goto(base+file+'.html',{waitUntil:'networkidle'});
    const target=['travel','food'].includes(file)?'.guide-card':file==='routes'?'.route-card':'.faq-item';
    const initial=await page.locator(target).first().boundingBox();
    await page.addStyleTag({content:css});
    const after=await page.locator(target).first().boundingBox();
    assert.deepStrictEqual(after,initial,file+' normal screen layout changed');
    if(!await page.locator('[data-print-tools]').count())await page.locator('main').evaluate((main,html)=>main.insertAdjacentHTML('beforeend',html),tools);
    if(!await page.locator('script[src^="presentation.js"]').count())await page.addScriptTag({content:js});
    await page.evaluate(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;});
    assert.equal(await page.evaluate(()=>window.__printCalls),0,'No automatic print');
    await page.locator('[data-print-page]').click();assert.equal(await page.evaluate(()=>window.__printCalls),1);
    if(['travel','food'].includes(file)){
      await page.locator('[name=area]').selectOption('新会');
      assert(await page.locator(target+'[hidden]').count()>0);
    }
    if(file==='faq') await page.locator('#faq-query').fill('锦江温泉');
    const beforeIds=await page.locator(target+':visible').evaluateAll(items=>items.map(x=>x.id));
    const beforeOpen=await page.locator('main details').evaluateAll(items=>items.map(x=>x.open));
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({media:'print'});
    const printIds=await page.locator(target+':visible').evaluateAll(items=>items.map(x=>x.id));
    assert.deepStrictEqual(printIds,beforeIds,file+' print resurrected filtered content');
    assert.equal(await page.locator('[data-print-tools]:visible').count(),0);
    assert.equal(await page.locator('.site-header:visible').count(),0);
    const source=file==='faq'?'.faq-sources':'.source-details';
    assert(await page.locator(target+':visible '+source+':visible').count()>0,file+' missing visible sources');
    if(file!=='faq'){
      const detail=page.locator(target+':visible .source-details').first();
      assert(await detail.locator('p').first().isVisible(),file+' source body remains collapsed');
      const photo=await page.locator(target+':visible .place-photo').first().boundingBox();
      assert(photo.width<180,file+' oversized print photo');
      assert(await detail.locator('.photo-credit').isVisible(),file+' photo credit hidden');
    }
    if(file==='travel')await page.pdf({path:path.join(out,'filtered-travel-print.pdf'),format:'A4',printBackground:true});
    if(file==='faq')await page.pdf({path:path.join(out,'filtered-faq-print.pdf'),format:'A4',printBackground:true});
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    const afterOpen=await page.locator('main details').evaluateAll(items=>items.map(x=>x.open));
    assert.deepStrictEqual(afterOpen,beforeOpen,file+' expanded disclosure state was not restored');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' screen overflow');
    report.checks.push({file,screenLayoutUnchanged:true,filteredCount:printIds.length,printSources:true,disclosureRestored:true});
  }
  console.log('Checking presentation: keyboard and no-JS');
  await page.goto(base+'travel.html',{waitUntil:'networkidle'});await page.addStyleTag({content:css});
  await page.keyboard.press('Tab');
  let focus=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);
  assert.equal(focus,'solid');
  await page.emulateMedia({forcedColors:'active'});
  focus=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);assert.equal(focus,'solid');
  report.checks.push({name:'keyboard-focus-and-forced-colors',passed:true});
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await nojs.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const staticPage=await nojs.newPage();staticPage.setDefaultTimeout(10000);
  console.log('Checking presentation: no-JS navigation');
  await staticPage.goto(base+'travel.html?qa-presentation=1',{waitUntil:'networkidle'});
  console.log('Checking presentation: no-JS print');
  await staticPage.emulateMedia({media:'print'});
  assert(await staticPage.locator('.guide-card .source-details p').first().isVisible(),'CSS-only sources not visible');
  assert.equal(await staticPage.locator('[data-print-tools]:visible').count(),0,'No-JS button must be hidden');
  report.checks.push({name:'no-javascript-print-fallback',passed:true});
  if(fs.existsSync(path.join(dist,'faq.html'))){
    await staticPage.goto(base+'faq.html?qa-presentation=1',{waitUntil:'networkidle'});
    assert(await staticPage.locator('.faq-answer p').first().isVisible(),'CSS-only FAQ answers not visible');
    assert(await staticPage.locator('.faq-sources').first().isVisible(),'CSS-only FAQ sources not visible');
    report.checks.push({name:'no-javascript-faq-print-fallback',passed:true});
  }
  await nojs.close();assert.deepStrictEqual(report.errors,[]);
  fs.writeFileSync(path.join(out,'presentation-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

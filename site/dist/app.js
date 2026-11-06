'use strict';
const $=id=>document.getElementById(id),chapters=window.JIANGMEN_CHAPTERS,toast=Jiangmen.toast;
let current=0,transitioning=false,owned=Jiangmen.readOwned(),sceneArtwork=null,pendingStampSync=false,artRequest=0,artPending=false,artReady=-1,artAnimation=null;
const chapterMotion=matchMedia('(prefers-reduced-motion: reduce)');
const chapterImage=document.querySelector('.chapter-image');
const visitLinks=['travel.html#place-zili','travel.html#place-chikan','travel.html?area=%E9%B9%A4%E5%B1%B1#places','travel.html#place-chenpi'];
let gesture=null;
const activePointers=new Set();
chapterMotion.addEventListener('change',event=>{
 if(event.matches)resetGesture();
 if(!event.matches||!artAnimation)return;
 artAnimation.cancel();artAnimation=null;
 const el=$('chapter-art'),latest=el.lastElementChild;
 if(latest)el.replaceChildren(latest);
});
async function paintArt(el,i,direction=0){
 const request=++artRequest;artPending=true;artReady=-1;el.setAttribute('aria-busy','true');
 if(artAnimation){artAnimation.cancel();artAnimation=null;const visible=el.lastElementChild;if(visible)el.replaceChildren(visible)}
 try{
  const img=new Image();img.alt='';img.decoding='async';img.draggable=false;
  if(location.protocol==='file:'){img.src=`assets/scene-${i}.webp`;await img.decode()}
  else{const loaded=await Jiangmen.loadScene(i);img.src=loaded.image.src;await img.decode()}
  if(request!==artRequest)return;
  img.width=img.naturalWidth;img.height=img.naturalHeight;
  const previous=el.firstElementChild;Object.assign(img.style,{position:'absolute',inset:'0'});
  el.className=`art scene-${i}`;el.setAttribute('aria-label',chapters[i].place+'的AI艺术演绎');el.append(img);artReady=i;
  if(previous?.tagName==='IMG'&&!chapterMotion.matches&&typeof img.animate==='function'){
   const animation=img.animate([{opacity:0,transform:`translateX(${direction*7}%)`},{opacity:1,transform:'translateX(0)'}],{duration:320,easing:'cubic-bezier(.2,.7,.3,1)'});artAnimation=animation;
   animation.finished.catch(()=>{}).then(()=>{if(request===artRequest){el.replaceChildren(img);artAnimation=null}});
  }else el.replaceChildren(img);
 }catch{if(request===artRequest){
  artReady=-1;
  const notice=document.createElement('div');notice.className='chapter-art-error';
  const title=document.createElement('strong');title.textContent=chapters[i].title;
  const message=document.createElement('p');message.textContent='风景图片暂时未能加载';
  const retry=document.createElement('small');retry.textContent='再次点选上方本章标签，即可重试。';
  notice.append(title,message,retry);el.className=`art scene-${i}`;el.replaceChildren(notice);
  el.setAttribute('aria-label',chapters[i].place+'的风景图片加载失败；请再次点选本章标签重试。');
  toast('这张风景暂时未能加载，请再次点击章节重试。');
 }}
 finally{if(request===artRequest){artPending=false;el.setAttribute('aria-busy','false');updateStamps()}}
}
function updateStamps(){
 document.querySelectorAll('[data-stamp]').forEach(el=>{const has=owned.has(+el.dataset.stamp);el.classList.toggle('owned',has);el.setAttribute('aria-label',el.textContent+(has?'，已收集':'，未收集'))});
 $('progress').textContent=`已收集 ${owned.size} / 4 枚文化印记`;
 $('collect').disabled=transitioning||artPending||artReady!==current||owned.has(current);$('collect').textContent=owned.has(current)?`已收藏「${chapters[current].stamp}」印记 ✓`:`收藏「${chapters[current].stamp}」印记 ＋`;
 $('journey-complete').hidden=owned.size!==4||transitioning;
}
function choose(i,direction=Math.sign(i-current)){if(transitioning)return;resetGesture();current=i;const c=chapters[i],story=window.JIANGMEN_STORIES?.[i];
 document.querySelectorAll('[data-chapter]').forEach(el=>{const on=+el.dataset.chapter===i;el.setAttribute('aria-selected',String(on));el.tabIndex=on?0:-1});
 $('chapter').setAttribute('aria-labelledby',`tab-${i}`);paintArt($('chapter-art'),i,direction);$('chapter-place').textContent=c.place;$('chapter-number').textContent=`0${i+1} / 04`;$('chapter-title').textContent=c.title;$('chapter-category').textContent=c.category;document.querySelector('.chapter-copy').dataset.watermark=['楼','街','水','味'][i];
 $('chapter-visit').href=visitLinks[i];
 $('chapter-poem').replaceChildren(document.createTextNode(c.poem[0]),document.createElement('br'),document.createTextNode(c.poem[1]));$('chapter-fact').textContent=c.fact;$('chapter-thought').textContent=c.thought;$('chapter-source').href=c.source;
 $('chapter-story').open=false;$('story-detail').textContent=story?.detail||c.fact;$('story-link').href='stories.html#'+(story?.id||['tower','street','river','peel'][i]);updateStamps();
}
function setChapterBusy(busy){transitioning=busy;if(busy)resetGesture();$('chapter').setAttribute('aria-busy',String(busy));document.querySelectorAll('[data-chapter]').forEach(el=>el.disabled=busy);$('reset').disabled=busy;updateStamps()}
for(const el of document.querySelectorAll('[data-chapter]')){el.addEventListener('click',()=>choose(+el.dataset.chapter));el.addEventListener('keydown',e=>{if(transitioning)return;let i=current;if(e.key==='ArrowRight')i=(i+1)%4;else if(e.key==='ArrowLeft')i=(i+3)%4;else if(e.key==='Home')i=0;else if(e.key==='End')i=3;else return;e.preventDefault();choose(i);$(`tab-${i}`).focus()})}
function moveChapter(direction){if(transitioning||artPending)return;choose((current+direction+chapters.length)%chapters.length,direction)}
$('chapter').addEventListener('keydown',event=>{
 if(event.target!==$('chapter')||event.altKey||event.ctrlKey||event.metaKey)return;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveChapter(event.key==='ArrowRight'?1:-1)}
});
function resetGesture(){gesture=null;chapterImage.classList.remove('is-dragging');$('chapter-art').style.removeProperty('transform')}
chapterImage.addEventListener('pointerdown',event=>{
 activePointers.add(event.pointerId);
 if(activePointers.size!==1||!event.isPrimary||event.button!==0||transitioning||artPending){resetGesture();return}
 gesture={id:event.pointerId,x:event.clientX,y:event.clientY,axis:null};
 try{chapterImage.setPointerCapture(event.pointerId)}catch{}
});
chapterImage.addEventListener('pointermove',event=>{
 if(!gesture||gesture.id!==event.pointerId||transitioning||artPending)return;
 const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 if(!gesture.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10){
  if(Math.abs(dx)>Math.abs(dy)*1.25)gesture.axis='horizontal';
  else if(Math.abs(dy)>Math.abs(dx))gesture.axis='vertical';
 }
 if(gesture.axis==='horizontal'&&!chapterMotion.matches){chapterImage.classList.add('is-dragging');$('chapter-art').style.transform=`translateX(${Math.max(-56,Math.min(56,dx*.25))}px)`}
});
function finishGesture(event){
 activePointers.delete(event.pointerId);
 if(!gesture||gesture.id!==event.pointerId)return;
 const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 const distance=Math.max(48,Math.min(90,chapterImage.clientWidth*.16));
 const advance=event.type==='pointerup'&&gesture.axis==='horizontal'&&Math.abs(dx)>=distance&&Math.abs(dx)>Math.abs(dy)*1.25;
 resetGesture();
 if(advance)moveChapter(dx<0?1:-1);
}
chapterImage.addEventListener('pointerup',finishGesture);
chapterImage.addEventListener('pointercancel',finishGesture);
chapterImage.addEventListener('lostpointercapture',event=>{activePointers.delete(event.pointerId);if(gesture?.id===event.pointerId)resetGesture()});
chapterImage.addEventListener('dragstart',event=>event.preventDefault());
$('collect').addEventListener('click',async event=>{
 if(event.detail>1||transitioning||artPending||artReady!==current||owned.has(current))return;
 const from=current,next=(from+1)%4,restoreFocus=document.activeElement===$('collect');owned.add(from);Jiangmen.writeOwned(owned);setChapterBusy(true);
 try{sceneArtwork=await Jiangmen.loadScene(from);await showChapterTransition();await scatterChapter(from)}catch{}finally{
  if(pendingStampSync){pendingStampSync=false;owned=Jiangmen.readOwned();setChapterBusy(false);window.dispatchEvent(new CustomEvent('stamps-change'));if(restoreFocus)$(`tab-${from}`).focus({preventScroll:true});toast('印记记录已与其他页面同步。');return}
  setChapterBusy(false);
  if(owned.size===4){
   $('journey-complete').classList.remove('celebrate');void $('journey-complete').offsetWidth;$('journey-complete').classList.add('celebrate');
   if(restoreFocus&&(document.activeElement===$('collect')||document.activeElement===document.body))$('complete-link').focus({preventScroll:true});
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)$('journey-complete').scrollIntoView({behavior:'smooth',block:'center'});
   Jiangmen.dismissToast();
  }else{choose(next);if(restoreFocus&&(document.activeElement===$('collect')||document.activeElement===document.body))$(`tab-${next}`).focus({preventScroll:true});toast(`已收好「${chapters[from].stamp}」。已翻到「${chapters[next].title}」。`)}
 }
});
$('reset').addEventListener('click',()=>{if(transitioning)return;owned.clear();Jiangmen.writeOwned(owned);choose(0);toast('印记已清空，可以重新开始探索。')});
window.addEventListener('storage',e=>{if(e.key!==null&&e.key!=='jiangmen-letter-stamps')return;if(transitioning){pendingStampSync=true;return}owned=Jiangmen.readOwned();updateStamps();window.dispatchEvent(new CustomEvent('stamps-change',{detail:[...owned]}))});
const selected=Number(new URLSearchParams(location.search).get('chapter'));choose(Number.isInteger(selected)&&selected>=0&&selected<4?selected:0);
window.addEventListener('pageshow',event=>{if(event.persisted){owned=Jiangmen.readOwned();updateStamps()}});

// Each chapter opens differently using its decoded photo (or its embedded offline crop).
async function showChapterTransition(){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const image=$('chapter-art').parentElement,rect=image.getBoundingClientRect(),visible=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0));
 if(visible>=Math.min(rect.height,window.innerHeight)*.55)return;
 image.scrollIntoView({behavior:'smooth',block:'center'});
 await new Promise(resolve=>setTimeout(resolve,280));
}
async function scatterChapter(scene){
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(motion.matches||!sceneArtwork?.image.complete||!sceneArtwork.image.naturalWidth||sceneArtwork.index!==scene||typeof Element.prototype.animate!=='function')return;
 const host=$('chapter-art').parentElement,{width:w,height:h}=$('chapter-art').getBoundingClientRect();
 if(!w||!h)return;
 const ratio=Math.min(window.devicePixelRatio||1,2),source=document.createElement('canvas'),sourceCtx=source.getContext('2d');
 source.width=Math.ceil(w*ratio);source.height=Math.ceil(h*ratio);sourceCtx.scale(ratio,ratio);
 const {image,sx,sy,sw,sh}=sceneArtwork,cover=Math.max(w/sw,h/sh);
 sourceCtx.drawImage(image,sx,sy,sw,sh,(w-sw*cover)/2,(h-sh*cover)/2,sw*cover,sh*cover);
 const layer=document.createElement('div');layer.className='chapter-fragments';layer.dataset.effect=['shards','shutters','ripples','petals'][scene];layer.setAttribute('aria-hidden','true');
 const pieces=[],animations=[];
 const add=(points,transform,duration,delay=0,origin=null)=>pieces.push({points,transform,duration,delay,origin});
 if(scene===0){
  const point=(col,row)=>[w*col/4+(col>0&&col<4&&row>0&&row<3?Math.sin(col*7+row*3)*w*.022:0),h*row/3+(col>0&&col<4&&row>0&&row<3?Math.cos(col*5+row*4)*h*.024:0)];
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
   const a=point(col,row),b=point(col+1,row),c=point(col+1,row+1),d=point(col,row+1),triangles=(row+col)%2?[[a,b,d],[b,c,d]]:[[a,b,c],[a,c,d]];
   for(const points of triangles){const j=pieces.length,cx=points.reduce((n,p)=>n+p[0],0)/3,cy=points.reduce((n,p)=>n+p[1],0)/3;add(points,`translate(${(cx-w/2)*.85+Math.sin(j*2)*24}px,${(cy-h/2)*.85+Math.cos(j*3)*20}px) rotate(${Math.sin(j*4)*32}deg) scale(.84)`,590,j%4*16)}
  }
 }else if(scene===1){
  for(let j=0;j<6;j++){const left=w*j/6,right=w*(j+1)/6,sign=j%2?1:-1;add([[left,0],[right,0],[right,h],[left,h]],`perspective(900px) translate3d(${sign*(w*.24+18)}px,${sign*h*.12}px,0) rotateY(${sign*68}deg)`,640,j*22,[sign>0?left:right,h/2])}
 }else if(scene===2){
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){const left=w*col/6,right=w*(col+1)/6,top=h*row/4,bottom=h*(row+1)/4,cx=(left+right)/2,cy=(top+bottom)/2,distance=Math.hypot((cx-w/2)/w,(cy-h/2)/h);add([[left,top],[right,top],[right,bottom],[left,bottom]],`translate(0,${-10-distance*24}px) scale(.9)`,520,Math.round(distance*330))}
 }else{
  const center=[w/2,h/2],petals=[[center,[w/2,0],[w,0],[w,h]],[center,[w,h],[0,h]],[center,[0,h],[0,0],[w/2,0]]];
  petals.forEach((points,j)=>{const cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length;add(points,`translate(${(cx-w/2)*.72}px,${(cy-h/2)*.72}px) rotate(${[-32,18,32][j]}deg) scale(.88)`,700,j*22,center)});
 }
 const finishOnReduce=e=>{if(e.matches)animations.forEach(animation=>animation.finish())};
 try{
  for(const piece of pieces){
   const left=Math.min(...piece.points.map(p=>p[0])),top=Math.min(...piece.points.map(p=>p[1])),width=Math.max(...piece.points.map(p=>p[0]))-left,height=Math.max(...piece.points.map(p=>p[1]))-top;
   const fragment=document.createElement('canvas');fragment.className='chapter-fragment';fragment.width=Math.ceil(width*ratio);fragment.height=Math.ceil(height*ratio);Object.assign(fragment.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});
   if(piece.origin)fragment.style.transformOrigin=`${piece.origin[0]-left}px ${piece.origin[1]-top}px`;
   const ctx=fragment.getContext('2d');ctx.scale(fragment.width/width,fragment.height/height);ctx.beginPath();piece.points.forEach((p,j)=>j?ctx.lineTo(p[0]-left,p[1]-top):ctx.moveTo(p[0]-left,p[1]-top));ctx.closePath();ctx.clip();ctx.drawImage(source,0,0,source.width,source.height,-left,-top,w,h);layer.append(fragment);
  }
  host.append(layer);host.classList.add('has-fragments');
  [...layer.children].forEach((fragment,j)=>animations.push(fragment.animate([{transform:'none',opacity:1},{opacity:1,offset:.16},{transform:pieces[j].transform,opacity:0}],{duration:pieces[j].duration,delay:pieces[j].delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'})));
  motion.addEventListener('change',finishOnReduce);
  await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
 }finally{motion.removeEventListener('change',finishOnReduce);animations.forEach(animation=>animation.cancel());layer.remove();host.classList.remove('has-fragments')}
}

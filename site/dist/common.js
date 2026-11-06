'use strict';
(()=>{
 const stampKey='jiangmen-letter-stamps',draftKey='jiangmen-letter-draft';
 let atlasPromise,toastTimer,memoryStamps=new Set(),stampStorageWritable=true;
 const scenePromises=new Map();
 const readOwned=()=>{if(stampStorageWritable)try{const x=JSON.parse(localStorage.getItem(stampKey)||'[]');memoryStamps=new Set(Array.isArray(x)?x.filter(n=>Number.isInteger(n)&&n>=0&&n<4):[])}catch{}return new Set(memoryStamps)};
 const writeOwned=owned=>{memoryStamps=new Set(owned);try{localStorage.setItem(stampKey,JSON.stringify([...owned]));stampStorageWritable=true}catch{stampStorageWritable=false}window.dispatchEvent(new CustomEvent('stamps-change',{detail:[...owned]}))};
 const toast=message=>{let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el)}el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4000)};
 const dismissToast=()=>{clearTimeout(toastTimer);document.getElementById('toast')?.classList.remove('visible')};
 function loadAtlas(){if(atlasPromise)return atlasPromise;atlasPromise=new Promise((resolve,reject)=>{
  const load=()=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('artwork'));img.src=location.protocol==='file:'?window.JIANGMEN_ATLAS_DATA:'assets/jiangmen-atlas.webp'};
  if(location.protocol==='file:'&&!window.JIANGMEN_ATLAS_DATA){const script=document.createElement('script');script.src='assets/atlas-data.js';script.onload=load;script.onerror=()=>reject(new Error('offline artwork'));document.head.append(script)}else load();
 }).catch(error=>{atlasPromise=null;throw error});return atlasPromise}
 // Online previews and fragments reuse one scene; the embedded atlas is only needed for file:// export.
 function loadScene(index){
  if(!Number.isInteger(index)||index<0||index>3)return Promise.reject(new Error('invalid-scene'));
  if(scenePromises.has(index))return scenePromises.get(index);
  const pending=(location.protocol==='file:'?loadAtlas().then(image=>{const sw=image.naturalWidth/2,sh=image.naturalHeight/2;return {image,index,sx:index%2*sw,sy:Math.floor(index/2)*sh,sw,sh}}):new Promise((resolve,reject)=>{
   const image=new Image();image.decoding='async';
   image.onload=async()=>{try{if(typeof image.decode==='function')await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('empty-scene');resolve({image,index,sx:0,sy:0,sw:image.naturalWidth,sh:image.naturalHeight})}catch(error){reject(error)}};
   image.onerror=()=>reject(new Error('scene-artwork'));image.src=`assets/scene-${index}.webp`;
  })).catch(error=>{scenePromises.delete(index);throw error});
  scenePromises.set(index,pending);return pending;
 }
 const readDraft=()=>{try{const x=JSON.parse(localStorage.getItem(draftKey)||'{}');return {scene:Number.isInteger(x.scene)&&x.scene>=0&&x.scene<4?x.scene:0,recipient:typeof x.recipient==='string'?x.recipient.slice(0,20):'',message:typeof x.message==='string'?x.message.slice(0,80):''}}catch{return {scene:0,recipient:'',message:''}}};
 const saveDraft=draft=>{try{localStorage.setItem(draftKey,JSON.stringify(draft));return true}catch{return false}};
 document.addEventListener('contextmenu',event=>event.preventDefault());
 document.querySelectorAll('[data-creator]').forEach(el=>{el.textContent='RTHLanStar';if(el.tagName==='A'){el.href='https://github.com/RTHLanStar';el.target='_blank';el.rel='noopener'}});
 window.Jiangmen={readOwned,writeOwned,toast,dismissToast,loadAtlas,loadScene,readDraft,saveDraft};
})();

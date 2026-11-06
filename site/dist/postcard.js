/* Shared, local-only postcard editor for the home page and letters page. */
(() => {
  'use strict';

  function setup() {
    const api = window.Jiangmen;
    const chapters = window.JIANGMEN_CHAPTERS;
    const byId = id => document.getElementById(id);
    const canvas = byId('card');
    const form = byId('card-form');
    const scene = byId('scene');
    const recipient = byId('recipient');
    const message = byId('message');
    if (!api || !Array.isArray(chapters) || !canvas || !form || !scene || !recipient || !message) return;

    const context = canvas.getContext('2d');
    const status = byId('draft-status');
    const previewButton = byId('preview-card');
    const shareButton = byId('share-card');
    const controls = [...new Set([...form.querySelectorAll('button[type="submit"], input[type="submit"]'), previewButton, shareButton].filter(Boolean))];
    const urls = new Set();
    const timers = new Map();
    let artwork = null;
    let imageRequest = 0;
    let pendingDraftSync = false;
    let exportLabel = '';
    let busy = false;
    let dirty = false;
    let draftTimer;
    let dialog;
    let dialogImage;
    let dialogDownload;
    let dialogUrl = null;
    let returnFocus = null;

    function notify(text) { api.toast(text); }
    function cleanDraft(value) {
      const index = Number(value && value.scene);
      return {
        scene: Number.isInteger(index) && index >= 0 && index < chapters.length ? index : 0,
        recipient: typeof value?.recipient === 'string' ? value.recipient.slice(0, 20) : '',
        message: typeof value?.message === 'string' ? value.message.slice(0, 80) : ''
      };
    }
    function currentDraft() { return cleanDraft({scene: scene.value, recipient: recipient.value, message: message.value}); }
    function sameDraft(a, b) { return a.scene === b.scene && a.recipient === b.recipient && a.message === b.message; }
    function ownedStamps() {
      try { return new Set([...api.readOwned()].filter(value => Number.isInteger(value) && value >= 0 && value < chapters.length)); }
      catch { return new Set(); }
    }

    let restored = {scene: 0, recipient: '', message: ''};
    try { restored = cleanDraft(api.readDraft()); } catch {}
    scene.value = String(restored.scene);
    recipient.value = restored.recipient;
    message.value = restored.message;
    if (status) status.textContent = restored.recipient || restored.message || restored.scene ? '已恢复上次的明信片草稿。' : '写下心意，草稿会尝试保存在当前浏览器。';
    if (shareButton) shareButton.textContent = '分享明信片 ↗';

    function saveDraftNow() {
      clearTimeout(draftTimer);
      if (!dirty) return;
      dirty = false;
      const value = currentDraft();
      let saved = false;
      try {
        const result = api.saveDraft(value);
        saved = result !== false && sameDraft(value, cleanDraft(api.readDraft()));
      } catch {}
      if (status) status.textContent = saved ? '草稿已保存在当前浏览器，可在写信页继续。' : '浏览器未能保存草稿；当前仍可预览、保存和分享明信片。';
    }

    function placeholder(failed = false) {
      if (!context) return;
      context.fillStyle = '#f5f0e6';
      context.fillRect(0, 0, canvas.width, canvas.height);
      paperFrame(context);
      context.fillStyle = '#e5e8dc';
      context.fillRect(48, 48, 1504, 580);
      context.strokeStyle = '#b6c0ae';
      context.lineWidth = 2;
      context.strokeRect(61, 61, 1478, 554);
      context.strokeStyle = '#d3c49e';
      for (let y = 745; y <= 930; y += 61) {
        context.beginPath();context.moveTo(75, y);context.lineTo(1250, y);context.stroke();
      }
      postmark(context, 1440, 744, true);
      context.fillStyle = '#183d36';
      context.textAlign = 'center';
      context.font = '42px "Microsoft YaHei", sans-serif';
      context.fillText(failed ? '风景图片暂时未能加载' : '正在把风景装进明信片…', canvas.width / 2, 307);
      context.font = '25px "Microsoft YaHei", sans-serif';
      context.fillStyle = '#596e5e';
      context.fillText(failed ? '点击“预览大图”可重试，已写的心意会保留。' : '先写下收信人和想说的话，风景马上就来。', canvas.width / 2, 365);
      context.font = '24px "Microsoft YaHei", sans-serif';
      context.fillText('侨乡来信 · 江门', canvas.width / 2, 1040);
      context.textAlign = 'left';
      canvas.setAttribute('aria-label', failed ? '明信片风景图片加载失败，可点击预览按钮重试。' : '纸面明信片框架与纪念印章，风景图片正在准备中，可以先填写心意。');
      canvas.setAttribute('aria-busy', failed ? 'false' : 'true');
    }

    function paperFrame(ctx) {
      ctx.strokeStyle = '#c2a66e';ctx.lineWidth = 2;ctx.strokeRect(22, 22, 1556, 1056);
      ctx.strokeStyle = '#d9caa7';ctx.lineWidth = 1;ctx.strokeRect(30, 30, 1540, 1040);
      ctx.strokeStyle = '#a7957010';
      for (let y = 648; y < 1070; y += 7) {ctx.beginPath();ctx.moveTo(34, y);ctx.lineTo(1566, y);ctx.stroke();}
    }

    function postmark(ctx, x, y, pending = false) {
      ctx.save();ctx.translate(x, y);ctx.rotate(-.12);ctx.strokeStyle = pending ? '#a59c84' : '#9a7250';ctx.fillStyle = ctx.strokeStyle;ctx.lineWidth = 1.7;
      ctx.beginPath();ctx.arc(0, 0, 57, 0, Math.PI * 2);ctx.stroke();
      ctx.beginPath();ctx.arc(0, 0, 49, 0, Math.PI * 2);ctx.stroke();
      ctx.textAlign = 'center';ctx.font = '26px "Microsoft YaHei", sans-serif';ctx.fillText('江门', 0, -3);
      ctx.font = '15px "Microsoft YaHei", sans-serif';ctx.fillText('互动纪念', 0, 24);ctx.restore();
    }

    function wrap(text, x, y, maxWidth, lineHeight, maxLines, context) {
      let row = '';
      let line = 0;
      for (const character of text) {
        if (context.measureText(row + character).width > maxWidth && row) {
          context.fillText(row, x, y + line * lineHeight);
          if (++line >= maxLines) return;
          row = character;
        } else row += character;
      }
      if (row && line < maxLines) context.fillText(row, x, y + line * lineHeight);
    }

    function render(value = currentDraft(), selected = artwork, target = canvas, owned = ownedStamps()) {
      const context = target.getContext('2d');
      if (!context || !selected || selected.index !== value.scene) return;
      const chapter = chapters[value.scene];
      const to = value.recipient.trim() || '远方的你';
      const words = value.message.trim().replace(/\s+/g, ' ') || chapter.card;
      context.textAlign = 'left';
      context.fillStyle = '#f5f0e6';
      context.fillRect(0, 0, 1600, 1100);

      // A single online scene and an offline atlas quadrant share the same crop contract.
      const {image, sw, sh} = selected;
      const scale = Math.max(1600 / sw, 640 / sh);
      const cropWidth = 1600 / scale;
      const cropHeight = 640 / scale;
      const sx = selected.sx + (sw - cropWidth) / 2;
      // The tower's rooftop is near the top edge; keep it whole in the wide card.
      const cropTop = value.scene === 0 ? 0 : (sh - cropHeight) / 2;
      const sy = selected.sy + cropTop;
      context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, 1600, 640);
      context.fillStyle = '#183d36b0';
      context.fillRect(0, 540, 1600, 100);
      context.fillStyle = '#f5f0e6';
      context.font = '32px "Microsoft YaHei", sans-serif';
      context.fillText('侨乡来信 · 江门', 62, 602);
      context.font = '23px "Microsoft YaHei", sans-serif';
      context.textAlign = 'right';
      context.fillText(chapter.place, 1535, 602);
      context.textAlign = 'left';
      paperFrame(context);
      postmark(context, 1440, 716);
      context.fillStyle = '#183d36';
      context.font = '36px SimSun, serif';
      context.fillText('致 ' + to + '：', 65, 715);
      context.font = '30px "Microsoft YaHei", sans-serif';
      wrap(words, 65, 797, 1350, 47, 3, context);
      context.strokeStyle = '#d8d7c8';
      context.beginPath();
      context.moveTo(65, 972);
      context.lineTo(1535, 972);
      context.stroke();
      context.font = '22px "Microsoft YaHei", sans-serif';
      context.fillStyle = '#596e5e';
      context.fillText('广东 · 江门 / 山海有归处，侨乡有来信。', 65, 1025);
      context.font = '18px "Microsoft YaHei", sans-serif';
      context.fillText('RTHLanStar · AI 艺术演绎 · 2026', 65, 1064);
      context.font = '24px SimSun, serif';
      let x = 1180;
      for (let index = 0; index < chapters.length; index++) {
        if (!owned.has(index)) continue;
        context.strokeStyle = '#ba653b';
        context.fillStyle = '#ba653b';
        context.beginPath();
        context.arc(x, 1030, 35, 0, Math.PI * 2);
        context.stroke();
        context.textAlign = 'center';
        context.fillText(chapters[index].stamp, x, 1038);
        x += 90;
      }
      context.textAlign = 'left';
      target.setAttribute('aria-label', `江门明信片：${chapter.place}；致${to}；${words}；已收集${owned.size}枚印记；互动纪念；创作署名 RTHLanStar。`);
      target.setAttribute('aria-busy', 'false');
      target.dataset.scene = String(value.scene);
    }

    async function ensureScene() {
      if (!context) return Promise.reject(new Error('canvas-unavailable'));
      const index = currentDraft().scene;
      const request = ++imageRequest;
      if (artwork?.index === index) {render();return artwork;}
      // Preserve the last complete card while loading another scene.
      if (!artwork) placeholder();
      canvas.setAttribute('aria-busy', 'true');
      try {
        const loaded = await api.loadScene(index);
        if (request !== imageRequest || index !== currentDraft().scene) return loaded;
        artwork = loaded;render();return loaded;
      } catch (error) {
        if (request === imageRequest) {
          canvas.setAttribute('aria-busy', 'false');
          if (!artwork) placeholder(true);
          else if (status) status.textContent = '新风景暂时未能加载，已保留原预览；点击“预览大图”可重试。';
        }
        throw error;
      }
    }

    function updatePassport() {
      const owned = ownedStamps();
      document.querySelectorAll('[data-passport]').forEach(link => {
        const index = Number(link.dataset.passport);
        const chapter = chapters[index];
        if (!chapter) return;
        const has = owned.has(index);
        link.classList.toggle('owned', has);
        link.setAttribute('aria-label', `${chapter.stamp}印记，${has ? '已收藏' : '未收藏'}；阅读${chapter.title}`);
      });
      const progress = byId('passport-status');
      if (progress) progress.textContent = owned.size === chapters.length ? '四枚印记已集齐，把这一程写进你的明信片。' : `已收藏 ${owned.size} / ${chapters.length} 枚印记，随时都可以写下你的心意。`;
    }

    function draw() {
      updatePassport();
      if (artwork?.index === currentDraft().scene) {++imageRequest;render();return;}
      const bounds = canvas.getBoundingClientRect();
      if (artwork || bounds.bottom >= -250 && bounds.top <= window.innerHeight + 250) ensureScene().catch(() => {});
    }

    function makeUrl(blob) {
      const url = URL.createObjectURL(blob);
      urls.add(url);
      return url;
    }
    function releaseUrl(url) {
      if (!url) return;
      clearTimeout(timers.get(url));
      timers.delete(url);
      if (urls.delete(url)) URL.revokeObjectURL(url);
    }
    function download(blob) {
      const url = makeUrl(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '侨乡来信-江门明信片.png';
      link.hidden = true;
      document.body.append(link);
      try { link.click(); }
      finally {
        link.remove();
        timers.set(url, setTimeout(() => releaseUrl(url), 60000));
      }
    }

    function closePreview() {
      if (dialog?.open) dialog.close();
    }
    function prepareDialog() {
      if (dialog) return;
      dialog = document.createElement('dialog');
      dialog.className = 'card-dialog';
      dialog.setAttribute('aria-labelledby', 'card-preview-title');
      const body = document.createElement('div');
      body.className = 'card-dialog-body';
      const title = document.createElement('h2');
      title.id = 'card-preview-title';
      title.textContent = '明信片大图预览';
      dialogImage = document.createElement('img');
      dialogImage.className = 'card-dialog-image';
      dialogImage.width = 1600;
      dialogImage.height = 1100;
      const hint = document.createElement('p');
      hint.textContent = '可保存 PNG 图片，再把这一份心意发给心里的人。';
      const actions = document.createElement('div');
      actions.className = 'card-dialog-actions';
      dialogDownload = document.createElement('a');
      dialogDownload.className = 'primary';
      dialogDownload.download = '侨乡来信-江门明信片.png';
      dialogDownload.textContent = '保存 PNG ↓';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary';
      close.textContent = '关闭预览';
      close.addEventListener('click', closePreview);
      actions.append(dialogDownload, close);
      body.append(title, dialogImage, hint, actions);
      dialog.append(body);
      document.body.append(dialog);
      dialog.addEventListener('click', event => { if (event.target === dialog) closePreview(); });
      dialog.addEventListener('close', () => {
        releaseUrl(dialogUrl);
        dialogUrl = null;
        dialogImage.removeAttribute('src');
        dialogDownload.removeAttribute('href');
        if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({preventScroll: true});
      });
    }
    async function preview(blob) {
      prepareDialog();
      if (typeof dialog.showModal !== 'function') {
        download(blob);
        notify('图片已生成，请在浏览器下载列表中查看。');
        return;
      }
      releaseUrl(dialogUrl);
      dialogUrl = makeUrl(blob);
      dialogImage.src = dialogUrl;
      dialogImage.alt = exportLabel || '我的江门明信片';
      dialogDownload.href = dialogUrl;
      if (typeof dialogImage.decode === 'function') await dialogImage.decode();
      if (!dialog.open) dialog.showModal();
    }

    function createBlob(value, selected, owned) {
      const output = document.createElement('canvas');output.width = 1600;output.height = 1100;
      render(value, selected, output, owned);
      exportLabel = output.getAttribute('aria-label') || '';
      return new Promise((resolve, reject) => {
        try { output.toBlob(blob => blob ? resolve(blob) : reject(new Error('png-unavailable')), 'image/png'); }
        catch (error) { reject(error); }
      });
    }
    async function share(blob) {
      const file = typeof File === 'function' ? new File([blob], '侨乡来信-江门明信片.png', {type: 'image/png'}) : null;
      let supported = false;
      try { supported = !!file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({files: [file]}); } catch {}
      if (!supported) { await preview(blob); return; }
      try { await navigator.share({files: [file], title: '侨乡来信 · 江门', text: '把江门，寄给心里的人。'}); }
      catch (error) {
        if (error?.name === 'AbortError') return;
        await preview(blob);
        notify('系统分享暂不可用，已打开明信片预览。');
      }
    }

    async function run(action) {
      if (busy) return;
      returnFocus = document.activeElement;
      busy = true;
      const previous = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      form.setAttribute('aria-busy', 'true');
      saveDraftNow();
      const snapshot = currentDraft(), stamps = ownedStamps();
      try {
        const selected = await api.loadScene(snapshot.scene);
        const blob = await createBlob(snapshot, selected, stamps);
        if (action === 'preview') await preview(blob);
        else if (action === 'share') await share(blob);
        else {
          download(blob);
          notify('明信片已生成，请在浏览器下载列表中查看。');
        }
      } catch {
        if (dialogUrl && !dialog?.open) { releaseUrl(dialogUrl); dialogUrl = null; }
        notify('暂时未能生成明信片，已写的内容会保留，请再试一次。');
      } finally {
        controls.forEach((control, index) => { control.disabled = previous[index]; });
        form.setAttribute('aria-busy', 'false');
        busy = false;
        if (pendingDraftSync) {pendingDraftSync = false;restoreLatestDraft();}
        draw();
      }
    }

    [scene, recipient, message].forEach(input => input.addEventListener('input', () => {
      dirty = true;
      if (status) status.textContent = '正在保存草稿…';
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraftNow, 250);
      draw();
    }));
    form.addEventListener('submit', event => { event.preventDefault(); run('download'); });
    previewButton?.addEventListener('click', event => { event.preventDefault(); run('preview'); });
    shareButton?.addEventListener('click', event => { event.preventDefault(); run('share'); });
    window.addEventListener('stamps-change', draw);
    document.addEventListener('stamps-change', draw);
    function restoreLatestDraft() {
      if (busy) {pendingDraftSync = true;return;}
      if (dirty) return;
      let latest;
      try { latest = cleanDraft(api.readDraft()); } catch { return; }
      if (!sameDraft(currentDraft(), latest)) {
        scene.value = String(latest.scene);
        recipient.value = latest.recipient;
        message.value = latest.message;
        if (status) status.textContent = '已同步最近保存的明信片草稿。';
      }
      draw();
    }
    // History navigation may restore form values after DOMContentLoaded, even without BFCache.
    window.addEventListener('pageshow', () => { setTimeout(restoreLatestDraft, 0); });
    window.addEventListener('storage', event => {
      if (event.key === null || event.key === 'jiangmen-letter-draft') restoreLatestDraft();
      if (event.key === null || event.key === 'jiangmen-letter-stamps') draw();
    });
    window.addEventListener('pagehide', () => {
      saveDraftNow();
      closePreview();
      [...urls].forEach(releaseUrl);
    });

    placeholder();
    updatePassport();
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        ensureScene().catch(() => {});
      }, {rootMargin: '250px'});
      observer.observe(canvas);
    } else ensureScene().catch(() => {});
    window.JiangmenCard = {draw};
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
})();

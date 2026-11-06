/* Personal, self-reported travel records. No geolocation, network or culture-stamp writes. */
(() => {
  'use strict';
  const source = document.getElementById('travel-passport-data');
  if (!source) return;
  const REGION_ORDER = ['蓬江区', '江海区', '新会区', '台山市', '开平市', '鹤山市', '恩平市'];
  let places;
  try {
    const data = JSON.parse(source.textContent);
    if (!Array.isArray(data)) return;
    const seen = new Set();
    places = data.filter(p => {
      if (!p || typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id)
          || typeof p.name !== 'string' || !REGION_ORDER.includes(p.region) || seen.has(p.id)) return false;
      seen.add(p.id); return true;
    });
  } catch (_) { return; }
  if (!places.length) return;

  const VISITED_KEY = 'jiangmen-travel-visited-v1';
  const WISHLIST_KEY = 'jiangmen-travel-wishlist';
  const catalog = new Map(places.map(p => [p.id, p]));
  const section = document.getElementById('travel-passport');
  const visitButtons = [...document.querySelectorAll('button[data-visit-id]')].filter(button => catalog.has(button.dataset.visitId));
  let visited = new Set(), wishlist = new Set();
  let persistent = true, visitedCorrupt = false, wishlistReadable = true, wishlistMemory = false;
  let wishedEventSeen = false;

  function parseIds(value, wishlistMode = false) {
    const data = JSON.parse(value || '[]');
    if (!Array.isArray(data)) throw new Error('Invalid records');
    return new Set(data.filter(id => typeof id === 'string' && (wishlistMode
      ? id.startsWith('place-') && catalog.has(id.slice(6)) : catalog.has(id))).map(id => wishlistMode ? id.slice(6) : id));
  }
  function readVisited() {
    if (!persistent) return;
    let value;
    try { value = localStorage.getItem(VISITED_KEY); }
    catch (_) { persistent = false; return; }
    try { visited = parseIds(value); visitedCorrupt = false; }
    catch (_) { visited = new Set(); visitedCorrupt = true; }
  }
  function readWishlist() {
    if (wishlistMemory) return;
    try { wishlist = parseIds(localStorage.getItem(WISHLIST_KEY), true); wishlistReadable = true; }
    catch (_) { wishlistReadable = false; }
  }
  readVisited(); readWishlist();

  let storageStatus = document.querySelector('[data-visited-storage-status]');
  if (!storageStatus && visitButtons.length) {
    storageStatus = document.createElement('p');
    storageStatus.className = 'travel-passport-storage travel-passport-guide-status';
    storageStatus.dataset.visitedStorageStatus = '';
    storageStatus.setAttribute('role', 'status');
    storageStatus.setAttribute('aria-live', 'polite');
    const toolbar = document.querySelector('.guide-toolbar');
    if (toolbar) toolbar.insertAdjacentElement('afterend', storageStatus);
    else visitButtons[0].parentElement.insertAdjacentElement('afterend', storageStatus);
  }
  const countNode = name => section && section.querySelector(`[data-passport-count="${name}"]`);
  const visitedPlaces = () => places.filter(p => visited.has(p.id));
  const visitedRegions = () => REGION_ORDER.filter(region => places.some(p => p.region === region && visited.has(p.id)));

  function renderRecords() {
    visitButtons.forEach(button => {
      const isVisited = visited.has(button.dataset.visitId);
      button.setAttribute('aria-pressed', String(isVisited));
      button.textContent = isVisited ? '已去过 · 取消' : '标记去过';
      button.setAttribute('aria-label', (isVisited ? '取消去过记录：' : '标记去过：') + catalog.get(button.dataset.visitId).name);
      button.hidden = false;
    });
    const areas = visitedRegions();
    const counts = { wishlist: wishlistReadable ? wishlist.size : '—', visited: visited.size, regions: areas.length };
    Object.entries(counts).forEach(([name, count]) => { const node = countNode(name); if (node) node.textContent = String(count); });
    if (section) {
      section.querySelectorAll('[data-passport-region]').forEach(stamp => {
        const owned = areas.includes(stamp.dataset.passportRegion);
        stamp.classList.toggle('is-visited', owned);
        stamp.querySelector('[data-passport-region-status]').textContent = owned ? '私人纪念' : '待记录';
        stamp.setAttribute('aria-label', stamp.dataset.passportRegion + (owned ? '：已自记到访，私人纪念邮戳' : '：尚未记录到访'));
      });
      section.querySelectorAll('[data-passport-wanted]').forEach(note => { note.hidden = !wishlist.has(note.dataset.passportWanted) || !wishlistReadable; });
    }
    if (storageStatus) {
      let text = persistent
        ? (visitedCorrupt ? '原有去过记录损坏，暂未计入；重新标记后会保存新的有效记录。' : `去过 ${visited.size} 处，已存到此浏览器；不会跨设备同步。`)
        : `浏览器存储不可用，去过记录仅当前页有效（${visited.size} 处）。`;
      if (!wishlistReadable) text += ' 想去清单暂时无法读取，未按零项计算。';
      else if (wishlistMemory) text += ' 想去清单也仅当前页有效。';
      storageStatus.textContent = text;
    }
    scheduleCard();
  }

  visitButtons.forEach(button => button.addEventListener('click', () => {
    // Merge with the newest storage value before modifying one item, to avoid overwriting a newer tab.
    readVisited();
    const id = button.dataset.visitId;
    if (visited.has(id)) visited.delete(id); else visited.add(id);
    if (persistent) {
      try { localStorage.setItem(VISITED_KEY, JSON.stringify([...visited])); visitedCorrupt = false; }
      catch (_) { persistent = false; }
    }
    renderRecords();
  }));

  window.addEventListener('jiangmen:wishlist-change', event => {
    const detail = event.detail;
    if (!detail || !Array.isArray(detail.ids)) return;
    wishedEventSeen = true;
    wishlist = parseIds(JSON.stringify(detail.ids), true);
    wishlistReadable = true;
    wishlistMemory = detail.persistent === false;
    renderRecords();
  });
  // Older guide.js builds have no custom event. The click fallback is read-only.
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('button[data-save]')) return;
    setTimeout(() => { if (!wishedEventSeen) { readWishlist(); renderRecords(); } }, 0);
  });
  window.addEventListener('storage', event => {
    if (event.key !== null && event.key !== VISITED_KEY && event.key !== WISHLIST_KEY) return;
    if (event.key === null || event.key === VISITED_KEY) readVisited();
    if (event.key === null || event.key === WISHLIST_KEY) readWishlist();
    renderRecords();
  });
  window.addEventListener('pageshow', () => {
    setTimeout(() => { readVisited(); readWishlist(); renderRecords(); }, 0);
  });

  const canvas = section && section.querySelector('[data-passport-canvas]');
  let ctx = null;
  try { ctx = canvas && canvas.getContext('2d'); } catch (_) {}
  const cardStatus = section && section.querySelector('[data-passport-card-status]');
  const nameInput = section && section.querySelector('[data-passport-name]');
  const imagePanel = section && section.querySelector('[data-passport-image-panel]');
  const cardImage = section && section.querySelector('[data-passport-image]');
  const exportButton = section && section.querySelector('[data-passport-export]');
  const previewButton = section && section.querySelector('[data-passport-preview]');
  const downloadLink = section && section.querySelector('[data-passport-download]');
  const fontReady = document.fonts && document.fonts.ready ? Promise.resolve(document.fonts.ready).catch(() => {}) : Promise.resolve();
  const serif = '"Noto Serif SC", "Songti SC", "SimSun", serif';
  const sans = '"Microsoft YaHei", "PingFang SC", sans-serif';
  let pendingDraw = 0, previewTrigger = null;

  function cleanName() {
    return nameInput ? Array.from(nameInput.value.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 20).join('') : '';
  }
  function line(text, x, y, size, color = '#183d36', family = sans, align = 'left') {
    ctx.fillStyle = color; ctx.font = `${size}px ${family}`; ctx.textAlign = align; ctx.fillText(text, x, y);
  }
  function wrapped(text, x, y, width, size, maxLines = 2, height = size * 1.5, color = '#183d36') {
    ctx.font = `${size}px ${sans}`;
    const chars = Array.from(String(text));
    let row = '', lines = [];
    for (const char of chars) {
      if (ctx.measureText(row + char).width > width && row) { lines.push(row); row = char; } else row += char;
    }
    if (row) lines.push(row);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > width && last) last = Array.from(last).slice(0, -1).join('');
      lines[maxLines - 1] = last + '…';
    }
    lines.forEach((value, index) => line(value, x, y + index * height, size, color));
  }
  function strokeLine(x1, y1, x2, y2, color = '#d9ddcf', width = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function stamp(region, x, y, index, empty = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((index % 2 ? 4 : -6) * Math.PI / 180);
    ctx.strokeStyle = empty ? '#8b9c88' : '#315746'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
    line(empty ? '下一程' : region.slice(0, -1), 0, 5, 32, '#315746', serif, 'center');
    line(empty ? '期待出发' : '私人自记', 0, 32, 15, '#315746', sans, 'center');
    line('JIANGMEN', 0, -30, 12, '#315746', sans, 'center');
    ctx.restore();
  }
  function skyline() {
    ctx.save(); ctx.translate(1110, 155); ctx.strokeStyle = '#577763'; ctx.lineWidth = 3;
    // An original, symbolic building motif; it represents no measured location.
    ctx.beginPath(); ctx.moveTo(-28, 85); ctx.lineTo(-28, -45); ctx.lineTo(-38, -45); ctx.lineTo(-38, -63);
    ctx.lineTo(-20, -63); ctx.lineTo(-20, -75); ctx.lineTo(17, -75); ctx.lineTo(17, -63); ctx.lineTo(35, -63);
    ctx.lineTo(35, -45); ctx.lineTo(25, -45); ctx.lineTo(25, 85); ctx.stroke();
    for (let y = -23; y < 70; y += 29) { ctx.strokeRect(-13, y, 9, 14); ctx.strokeRect(10, y, 9, 14); }
    ctx.beginPath(); ctx.moveTo(-125, 85); ctx.lineTo(-125, 10); ctx.lineTo(-43, 10); ctx.lineTo(-43, 85); ctx.moveTo(39, 85); ctx.lineTo(39, 27); ctx.lineTo(113, 27); ctx.lineTo(113, 85); ctx.stroke();
    for (const x of [-110, -81, 52, 81]) { ctx.beginPath(); ctx.moveTo(x, 85); ctx.lineTo(x, 53); ctx.arc(x + 9, 53, 9, Math.PI, 0); ctx.lineTo(x + 18, 85); ctx.stroke(); }
    strokeLine(-145, 95, 140, 95, '#577763', 2);
    ctx.restore();
  }
  function drawCard() {
    if (!ctx) return;
    const current = visitedPlaces(), regions = visitedRegions(), name = cleanName();
    ctx.clearRect(0, 0, 1400, 1740); ctx.fillStyle = '#fcfaf4'; ctx.fillRect(0, 0, 1400, 1740);
    ctx.fillStyle = '#183d36'; ctx.fillRect(0, 0, 1400, 24); ctx.fillRect(0, 1716, 1400, 24);
    ctx.strokeStyle = '#c9d0bd'; ctx.lineWidth = 2; ctx.strokeRect(46, 50, 1308, 1636);
    line('侨乡来信  /  A LETTER FROM JIANGMEN', 100, 112, 22, '#526b56');
    line(current.length ? '我的江门旅行纪念' : '我的江门行前卡', 96, 221, 65, '#183d36', serif);
    skyline();
    wrapped(name ? name + ' 的私人旅行手记' : '走过的风景，由自己慢慢记。', 100, 284, 1180, 29, 1);
    strokeLine(100, 325, 1300, 325);
    [['想去景点', wishlistReadable ? wishlist.size : '—'], ['去过景点', current.length], ['到过区市', regions.length + ' / 7']].forEach(([title, count], index) => {
      const x = 100 + index * 410;
      line(title, x, 372, 22, '#607463'); line(String(count), x, 440, 54, '#183d36', serif);
    });
    line('把七区市，收进回忆里。', 100, 504, 27, '#183d36', serif);
    if (regions.length) regions.forEach((region, index) => stamp(region, 172 + index * 174, 606, index));
    else { stamp('', 172, 606, 0, true); line('还没有去过记录。', 285, 589, 28); line('先选一处心动，给下一次出发留白。', 285, 636, 25, '#607463'); }
    wrapped(regions.length ? '自记到过：' + regions.join(' · ') : '这里的邮戳，会在你自主标记去过后出现。', 100, 725, 1200, 22, 1, 32, '#607463');
    strokeLine(100, 764, 1300, 764);
    line(current.length ? '我已去过的景点' : '下一程，慢慢走。', 100, 826, 33, '#183d36', serif);
    if (current.length) {
      const rows = Math.ceil(current.length / 2);
      current.forEach((place, index) => {
        const column = index < rows ? 0 : 1, row = index < rows ? index : index - rows;
        const x = 100 + column * 630, y = 889 + row * 61;
        line(String(index + 1).padStart(2, '0'), x, y, 18, '#7a8c75');
        wrapped(place.name, x + 45, y, 510, 24, 2, 28);
      });
    } else {
      wrapped('从一条老街、一座碉楼，或一阵海风开始。', 100, 908, 1150, 31, 2, 48, '#526b56');
      wrapped('行前卡只记录此刻的期待，不代表已经到访。', 100, 985, 1150, 25, 2, 42, '#607463');
      ctx.save(); ctx.translate(210, 1180); ctx.scale(2.2, 1); ctx.strokeStyle = '#c5cebb'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * 30); ctx.bezierCurveTo(120, i * 30 - 25, 280, i * 30 + 25, 435, i * 30); ctx.stroke(); } ctx.restore();
    }
    strokeLine(100, 1510, 1300, 1510);
    line('私人自记 · 非官方到访证明 · 不含实时定位', 100, 1561, 23, '#526b56');
    line('来源：侨乡来信  /  江门旅行指南', 100, 1610, 23, '#526b56');
    line(current.length ? '把这一程收好，把下一程留给期待。' : '尚无去过记录 · 这是一张行前纪念卡', 100, 1652, 21, '#526b56');
    canvas.setAttribute('aria-label', `私人江门${current.length ? '旅行纪念' : '行前'}卡；${name ? name + '；' : ''}自记去过 ${current.length} 个景点，${regions.length} 个区市。${current.map(p => p.name).join('、')}`);
  }
  function scheduleCard() {
    if (!ctx) return;
    if (pendingDraw) cancelAnimationFrame(pendingDraw);
    pendingDraw = requestAnimationFrame(() => { pendingDraw = 0; fontReady.then(() => {
      drawCard();
      if (imagePanel && !imagePanel.hidden) {
        try { const uri = canvas.toDataURL('image/png'); cardImage.src = uri; downloadLink.href = uri; } catch (_) {}
      }
    }); });
  }
  async function cardURL() {
    await fontReady; drawCard();
    const uri = canvas.toDataURL('image/png');
    if (!uri.startsWith('data:image/png')) throw new Error('PNG unavailable');
    return uri;
  }
  async function showImage(uri, trigger, focus) {
    cardImage.src = uri; downloadLink.href = uri;
    if (cardImage.decode) { try { await cardImage.decode(); } catch (_) {} }
    imagePanel.hidden = false; previewTrigger = trigger;
    if (focus) section.querySelector('[data-passport-preview-title]').focus();
  }
  if (section && ctx) {
    section.querySelector('[data-passport-controls]').hidden = false;
    section.querySelector('[data-passport-canvas-wrap]').hidden = false;
    exportButton.hidden = false; previewButton.hidden = false;
    cardStatus.textContent = '可保存 PNG 图片；下载受限时，可打开预览长按保存。';
    nameInput.addEventListener('input', scheduleCard);
    // The shared site blocks context menus; this image intentionally permits saving.
    cardImage.addEventListener('contextmenu', event => event.stopPropagation());
    previewButton.addEventListener('click', async () => {
      if (previewButton.disabled) return;
      previewButton.disabled = true;
      try { await showImage(await cardURL(), previewButton, true); cardStatus.textContent = '图片已生成。可长按图片或右键保存，也可下载 PNG。'; }
      catch (_) { cardStatus.textContent = '此浏览器暂时无法生成图片；旅行记录仍可查看，请换用支持 Canvas 的浏览器。'; }
      finally { previewButton.disabled = false; }
    });
    exportButton.addEventListener('click', async () => {
      if (exportButton.disabled) return;
      exportButton.disabled = true;
      try {
        const uri = await cardURL();
        await showImage(uri, exportButton, false);
        downloadLink.click();
        cardStatus.textContent = '已尝试下载 PNG；若没有收到文件，可在下方预览中长按图片或右键保存。';
      } catch (_) { cardStatus.textContent = '自动保存暂未成功。可尝试“预览图片 / 长按保存”；旅行记录仍然保留。'; }
      finally { exportButton.disabled = false; }
    });
    section.querySelector('[data-passport-close-preview]').addEventListener('click', () => {
      imagePanel.hidden = true;
      if (previewTrigger) previewTrigger.focus();
    });
  } else if (cardStatus) cardStatus.textContent = '此浏览器不支持绘制纪念卡；你仍可管理记录、阅读景点或写明信片。';
  renderRecords();
})();

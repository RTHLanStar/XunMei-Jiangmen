/* Progressive enhancements only: all travel advice remains readable without JS. */
(() => {
  'use strict';
  const cover = document.querySelector('.guide-cover');
  const coverData = document.getElementById('cover-photos');
  if (cover && coverData) {
    try {
      const candidates = JSON.parse(coverData.textContent);
      let last = '';
      try { last = sessionStorage.getItem('jiangmen-last-cover') || ''; } catch (_) {}
      const choices = candidates.filter(photo => photo.id !== last);
      const pool = choices.length ? choices : candidates;
      const photo = pool[Math.floor(Math.random() * pool.length)];
      if (photo) {
        const img = cover.querySelector('img');
        cover.dataset.photoId = photo.id;
        cover.classList.toggle('preserve-photo', Boolean(photo.preserve_full));
        img.alt = photo.alt;
        img.width = photo.width; img.height = photo.height;
        img.srcset = `${photo.small} 480w, ${photo.src} ${photo.width}w`;
        img.src = photo.src;
        cover.querySelector('figcaption a').href = '#place-' + photo.id;
        cover.querySelector('.cover-caption').textContent = photo.caption;
        const credit = cover.querySelector('.photo-required-credit');
        credit.textContent = photo.required_credit || '';
        credit.hidden = !photo.required_credit;
        try { sessionStorage.setItem('jiangmen-last-cover', photo.id); } catch (_) {}
      }
    } catch (_) { /* The authored photograph remains a usable offline fallback. */ }
  }
  document.querySelectorAll('.place-photo img').forEach(image => {
    const fallback = () => {
      const window = image.closest('.photo-window');
      if (window) {
        window.classList.add('photo-failed');
        const message = window.querySelector('.photo-unavailable');
        if (message) message.hidden = false;
      }
    };
    image.addEventListener('error', fallback, { once:true });
    if (image.complete && image.naturalWidth === 0) fallback();
  });
  const KEY = 'jiangmen-travel-wishlist';
  const cards = Array.from(document.querySelectorAll('[data-guide-item]'));
  const form = document.querySelector('[data-guide-filter]');
  const results = document.querySelector('.guide-results');
  const empty = document.querySelector('.guide-empty');
  const savedContainer = document.querySelector('.guide-saved');
  const onlyButton = document.querySelector('[data-only-saved]');
  const saveButtons = Array.from(document.querySelectorAll('button[data-save]'));
  let wishlist = new Set();
  let storageAvailable = true;
  let onlySaved = false;

  function parseSaved(value) {
    try {
      const data = JSON.parse(value || '[]');
      return new Set(Array.isArray(data) ? data.filter(id => typeof id === 'string' && id.length > 0 && id.length <= 100).slice(0, 300) : []);
    } catch (_) { return new Set(); }
  }
  try { wishlist = parseSaved(localStorage.getItem(KEY)); }
  catch (_) { storageAvailable = false; }

  let savedStatus = document.querySelector('[data-wishlist-status]');
  if (!savedStatus && savedContainer) {
    savedStatus = document.createElement('p');
    savedStatus.dataset.wishlistStatus = '';
    savedStatus.setAttribute('role', 'status');
    savedContainer.prepend(savedStatus);
  }
  if (results) results.setAttribute('tabindex', '-1');
  const queryInput = form && form.querySelector('[name=q]');
  const areaSelect = form && form.querySelector('[name=area]');
  const searchable = new Map(cards.map(card => [card, card.dataset.keywords || card.textContent]));
  function normalize(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase().trim(); }

  function renderSaved() {
    saveButtons.forEach(button => {
      const saved = wishlist.has(button.dataset.save);
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? '已加入想去 · 取消' : '加入想去';
      const card = button.closest('[data-guide-item]');
      const heading = card && card.querySelector('h2,h3');
      if (heading) button.setAttribute('aria-label', (saved ? '取消想去：' : '加入想去：') + heading.textContent.trim());
    });
    if (savedStatus) {
      const count = wishlist.size;
      savedStatus.textContent = storageAvailable
        ? (count ? `想去清单共 ${count} 项，已存到此浏览器。` : '想去清单保存在此浏览器，可跨景点、美食页面查看。')
        : `浏览器存储不可用，想去清单仅在本页保留（${count} 项）。`;
    }
    if (onlyButton) {
      onlyButton.setAttribute('aria-pressed', String(onlySaved));
      onlyButton.textContent = onlySaved ? '查看本页全部' : '只看本页想去';
    }
    window.dispatchEvent(new CustomEvent('jiangmen:wishlist-change', { detail:{ ids:Array.from(wishlist), persistent:storageAvailable } }));
  }

  function applyFilter() {
    const terms = normalize(queryInput && queryInput.value).split(/\s+/).filter(Boolean);
    const area = areaSelect ? areaSelect.value : '';
    const focused = document.activeElement;
    let shown = 0;
    let lostFocus = false;
    cards.forEach(card => {
      const text = normalize(searchable.get(card));
      const button = card.querySelector('button[data-save]');
      const show = (!area || area === 'all' || card.dataset.area === area)
        && terms.every(term => text.includes(term))
        && (!onlySaved || (button && wishlist.has(button.dataset.save)));
      if (!show && card.contains(focused)) lostFocus = true;
      card.hidden = !show;
      if (show) shown++;
    });
    if (results) results.textContent = `${onlySaved ? '本页想去' : '当前显示'} ${shown} / ${cards.length} 项${area && area !== 'all' ? ` · ${area}` : ''}`;
    if (empty) empty.hidden = shown !== 0;
    if (lostFocus) {
      const next = cards.find(card => !card.hidden);
      const target = (next && next.querySelector('button[data-save]')) || onlyButton || results || queryInput;
      if (target) target.focus({ preventScroll:true });
    }
  }

  function persist() {
    if (!storageAvailable) return;
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(wishlist))); }
    catch (_) { storageAvailable = false; }
  }

  if (cards.length) {
    saveButtons.forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.save;
        if (!id) return;
        if (wishlist.has(id)) wishlist.delete(id);
        else wishlist.add(id);
        persist(); renderSaved(); applyFilter();
      });
      button.hidden = false;
    });
    if (onlyButton) {
      onlyButton.addEventListener('click', () => { onlySaved = !onlySaved; renderSaved(); applyFilter(); });
      onlyButton.hidden = false;
    }
    if (form) {
      form.addEventListener('submit', event => { event.preventDefault(); applyFilter(); });
      form.addEventListener('input', applyFilter);
      form.addEventListener('change', applyFilter);
      form.addEventListener('reset', () => {
        onlySaved = false;
        // The browser restores field values after dispatching the reset event.
        setTimeout(() => { renderSaved(); applyFilter(); }, 0);
      });
      const initialArea = new URLSearchParams(location.search).get('area');
      if (areaSelect && initialArea && Array.from(areaSelect.options).some(option => option.value === initialArea)) areaSelect.value = initialArea;
      const toolbar = form.closest('.guide-toolbar');
      if (toolbar) toolbar.hidden = false;
    }
    if (savedContainer) savedContainer.hidden = false;
    renderSaved(); applyFilter();
    window.addEventListener('storage', event => {
      if (event.key !== KEY && event.key !== null) return;
      if (!storageAvailable) return;
      wishlist = event.key === null ? new Set() : parseSaved(event.newValue);
      renderSaved(); applyFilter();
    });
    window.addEventListener('pageshow', () => {
      // Browsers may restore the form values after pageshow during back navigation.
      setTimeout(() => {
        if (storageAvailable) {
          try { wishlist = parseSaved(localStorage.getItem(KEY)); }
          catch (_) { storageAvailable = false; }
        }
        renderSaved(); applyFilter();
      }, 0);
    });
  }

  document.querySelectorAll('button[data-copy-route]').forEach((button, index) => {
    const route = button.closest('.route-card');
    const content = route && route.querySelector('[data-route-text]');
    if (!content) return;
    button.hidden = false;
    const holder = button.parentElement.closest('.route-copy') || route;
    const status = document.createElement('p');
    status.className = 'route-copy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    holder.append(status);
    let fallback;
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      const text = content.innerText.trim();
      if (!text) { status.textContent = '这条路线暂时没有可复制的文字。'; return; }
      const restoreButtonFocus = document.activeElement === button;
      button.disabled = true;
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        status.textContent = '路线已复制，可以粘贴到备忘录或聊天中。';
        if (fallback) fallback.hidden = true;
      } catch (_) {
        if (!fallback) {
          fallback = document.createElement('div');
          fallback.className = 'route-copy-fallback';
          const label = document.createElement('label');
          const textarea = document.createElement('textarea');
          textarea.id = `route-copy-text-${index}`;
          textarea.readOnly = true;
          textarea.rows = 7;
          label.htmlFor = textarea.id;
          label.textContent = '路线文字（可手动复制）';
          fallback.append(label, textarea);
          holder.append(fallback);
        }
        fallback.hidden = false;
        const textarea = fallback.querySelector('textarea');
        textarea.value = text;
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        status.textContent = '自动复制未成功。文字已选中，可长按复制，或按 Ctrl+C（Mac 按 ⌘C）。';
      } finally {
        button.disabled = false;
        if (restoreButtonFocus && document.activeElement === document.body) button.focus({ preventScroll:true });
      }
    });
  });
})();

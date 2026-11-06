/* Keep the original Knocket widget and local FAQ independent. Open only on request. */
(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('[data-online-chat]')];
  if (!buttons.length) return;
  let subscribed = null, ready = null, pending = false, timer = null, deadline = 0, activeStatus = null;
  const status = message => {
    if (activeStatus) { activeStatus.textContent = message; activeStatus.hidden = false; }
  };
  const stop = () => {
    pending = false; clearInterval(timer); timer = null;
    buttons.forEach(button => button.removeAttribute('aria-busy'));
  };
  const open = () => {
    const widget = window.contactWidget;
    if (!pending || ready !== widget || typeof widget?.showChat !== 'function') return false;
    stop();
    try {
      widget.show?.();
      widget.showChat();
      status('已打开在线客服，可以在窗口中继续提问。');
    } catch (_) {
      status('暂时无法打开在线客服，可点击页面上的客服浮标重试；离线问答仍可使用。');
    }
    return true;
  };
  const check = () => {
    if (!pending) return;
    const widget = window.contactWidget;
    if (widget && widget !== subscribed && typeof widget.on === 'function') {
      subscribed = widget;
      // The SDK's ready event is sticky, including when it loaded before this file.
      widget.on('ready', () => { ready = widget; open(); });
    }
    if (open() || !pending) return;
    if (Date.now() >= deadline) {
      stop();
      status('在线客服暂未连接，请稍后重试，或点击页面上的客服浮标。离线问答仍可使用。');
    }
  };
  buttons.forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      if (activeStatus) activeStatus.hidden = true;
      activeStatus = button.closest('[data-qa-group]')?.querySelector('[data-online-status]');
      stop();
      if (navigator.onLine === false) {
        status('当前网络不可用，联网后可使用在线客服；离线问答仍可阅读和搜索。');
        return;
      }
      pending = true; deadline = Date.now() + 12000;
      buttons.forEach(item => item.setAttribute('aria-busy', 'true'));
      status('正在连接在线客服，请稍候。离线问答仍可使用。');
      check();
      if (pending) timer = setInterval(check, 200);
    });
  });
  window.addEventListener('offline', () => {
    if (!pending) return;
    stop(); status('网络已断开，联网后可重试在线客服；离线问答仍可阅读和搜索。');
  });
})();

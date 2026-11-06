/* Local, user-initiated printing. No network, persistence or auto-open dialog. */
(() => {
  'use strict';
  const tools = document.querySelector('[data-print-tools]');
  if (!tools || typeof window.print !== 'function') return;
  const button = tools.querySelector('[data-print-page]');
  if (!button) return;
  const status = tools.querySelector('[data-print-status]');
  let originalDetails = null;
  let printSummary = null;
  const prepare = () => {
    if (originalDetails) return;
    originalDetails = new Map();
    document.querySelectorAll('main details').forEach(detail => {
      if (detail.closest('[hidden]')) return;
      // Include answers and provenance, not an additional gallery of suggestions.
      if (detail.classList.contains('companion-details')) return;
      originalDetails.set(detail, detail.open);
      detail.open = true;
    });
    const results = document.querySelector('.guide-results');
    const heading = document.querySelector('main .guide-hero,main .page-hero');
    if (results && heading && results.textContent.trim()) {
      printSummary = document.createElement('p');
      printSummary.className = 'print-selection';
      printSummary.textContent = results.textContent.trim();
      heading.insertAdjacentElement('afterend', printSummary);
    }
  };
  const restore = () => {
    if (!originalDetails) return;
    originalDetails.forEach((open, detail) => { if (detail.isConnected) detail.open = open; });
    originalDetails = null;
    if (printSummary) printSummary.remove();
    printSummary = null;
  };
  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', restore);
  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia('print');
    const changed = event => event.matches ? prepare() : restore();
    if (media.addEventListener) media.addEventListener('change', changed);
    else if (media.addListener) media.addListener(changed);
  }
  button.addEventListener('click', () => {
    if (status) status.hidden = true;
    try { window.print(); }
    catch (_) {
      restore();
      if (status) {
        status.textContent = '当前浏览器无法打开打印窗口，可在浏览器菜单中选择打印，或用电脑打开这一页。';
        status.hidden = false;
      }
    }
  });
  tools.hidden = false;
})();

/* Progressive enhancement of the FAQ already present in this HTML document. */
(function () {
  'use strict';
  var panel = document.getElementById('faq-panel');
  if (!panel) return;
  var form = panel.querySelector('.faq-controls');
  var input = document.getElementById('faq-query');
  var category = document.getElementById('faq-category');
  var status = document.getElementById('faq-results-status');
  var empty = document.getElementById('faq-empty');
  var clear = document.getElementById('faq-clear');
  var cards = Array.prototype.slice.call(panel.querySelectorAll('.faq-item'));
  if (!form || !input || !category || !status || !empty || !clear || !cards.length) return;
  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[\s，。！？、：；“”‘’「」《》·\/,.!?;:'"()（）—-]+/g, '');
  }
  var records = cards.map(function (card) {
    return {node: card, category: card.dataset.category, search: normalize(card.dataset.faqSearch),
      keywords: (card.dataset.faqKeywords || '').split(/[、，,\/]/).map(normalize).filter(function (word) { return word.length >= 2; })};
  });
  var vocabulary = [];
  records.forEach(function (record) { record.keywords.forEach(function (word) { if (vocabulary.indexOf(word) < 0) vocabulary.push(word); }); });
  vocabulary.sort(function (a, b) { return b.length - a.length; });
  function queryTerms(query) {
    var remaining = normalize(query).replace(/^(?:请问|我想去|我想了解|我想知道|想去|想了解)/, ''), terms = [];
    vocabulary.forEach(function (word) {
      if (remaining.indexOf(word) >= 0) { terms.push(word); remaining = remaining.split(word).join(' '); }
    });
    return terms.length > 1 ? terms.filter(function (word) { return word !== '江门'; }) : terms;
  }
  function updateUrl(clearHash) {
    try {
      var url = new URL(window.location.href), value = input.value.trim().slice(0, 80);
      if (value) url.searchParams.set('q', value); else url.searchParams.delete('q');
      if (clearHash && /^#q-\d+$/.test(url.hash)) url.hash = '';
      window.history.replaceState(null, '', url.href);
    } catch (_) { /* Restricted file:// histories do not affect local search. */ }
  }
  function filter(updateHistory) {
    var value = input.value.trim().slice(0, 80), query = normalize(value);
    var tokens = value.split(/\s+/).filter(Boolean).map(normalize), related = queryTerms(value), count = 0;
    records.forEach(function (record) {
      var matched = !query || record.search.indexOf(query) >= 0 || (tokens.length > 1
        ? tokens.every(function (word) { return record.search.indexOf(word) >= 0; })
        : related.length > 0 && related.every(function (word) { return record.search.indexOf(word) >= 0; }));
      var visible = matched && (category.value === 'all' || category.value === record.category);
      record.node.hidden = !visible;
      if (visible) count += 1;
    });
    empty.hidden = count !== 0;
    status.textContent = !value && category.value === 'all'
      ? '共 ' + cards.length + ' 条问答，可展开阅读。'
      : '找到 ' + count + ' 条相关问答（共 ' + cards.length + ' 条）。';
    if (updateHistory) updateUrl(true);
  }
  function openHash() {
    var match = /^#q-([1-9]\d{0,3})$/.exec(window.location.hash);
    if (!match) return false;
    var target = document.getElementById('q-' + match[1]);
    if (!target || !target.classList.contains('faq-item')) return false;
    input.value = ''; category.value = 'all'; filter(false); updateUrl(false);
    target.open = true;
    // Re-run anchor placement after a previously filtered record is unhidden.
    window.requestAnimationFrame(function () { target.scrollIntoView({block: 'start', behavior: 'auto'}); });
    return true;
  }
  form.addEventListener('submit', function (event) { event.preventDefault(); filter(true); });
  input.addEventListener('input', function () { filter(true); });
  category.addEventListener('change', function () { filter(true); });
  clear.addEventListener('click', function () { input.value = ''; category.value = 'all'; filter(true); input.focus(); });
  window.addEventListener('hashchange', openHash);
  window.addEventListener('popstate', function () {
    if (openHash()) return;
    try { input.value = (new URL(window.location.href).searchParams.get('q') || '').slice(0, 80); } catch (_) { input.value = ''; }
    category.value = 'all'; filter(false);
  });
  // A repeated click on the current hash does not dispatch hashchange.
  panel.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="#q-"]');
    if (link && link.getAttribute('href') === window.location.hash) openHash();
  });
  try { input.value = (new URL(window.location.href).searchParams.get('q') || '').slice(0, 80); } catch (_) { input.value = ''; }
  form.hidden = false;
  if (!openHash()) filter(false);
})();

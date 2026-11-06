/* Theme switch: follow the system by default, with an explicit override.
   The resolved theme lives on <html data-theme>; how it was chosen lives on
   <html data-theme-source>, so the palette is written only once. */
(() => {
  'use strict';
  const KEY = 'jiangmen-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const meta = document.getElementById('theme-color');
  let source = 'auto';
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') source = stored;
  } catch (_) { /* storage unavailable: keep following the system */ }

  const effective = () => (source === 'auto' ? (media.matches ? 'dark' : 'light') : source);
  const LABELS = {
    auto: { light: '当前跟随系统，显示浅色。点击固定为深色模式', dark: '当前跟随系统，显示深色。点击固定为浅色模式' },
    light: { light: '当前浅色模式。点击恢复跟随系统' },
    dark: { dark: '当前深色模式。点击切换为浅色模式' }
  };
  const NAMES = { auto: '跟随系统', light: '浅色', dark: '深色' };

  function apply() {
    const now = effective();
    root.setAttribute('data-theme', now);
    root.setAttribute('data-theme-source', source);
    if (meta) meta.content = now === 'dark' ? '#0f2824' : '#183d36';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const label = LABELS[source][now];
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      const text = button.querySelector('.theme-toggle-text');
      if (text) text.textContent = NAMES[source];
    });
  }

  function advance() {
    if (source === 'auto') source = effective() === 'dark' ? 'light' : 'dark';
    else if (source === 'dark') source = 'light';
    else source = 'auto';
    try {
      if (source === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, source);
    } catch (_) { /* keep the switch usable for this session */ }
    apply();
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.addEventListener('click', advance);
  });
  media.addEventListener?.('change', () => { if (source === 'auto') apply(); });
  apply();
})();

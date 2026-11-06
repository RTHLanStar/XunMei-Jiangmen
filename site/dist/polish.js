/* Progressive enhancements. No remote libraries, autoplay or hidden content. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Map();
  let entranceObserver;

  function stopAnimation(element) {
    const animation = running.get(element);
    if (animation) animation.cancel();
    running.delete(element);
  }
  function animateOnce(element, keyframes, options) {
    if (motion.matches || typeof element.animate !== 'function' || element.contains(document.activeElement)) return;
    stopAnimation(element);
    const animation = element.animate(keyframes, options);
    running.set(element, animation);
    const cleanup = () => { if (running.get(element) === animation) running.delete(element); };
    animation.finished.then(cleanup, cleanup);
  }
  function stopMotion() {
    if (!motion.matches) return;
    entranceObserver?.disconnect();
    for (const animation of running.values()) animation.cancel();
    running.clear();
  }
  motion.addEventListener?.('change', stopMotion);
  document.addEventListener('focusin', event => {
    for (const [element] of running) {
      if (element.contains(event.target)) stopAnimation(element);
    }
  });

  // The elements stay visible at all times; intersecting only adds a brief motion.
  if (!motion.matches && 'IntersectionObserver' in window) {
    entranceObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entranceObserver.unobserve(entry.target);
        animateOnce(entry.target, [
          { opacity:.75, transform:'translateY(8px)' },
          { opacity:1, transform:'none' }
        ], { duration:400, easing:'cubic-bezier(.2,.65,.3,1)' });
      }
    }, { threshold:.12, rootMargin:'0px 0px -16px 0px' });
    document.querySelectorAll('.section-head,.explore-more>div:first-child,.explore-grid>a,.story-title,.about-section-heading,.page-ending,.letters-body .passport>div:first-child').forEach(element => entranceObserver.observe(element));
  }

  // Existing saved stamps load quietly. Only a newly collected stamp is pressed once.
  if ('MutationObserver' in window) {
    document.querySelectorAll('.stamps [data-stamp]').forEach(element => {
      let wasOwned = element.classList.contains('owned');
      new MutationObserver(() => {
        const isOwned = element.classList.contains('owned');
        if (isOwned && !wasOwned) animateOnce(element, [
          { transform:'translateY(-5px) scale(1.15) rotate(3deg)' },
          { transform:'translateY(0) scale(.97) rotate(-8deg)', offset:.72 },
          { transform:'translateY(0) scale(1) rotate(-8deg)' }
        ], { duration:340, easing:'cubic-bezier(.2,.7,.3,1)' });
        if (!isOwned) stopAnimation(element);
        wasOwned = isOwned;
      }).observe(element, { attributes:true, attributeFilter:['class'] });
    });
  }

  const header = document.querySelector('.site-header');
  if (header) {
    const measureHeader = () => document.documentElement.style.setProperty('--site-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    measureHeader();
    if ('ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
    else window.addEventListener('resize', measureHeader, { passive:true });
  }

  const frame = document.querySelector('.film-frame');
  const video = frame?.querySelector('video');
  const play = frame?.querySelector('.film-play');
  const source = video?.querySelector('source[data-src]');
  const status = document.getElementById('film-status');
  if (!video || !play || !source) return;

  let requested = false;
  let failed = false;
  let attempt = 0;
  const setStatus = text => { if (status) status.textContent = text; };
  function showFailure() {
    failed = true;
    play.disabled = false;
    play.hidden = false;
    play.textContent = '重试播放';
    play.setAttribute('aria-label', '重试播放66秒短片');
    setStatus('短片暂时未能播放。可以重试，或使用下方“下载短片”观看。');
  }
  play.hidden = false;
  play.addEventListener('click', () => {
    const thisAttempt = ++attempt;
    requested = true;
    play.disabled = true;
    play.hidden = true;
    video.focus({ preventScroll:true });
    setStatus('正在载入短片…');
    try {
      if (!source.getAttribute('src') || failed) {
        source.src = source.dataset.src;
        failed = false;
        video.load();
      }
      // Calling play directly in the click handler preserves mobile user activation.
      const playback = video.play();
      if (playback?.catch) playback.catch(error => {
        if (thisAttempt !== attempt) return;
        // A user pressing pause while playback is pending is not a network failure.
        if (error.name === 'AbortError' && !video.error) { play.disabled = false; setStatus(''); return; }
        showFailure();
      });
    } catch { showFailure(); }
  });
  video.addEventListener('playing', () => {
    failed = false;
    play.hidden = true;
    play.disabled = false;
    setStatus('');
  });
  video.addEventListener('waiting', () => { if (requested && !failed) setStatus('正在缓冲…'); });
  video.addEventListener('pause', () => { if (!failed) setStatus(''); });
  video.addEventListener('ended', () => {
    play.hidden = true;
    setStatus('短片已播放完，可用播放器控件再次播放。');
  });
  video.addEventListener('error', () => { if (requested) showFailure(); });
  source.addEventListener('error', () => { if (requested) showFailure(); });
})();

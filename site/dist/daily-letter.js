'use strict';
(() => {
  const section = document.getElementById('daily-letter');
  if (!section) return;
  const source = section.querySelector('#daily-letter-data');
  const slot = section.querySelector('[data-daily-letter-slot]');
  const button = section.querySelector('[data-daily-letter-next]');
  const status = section.querySelector('[data-daily-letter-status]');
  if (!source || !slot || !button || !status) return;

  let letters;
  try {
    letters = JSON.parse(source.textContent);
    if (!Array.isArray(letters) || letters.length < 2 || letters.some(letter =>
      !letter || typeof letter.id !== 'string' || typeof letter.html !== 'string' ||
      typeof letter.name !== 'string' || typeof letter.poem !== 'string')) return;
  } catch (_) {
    return; // The first server-rendered letter stays readable without enhancement.
  }
  let current = letters.findIndex(letter => letter.id === slot.firstElementChild?.dataset.letterId);
  if (current < 0) return;

  function watchPhoto(card, letter, wasRequested) {
    const image = card.querySelector('img');
    const window = card.querySelector('.photo-window');
    const fallback = card.querySelector('.photo-unavailable');
    if (!image || !window || !fallback) return;
    const isCurrent = () => slot.firstElementChild === card;
    const showFailure = () => {
      if (!isCurrent()) return;
      window.classList.add('photo-failed');
      fallback.hidden = false;
      fallback.textContent = '照片暂未加载，仍可阅读这封来信与旅行介绍。';
      if (wasRequested) status.textContent = `${letter.name}的照片暂未加载，仍可阅读这封来信。`;
    };
    const showPhoto = () => {
      if (!isCurrent()) return;
      window.classList.remove('photo-failed');
      fallback.hidden = true;
    };
    image.addEventListener('load', showPhoto);
    image.addEventListener('error', showFailure);
    // Cached loads/failures can happen before the listeners are attached.
    if (image.complete) {
      if (image.naturalWidth > 0) showPhoto();
      else showFailure();
    }
  }

  watchPhoto(slot.firstElementChild, letters[current], false);
  button.hidden = false;
  button.addEventListener('click', () => {
    // Choose an offset rather than retrying random picks: even rapid clicks
    // always advance to a different letter and need no timer or network wait.
    const next = (current + 1 + Math.floor(Math.random() * (letters.length - 1))) % letters.length;
    const letter = letters[next];
    const template = document.createElement('template');
    template.innerHTML = letter.html;
    const card = template.content.firstElementChild;
    if (!card || card.dataset.letterId !== letter.id) return;
    slot.replaceChildren(card);
    current = next;
    status.textContent = `已拆开来自${letter.name}的来信。${letter.poem}同区寻味：${letter.foodName}。`;
    watchPhoto(card, letter, true);
  });
})();

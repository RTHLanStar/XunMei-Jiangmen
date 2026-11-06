/* A local, progressively enhanced picker. No requests or saved user data. */
(() => {
  'use strict';

  document.querySelectorAll('[data-route-finder]').forEach((finder) => {
    const form = finder.querySelector('[data-route-finder-form]');
    const results = finder.querySelector('[data-route-finder-results]');
    const staticNote = finder.querySelector('[data-route-finder-static]');
    if (!form || !results) return;

    const durations = ['half-day', 'one-day', 'two-days'];
    const interests = ['architecture', 'nature', 'food'];
    const choices = new Map();

    finder.querySelectorAll('template[data-route-finder-choice]').forEach((template) => {
      if (template.content && template.content.childElementCount) {
        choices.set(template.dataset.routeFinderChoice, template);
      }
    });

    // Keep the static recommendation and hidden controls if markup is incomplete.
    const complete = durations.every((duration) => interests.every((interest) => (
      choices.has(`${duration}:${interest}`)
    )));
    const radiosPresent = [
      ['route-duration', durations],
      ['route-interest', interests],
    ].every(([name, values]) => values.every((value) => (
      form.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`)
    )));
    if (!complete || !radiosPresent || !form.querySelector('button[type="submit"]')) return;

    function showSelection(event) {
      if (event) event.preventDefault();
      const duration = form.querySelector('input[name="route-duration"]:checked');
      const interest = form.querySelector('input[name="route-interest"]:checked');
      if (!duration || !interest) return;
      const template = choices.get(`${duration.value}:${interest.value}`);
      if (!template) return;
      // Cloning a generated template keeps text safe and the links keyboard usable.
      results.replaceChildren(template.content.cloneNode(true));
    }

    // Browsers may restore radio values after navigating back. Match that state.
    showSelection();
    form.addEventListener('submit', showSelection);
    form.hidden = false;
    if (staticNote) staticNote.hidden = true;
  });
})();

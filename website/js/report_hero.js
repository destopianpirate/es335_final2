// Page heroes (Report, Data Studio): each plays its entrance once, the first time its page is shown.
// On the Report the four scores count up from zero as their marks land on the scale.
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  function count(el, delay) {
    const to = parseFloat(el.dataset.to), dur = 900;
    el.textContent = '0.0000';
    setTimeout(() => {
      const t0 = performance.now();
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (to * e).toFixed(4);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, delay);
  }

  function setup(heroId, panelId) {
    const hero = document.getElementById(heroId), panel = document.getElementById(panelId);
    if (!hero || !panel) return;
    hero.classList.add('rh-ready');
    let played = false;
    function play() {
      if (played || panel.classList.contains('hidden')) return;
      played = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        hero.classList.add('rh-in');
        hero.querySelectorAll('.rh-mk b[data-to]').forEach((b, i) => count(b, 1050 + i * 160));
      }));
    }
    new MutationObserver(play).observe(panel, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('hashchange', () => setTimeout(play, 60));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', play); else play();
  }

  setup('rpt-top', 'view-report');
  setup('dsn-top', 'view-data-studio');
})();

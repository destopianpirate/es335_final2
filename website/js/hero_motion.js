// Overview hero: word-by-word headline reveal, count-up stats and a pointer spotlight.
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const ease = t => 1 - Math.pow(1 - t, 3);

  // ---------- headline: split into words that rise in one by one ----------
  function splitTitle() {
    const h = $('ovn-title');
    if (!h || h.dataset.split) return;
    h.dataset.split = '1';
    const text = h.textContent.trim().replace(/\s+/g, ' ');
    const emph = /^(Subscription|Churn)$/;
    h.setAttribute('aria-label', text);
    h.innerHTML = text.split(' ').map((w, i) =>
      `<span class="hw-wrap" aria-hidden="true"><span class="hw ${emph.test(w) ? 'hw-em' : ''}" style="--i:${i}">${w}</span></span>`).join(' ');
  }

  // ---------- count-up numbers ----------
  function countUp(el, target, kind) {
    const fmt = v => kind === 'int' ? Math.round(v).toLocaleString('en-IN')
      : kind === 'pct1' ? (v * 100).toFixed(1) + '%' : v.toFixed(4);
    if (reduce) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 1600;
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(target * ease(k));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function stats() {
    const S = window.SITE_DATA || window.SITE;
    if (!S) return;
    const champ = (S.test_metrics || []).find(r => /tuned/i.test(r.model)) || (S.test_metrics || [])[0] || {};
    const vals = {
      subs: [S.data.train.subscribers, 'int'], churn: [S.data.train.churn_rate, 'pct1'],
      pr: [champ.pr_auc, 'dec'], roc: [champ.roc_auc, 'dec'],
    };
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const v = vals[e.target.dataset.hero];
        if (v && v[0] != null) countUp(e.target, v[0], v[1]);
      });
    }, { threshold: 0.4 }) : null;
    document.querySelectorAll('[data-hero]').forEach(el => {
      const v = vals[el.dataset.hero];
      if (!v || v[0] == null) return;
      if (io) io.observe(el); else countUp(el, v[0], v[1]);
    });
  }

  // soft spotlight that follows the pointer across the hero
  function spotlight() {
    const s = $('ovn-question');
    if (!s || s.dataset.spot || reduce) return;
    s.dataset.spot = '1';
    s.addEventListener('pointermove', e => {
      const r = s.getBoundingClientRect();
      s.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      s.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  window.ovnRenderHero = function () { splitTitle(); stats(); spotlight(); };
})();

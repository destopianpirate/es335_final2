// Section rail: a column of dots at the left edge of the page (just right of the sidebar).
// One dot per section of the open page (Overview or Data Studio). The dot of the section you are reading turns red,
// hovering shows the section name, clicking scrolls to it.
(function () {
  const NAMES = {
    'ovn-question': 'Top: the question', 'ovn-data': 'Data', 'ovn-preprocessing': 'Preprocessing', 'ovn-models': 'Baselines & methods',
    'ovn-evaluation': 'Evaluation', 'ovn-results': 'Results', 'ovn-errors': 'Errors', 'ovn-limitations': 'Limitations',
    'ovn-conclusion': 'Conclusion', 'ovn-repro': 'Reproduction steps',
    'dsn-tables': 'The five tables', 'dsn-raw': 'Raw data', 'dsn-overlap': 'File overlap', 'dsn-quality': 'Data quality',
    'dsn-signals': 'Churn signal explorer', 'dsn-explorer': 'Churn by group', 'dsn-features': 'Feature analysis',
    'dsn-training': 'Data for training', 'dsn-split': 'Train / val / test split',
  };

  const rail = document.createElement('nav');
  rail.id = 'section-rail';
  rail.setAttribute('aria-label', 'Page sections');
  document.body.appendChild(rail);

  let secs = [], dots = [], active = -1, ticking = false, builtFor = null;

  function openPanel() { return document.querySelector('.view-panel:not(.hidden)'); }

  function place() {
    const sb = document.getElementById('app-sidebar');
    const right = sb ? Math.max(0, sb.getBoundingClientRect().right) : 76;
    rail.style.left = (right + 26) + 'px';
  }

  function label(sec) {
    if (NAMES[sec.id]) return NAMES[sec.id];
    const h = sec.querySelector('h1, h2');
    return h ? h.textContent.trim().replace(/\s+/g, ' ') : sec.id;
  }

  function build() {
    const panel = openPanel();
    const list = panel && panel.id !== 'view-model-predictor' ? Array.from(panel.querySelectorAll(':scope > section[id]')) : [];
    const key = list.map(s => s.id).join('|');
    if (key === builtFor) return;
    builtFor = key;
    secs = list; active = -1;
    rail.classList.toggle('is-empty', secs.length === 0);
    rail.innerHTML = secs.map((s, i) => {
      const chap = s.querySelector('.chap-no');
      const no = chap ? chap.textContent.trim() : null;      // sections without a chapter plate (the hero) are unnumbered
      const tip = no ? `<i>${no}</i>${label(s)}` : `<span class="material-symbols-outlined">arrow_upward</span>${label(s)}`;
      return `<button type="button" class="sr-dot${no ? '' : ' is-home'}" data-i="${i}" aria-label="${label(s)}">
         <span class="sr-pip"></span>
         <span class="sr-tip">${tip}</span>
       </button>`;
    }).join('');
    dots = Array.from(rail.querySelectorAll('.sr-dot'));
    spy();
  }

  function spy() {
    ticking = false;
    if (!secs.length) return;
    const line = window.innerHeight * 0.35;
    let idx = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    // at the very bottom of the page the last section is the one being read
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = secs.length - 1;
    if (idx === active) return;
    active = idx;
    dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === idx);
      d.classList.toggle('is-past', i < idx);
      d.setAttribute('aria-current', i === idx ? 'true' : 'false');
    });
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }

  rail.addEventListener('click', e => {
    const b = e.target.closest('.sr-dot');
    if (!b) return;
    const s = secs[+b.dataset.i];
    if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { place(); onScroll(); });
  window.addEventListener('hashchange', () => setTimeout(() => { build(); place(); }, 120));

  // follow the sidebar while it opens and closes
  const sb = document.getElementById('app-sidebar');
  if (sb && window.ResizeObserver) new ResizeObserver(place).observe(sb);

  // rebuild when the visible page (view) changes
  const mo = new MutationObserver(() => { build(); onScroll(); });
  document.querySelectorAll('.view-panel').forEach(p => mo.observe(p, { attributes: true, attributeFilter: ['class'] }));

  function init() { build(); place(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', () => { build(); place(); onScroll(); });
})();

// chapter plates fill in when they scroll into view
(function () {
  const plates = document.querySelectorAll('.chap');
  if (!('IntersectionObserver' in window)) { plates.forEach(p => p.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.6 });
  plates.forEach(p => io.observe(p));
})();

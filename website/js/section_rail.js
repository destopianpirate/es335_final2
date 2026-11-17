// Section rail: a column of dots at the left edge of the page (just right of the sidebar).
// One dot per section of the open page (Overview or Data Studio). The dot of the section you are reading turns red,
// hovering shows the section name, clicking scrolls to it.
(function () {
  const NAMES = {
    'ovn-question': 'Top: the question', 'rpt-top': 'Top: the question', 'ovn-data': 'Data', 'ovn-preprocessing': 'Preprocessing', 'ovn-models': 'Baselines & methods',
    'ovn-evaluation': 'Evaluation', 'ovn-results': 'Results', 'ovn-errors': 'Errors', 'ovn-limitations': 'Limitations',
    'ovn-conclusion': 'Conclusion', 'ovn-repro': 'Reproduction steps', 'ovn-why': 'Why', 'ovn-leakage': 'Leakage', 'ovn-failures': 'Failure modes',
    'ovn-runtime': 'Runtime model', 'ovn-next': 'What next', 'ovn-ai': 'AI assistance', 'ovn-libs': 'Libraries and data',
    'dsn-top': 'Top: contents', 'dsn-tables': 'The five tables', 'dsn-raw': 'Raw data', 'dsn-overlap': 'File overlap', 'dsn-quality': 'Data quality',
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
    rail.style.left = (right + 46) + 'px';   // room for the centred section label under the active dot
    if (curLabel) { clamp(curLabel); trackCuts(500); }
  }

  function label(sec) {
    if (NAMES[sec.id]) return NAMES[sec.id];
    const h = sec.querySelector('h1, h2');
    return h ? h.textContent.trim().replace(/\s+/g, ' ') : sec.id;
  }

  function build() {
    const panel = openPanel();
    let list = panel && panel.id !== 'view-model-predictor' && panel.id !== 'view-home' ? Array.from(panel.querySelectorAll(':scope > section[id]')) : [];
    if (list.length < 2) list = [];   // a one-section page (Home) needs no rail
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
    curLabel = null; outLabels = [];
    docked = null;
    rail.classList.add('sr-away');
    dots.forEach(d => { d.style.opacity = '0'; });
    spy();
  }

  // ---- dock / undock: the dots fly between the hero heading and the rail ----
  let docked = null, flyTimer = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';

  // where dot i comes from: its own row in the page's "On this page" list (number badge), else the list title / heading
  function originOf(i) {
    const hero = secs[0];
    const toc = hero && hero.querySelector('nav[aria-label="On this page"]');
    let el = null;
    if (toc) {
      const a = toc.querySelector(`a[href="#${secs[i].id}"]`);
      el = a ? (a.querySelector('span') || a) : toc.querySelector('h2, h3');
    }
    if (!el) el = hero.querySelector('h1, h2') || hero;
    const r = el.getBoundingClientRect();
    const h = window.innerHeight;
    return { x: r.left + Math.min(r.width, 240) / 2, y: Math.max(-h, Math.min(2 * h, r.top + r.height / 2)) };
  }

  function setDocked(on) {
    if (on === docked) return;
    const first = docked === null;
    docked = on;
    rail.classList.toggle('sr-away', !on);
    if (reduce || (first && !on)) {
      dots.forEach(d => { d.style.transition = 'opacity .2s'; d.style.transform = ''; d.style.opacity = on ? '' : '0'; });
      return;
    }
    const n = dots.length;
    // the name under the active dot waits until the dots have landed, then fades in
    clearTimeout(flyTimer);
    rail.classList.add('sr-flying');
    flyTimer = setTimeout(() => rail.classList.remove('sr-flying'), on ? 750 + n * 45 : 0);
    const rr = rail.getBoundingClientRect();
    dots.forEach((d, i) => {
      // resting position of the dot (offsets ignore any transform still on it)
      const cx = rr.left + d.offsetLeft + d.offsetWidth / 2, cy = rr.top + d.offsetTop + d.offsetHeight / 2;
      const o = originOf(i);
      const dx = o.x - cx, dy = o.y - cy;
      // start as the list's number badge (bigger), shrink into a pip on arrival
      const away = `translate(${dx}px, ${dy}px) scale(2.2)`;
      if (on) {
        const delay = i * 45;
        d.style.transition = 'none';
        d.style.transform = away;
        d.style.opacity = '0';
        void d.offsetWidth;
        d.style.transition = `transform .85s ${EASE} ${delay}ms, opacity .35s ease ${delay}ms`;
        d.style.transform = '';
        d.style.opacity = '';
      } else {
        const delay = (n - 1 - i) * 25;
        d.style.transition = `transform .55s cubic-bezier(.55, 0, .75, .2) ${delay}ms, opacity .4s ease ${delay + 150}ms`;
        d.style.transform = away;
        d.style.opacity = '0';
      }
    });
  }

  function spy() {
    ticking = false;
    if (!secs.length) return;
    // over the hero (the first section) the rail is hidden; once it scrolls mostly away, the dots fly in
    setDocked(secs[0].getBoundingClientRect().bottom < window.innerHeight * 0.45);
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
    moveLabel(idx);
  }

  // ---- the open section's name, below its dot ----
  // Each label lives inside its dot, so it moves exactly with the dot. On a change the old name
  // fades and drifts out while the gap under its dot closes; the new name fades and slides in as
  // the gap under the new dot opens. The track line is cut behind every visible label.
  let curLabel = null, outLabels = [], cutRaf = 0, lastIdx = -1;
  const GAP = 10;

  function makeLabel(no, name) {
    const el = document.createElement('span');
    el.className = 'sr-label';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i></i><span></span>';
    el.querySelector('i').textContent = no;
    el.querySelector('span').textContent = name;
    return el;
  }

  // nudge a centred label right if it would run under the sidebar
  function clamp(el) {
    const sb = document.getElementById('app-sidebar');
    const sbRight = sb ? Math.max(0, sb.getBoundingClientRect().right) : 0;
    const d = el.parentElement.getBoundingClientRect();
    const leftEdge = d.left + d.width / 2 - el.offsetWidth / 2;
    el.style.setProperty('--dx', Math.max(0, sbRight + 8 - leftEdge).toFixed(1) + 'px');
  }

  function moveLabel(idx) {
    const dot = dots[idx];
    if (!dot) return;
    const s = secs[idx];
    const chap = s.querySelector('.chap-no');
    const no = chap ? chap.textContent.trim() : '';
    const name = label(s).replace(/^Top: /, '');
    const snap = !curLabel || reduce;
    const dir = idx >= lastIdx ? 1 : -1;     // scrolling down: names travel down; up: they travel up
    lastIdx = idx;

    // the old name leaves
    if (curLabel) {
      const old = curLabel, oldDot = old.parentElement;
      old.style.setProperty('--dir', dir);
      old.classList.add('is-out');
      if (oldDot) oldDot.style.marginBottom = '';
      outLabels.push(old);
      setTimeout(() => { old.remove(); outLabels = outLabels.filter(x => x !== old); }, snap ? 0 : 420);
    }

    // the new name arrives
    const el = makeLabel(no, name);
    el.style.setProperty('--dir', dir);
    if (!snap) el.classList.add('is-in');
    dot.appendChild(el);
    clamp(el);
    dot.style.marginBottom = (el.offsetHeight + GAP) + 'px';
    curLabel = el;
    if (!snap) { void el.offsetWidth; el.classList.remove('is-in'); }

    trackCuts(snap ? 0 : 700);
  }

  // cut the rail line behind the labels while the dots and gaps move
  function trackCuts(ms) {
    cancelAnimationFrame(cutRaf);
    const t0 = performance.now();
    (function step(t) {
      const rr = rail.getBoundingClientRect();
      const span = el => { const r = el.getBoundingClientRect(); return [r.top - rr.top - 3, r.bottom - rr.top + 3]; };
      const a = curLabel ? span(curLabel) : [-100, -100];
      const live = outLabels.filter(x => x.isConnected);
      const b = live.length ? span(live[live.length - 1]) : [-100, -100];
      rail.style.setProperty('--cut-a', a[0].toFixed(1) + 'px');
      rail.style.setProperty('--cut-b', a[1].toFixed(1) + 'px');
      rail.style.setProperty('--cut-c', b[0].toFixed(1) + 'px');
      rail.style.setProperty('--cut-d', b[1].toFixed(1) + 'px');
      if (t - t0 < ms) cutRaf = requestAnimationFrame(step);
    })(t0);
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

// Single-page router: Overview, Data Studio, Model Predictor.

const VIEW_TITLES = {
  'overview': 'Overview',
  'data-studio': 'Data Studio',
  'model-predictor': 'Model Predictor',
};

// Section anchors that live inside each view (used to open the right view for a deep link)
const VIEW_ANCHORS = {
  'overview': ['ovn-data', 'ovn-preprocessing', 'ovn-models', 'ovn-evaluation', 'ovn-results', 'ovn-errors', 'ovn-limitations', 'ovn-conclusion', 'ovn-repro'],
  'data-studio': ['dsn-tables', 'dsn-raw', 'dsn-overlap', 'dsn-quality', 'dsn-signals', 'dsn-explorer', 'dsn-features', 'dsn-training', 'dsn-split'],
};

const initialised = {};

function parseRoute() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (!hash) return { view: 'overview', anchor: null };
  if (VIEW_TITLES[hash]) return { view: hash, anchor: null };
  for (const [view, anchors] of Object.entries(VIEW_ANCHORS)) {
    if (anchors.includes(hash)) return { view, anchor: hash };
  }
  return { view: 'overview', anchor: null };
}

function initView(view) {
  if (initialised[view]) return;
  initialised[view] = true;
  try {
    if (view === 'overview' && window.initOverview) window.initOverview();
    if (view === 'data-studio' && window.initDataStudio) window.initDataStudio();
  } catch (err) {
    console.warn(`Rendering error in ${view}:`, err);
  }
}

// The browser would otherwise restore the previous scroll position after the page renders
// (so the homepage can open halfway down). We control the first scroll ourselves.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let firstRoute = true;
let userScrolled = false;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true }));

function switchView(view, anchor = null) {
  const isPredictor = view === 'model-predictor';
  document.getElementById('app-footer')?.classList.toggle('hidden', isPredictor);
  document.body.classList.toggle('predictor-viewport-locked', isPredictor);

  document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('hidden', p.id !== `view-${view}`));

  const title = document.getElementById('header-view-title');
  if (title) title.innerHTML = VIEW_TITLES[view];

  updateSidebarState(view);
  // Defer one frame so the panel is visible and canvases get real sizes
  requestAnimationFrame(() => {
    initView(view);
    if (isPredictor && typeof showInputScreen === 'function') showInputScreen();
  });

  const behavior = firstRoute ? 'auto' : 'smooth';
  const go = () => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior, block: 'start' });
    else window.scrollTo({ top: 0, behavior });
  };
  if (anchor) setTimeout(go, 80); else go();

  if (firstRoute) {
    // Charts and fonts change the page height while it loads: settle once more, unless the reader already moved.
    const settle = () => { if (!userScrolled) { userScrolled = false; go(); } };
    window.addEventListener('load', () => { settle(); setTimeout(settle, 400); }, { once: true });
    firstRoute = false;
  }
}

function updateSidebarState(view) {
  const rows = {
    'overview': document.getElementById('row-overview'),
    'data-studio': document.getElementById('row-data-studio'),
    'model-predictor': document.getElementById('row-model-predictor'),
  };
  const active = view;
  Object.entries(rows).forEach(([key, row]) => {
    if (!row) return;
    row.style.backgroundColor = '';
    const on = key === active;
    row.classList.toggle('active-nav-row', on);
    row.classList.toggle('text-slate-700', !on);
    row.querySelector('.sidebar-nav-icon')?.classList.toggle('text-slate-500', !on);
    row.querySelector('.sidebar-text')?.classList.toggle('text-slate-800', !on);
    row.querySelector('.sidebar-nav-icon')?.classList.remove('text-white');
    row.querySelector('.sidebar-text')?.classList.remove('text-white');
  });
}

function handleRoute() {
  const { view, anchor } = parseRoute();
  switchView(view, anchor);
}

window.addEventListener('hashchange', handleRoute);

document.addEventListener('DOMContentLoaded', handleRoute);

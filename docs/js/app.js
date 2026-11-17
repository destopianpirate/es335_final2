// Single-page router: Home, Report, Data Studio, Live Predictor.

const VIEW_TITLES = {
  'home': 'Home',
  'report': 'Report',
  'data-studio': 'Data Studio',
  'model-predictor': 'Live Predictor',
};
const VIEW_ALIASES = { 'overview': 'report' };  // old links

const initialised = {};

// A hash is either a page name (#report) or the id of any element on a page (#ovn-strict);
// for an element, open the page that contains it and scroll there.
function parseRoute() {
  const hash = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
  if (!hash) return { view: 'home', anchor: null };
  if (VIEW_TITLES[hash]) return { view: hash, anchor: null };
  if (VIEW_ALIASES[hash]) return { view: VIEW_ALIASES[hash], anchor: null };
  const panel = document.getElementById(hash)?.closest('.view-panel');
  if (panel) return { view: panel.id.replace(/^view-/, ''), anchor: hash };
  return { view: 'home', anchor: null };
}

function initView(view) {
  if (initialised[view]) return;
  initialised[view] = true;
  try {
    if (view === 'home' && window.initHome) window.initHome();
    if (view === 'report' && window.initReport) window.initReport();
    if (view === 'data-studio' && window.initDataStudio) window.initDataStudio();
  } catch (err) {
    console.warn(`Rendering error in ${view}:`, err);
  }
}

// The browser would otherwise restore the previous scroll position after the page renders
// (so the homepage can open halfway down). We control the first scroll ourselves.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let firstRoute = true;
let currentView = null;
let userScrolled = false;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => window.addEventListener(ev, () => { userScrolled = true; }, { passive: true }));

function switchView(view, anchor = null) {
  const isPredictor = view === 'model-predictor';
  document.getElementById('app-footer')?.classList.toggle('hidden', isPredictor);
  document.body.classList.toggle('predictor-viewport-locked', isPredictor);

  document.querySelectorAll('.view-panel').forEach(p => p.classList.toggle('hidden', p.id !== `view-${view}`));

  const title = document.getElementById('header-view-title');
  if (title) title.innerHTML = VIEW_TITLES[view];

  const changedView = view !== currentView;
  currentView = view;
  updateSidebarState(view);
  // Defer one frame so the panel is visible and canvases get real sizes
  requestAnimationFrame(() => {
    initView(view);
    if (isPredictor && typeof showInputScreen === 'function') showInputScreen();
  });

  // jump (not glide) when arriving from another page; glide within the same page
  const behavior = firstRoute || changedView ? 'auto' : 'smooth';
  const go = () => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior, block: 'start' });
    else window.scrollTo({ top: 0, behavior });
  };
  if (anchor) setTimeout(go, changedView ? 160 : 80); else go();

  if (firstRoute) {
    // Charts and fonts change the page height while it loads: settle once more, unless the reader already moved.
    const settle = () => { if (!userScrolled) { userScrolled = false; go(); } };
    window.addEventListener('load', () => { settle(); setTimeout(settle, 400); }, { once: true });
    firstRoute = false;
  }
}

function updateSidebarState(view) {
  const rows = {
    'home': document.getElementById('row-home'),
    'report': document.getElementById('row-report'),
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

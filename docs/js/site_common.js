// Shared helpers for the Overview and Data Studio pages.
// All numbers come from window.SITE_DATA (js/generated/site_data.js, written by notebooks/07_website_export.ipynb).

const SITE = window.SITE_DATA || {};

// Chart axes and tooltips use international digit grouping (946,686), whatever the visitor's locale.
if (window.Chart) Chart.defaults.locale = 'en-US';

function sdGet(path, root = SITE) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), root);
}

function sdFormat(v, fmt) {
  if (v === undefined || v === null || Number.isNaN(v)) return '–';
  switch (fmt) {
    case 'int': return Math.round(v).toLocaleString('en-US');
    case 'pct0': return (v * 100).toFixed(0) + '%';
    case 'pct1': return (v * 100).toFixed(1) + '%';
    case 'pct2': return (v * 100).toFixed(2) + '%';
    case 'raw1': return Number(v).toFixed(1);
    case 'f2': return Number(v).toFixed(2);
    case 'f3': return Number(v).toFixed(3);
    case 'f4': return Number(v).toFixed(4);
    case 'signed4': return (v >= 0 ? '+' : '') + Number(v).toFixed(4);
    default: return String(v);
  }
}

// <span data-sd="champion.ci.pr_auc.low" data-fmt="f4"></span>
function fillSiteData(root = document) {
  root.querySelectorAll('[data-sd]').forEach(el => {
    el.textContent = sdFormat(sdGet(el.dataset.sd), el.dataset.fmt);
  });
}

function isDarkTheme() {
  return document.documentElement.classList.contains('dark');
}

function chartTheme() {
  const dark = isDarkTheme();
  return {
    grid: dark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
    tick: dark ? '#A1A1AA' : '#64748B',
    legend: dark ? '#E4E4E7' : '#334155',
    text: dark ? '#F8FAFC' : '#121212',
  };
}

// Consistent colours: one per model / group, reused across charts
const MODEL_COLORS = {
  'Rule: auto-renew off': '#94A3B8',
  'Logistic regression': '#B45309',
  'Random forest': '#7C3AED',
  'LightGBM (default)': '#0EA5E9',
  'LightGBM (tuned)': '#1D4ED8',
};
const GROUP_COLORS = { billing: '#1D4ED8', listening: '#15803D', demographic: '#B45309' };

const chartRegistry = {};
function makeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;
  if (chartRegistry[canvasId]) chartRegistry[canvasId].destroy();
  const t = chartTheme();
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 200,
    animation: { duration: 250 },
    plugins: {
      legend: { labels: { color: t.legend, boxWidth: 10, font: { size: 11 } } },
      tooltip: { backgroundColor: isDarkTheme() ? '#1E1E1E' : '#FFFFFF', titleColor: t.text, bodyColor: t.tick,
        borderColor: isDarkTheme() ? '#2A2A2A' : '#E2E8F0', borderWidth: 1 },
    },
  };
  config.options = deepMerge(base, config.options || {});
  Object.values(config.options.scales || {}).forEach(s => {
    s.grid = Object.assign({ color: t.grid }, s.grid || {});
    s.ticks = Object.assign({ color: t.tick, font: { size: 10 } }, s.ticks || {});
    if (s.title) s.title = Object.assign({ color: t.tick, display: true, font: { size: 11 } }, s.title);
  });
  chartRegistry[canvasId] = new Chart(canvas, config);
  return chartRegistry[canvasId];
}

function deepMerge(a, b) {
  const out = Array.isArray(a) ? [...a] : { ...a };
  Object.entries(b).forEach(([k, v]) => {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  });
  return out;
}

// Plain-language names for features (used in tables and charts)
const FEATURE_NAMES = {
  city: 'City', registered_via: 'Registration channel', gender: 'Gender', age: 'Age', tenure_days: 'Account age (days)',
  has_member: 'Has member profile', has_tx: 'Has transactions', tx_count: 'Number of transactions', total_paid: 'Total paid',
  avg_plan_days: 'Average plan length', auto_renew_ratio: 'Share of auto-renew payments', cancel_count: 'Cancellations',
  discount_count: 'Discounted payments', n_payment_methods: 'Payment methods used', last_payment_method: 'Last payment method',
  last_plan_days: 'Last plan length', last_amount_paid: 'Last amount paid', last_auto_renew: 'Last auto-renew flag',
  last_is_cancel: 'Last transaction is a cancel', days_since_last_tx: 'Days since last transaction',
  days_until_expiration: 'Days until plan expiry', has_logs: 'Has March listening', active_days: 'Active days (March)',
  total_hours: 'Listening hours (March)', secs_per_day: 'Seconds per active day', songs_per_day: 'Songs per active day',
  unique_song_ratio: 'Unique-song ratio', skip_ratio: 'Skip ratio', complete_ratio: 'Completion ratio',
  last7_share: 'Share of listening in last 7 days', active_days_7d: 'Active days (last 7)',
  days_since_last_active: 'Days since last listen', daily_secs_cv: 'Day-to-day variability',
};
const featureName = f => FEATURE_NAMES[f] || f;

function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

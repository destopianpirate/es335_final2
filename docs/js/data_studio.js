// Data Studio: five tables, data quality, churn signal explorer, split.

const TABLE_INFO = [
  { file: 'train_data.csv', ncol: 2, rows: 'train.subscribers', one: 'a labelled subscriber', cols: 'msno, is_churn', cov: null },
  { file: 'kaggle_test_data.csv', ncol: 1, rows: 'kaggle_test.subscribers', one: 'an unlabelled subscriber (Kaggle test)', cols: 'msno', cov: null },
  { file: 'members.csv', ncol: 6, rows: 'members.rows', one: 'a member profile', cols: 'city, bd (age), gender, registered_via, registration date', cov: 'members.train_coverage_pct' },
  { file: 'transactions.csv', ncol: 9, rows: 'transactions.rows', one: 'a payment or plan change (2015-01 to 2017-03)', cols: 'payment method, plan days, price paid, auto-renew, cancel, expiry date', cov: 'transactions.train_coverage_pct' },
  { file: 'user_logs.csv', ncol: 9, rows: 'user_logs.rows', one: 'a subscriber-day of listening (March 2017)', cols: 'songs played to 25/50/75/98.5/100 %, unique songs, seconds', cov: 'user_logs.train_coverage_pct' },
];

// Explorer variables: label groups and a short note written from the notebook 02 output
const SIGNALS = [
  { key: 'last_auto_renew', title: 'Auto-renew on the last transaction', source: 'transactions.csv',
    labels: { '0.0': 'off (manual)', '1.0': 'on' },
    note: 'Manual renewers churn about eight times as often as auto-renewers. This single flag is the "rule" baseline.' },
  { key: 'last_is_cancel', title: 'Last transaction is a cancellation', source: 'transactions.csv',
    labels: { '0.0': 'no', '1.0': 'yes' },
    note: 'A logged cancellation is close to a certain churn. It is rare, so it explains only part of all churn.' },
  { key: 'days_until_expiration', title: 'Days from cutoff to plan expiry', source: 'transactions.csv',
    note: 'Plans that already expired, or that run much longer than a normal month, almost always end in churn. Regular monthly renewals expiring in April rarely do.' },
  { key: 'last_plan_days', title: 'Length of the last plan (days)', source: 'transactions.csv',
    note: 'Nearly everyone is on a 30-day plan with low churn; the unusual plan lengths are small groups with very high churn.' },
  { key: 'has_tx', title: 'Has any transaction', source: 'transactions.csv',
    labels: { '0.0': 'no transactions', '1.0': 'has transactions' },
    note: 'Subscribers missing from the transactions table churn at a very high rate: the absence itself is a signal, so we keep them and flag it.' },
  { key: 'days_since_last_active', title: 'Days since last listen (before cutoff)', source: 'user_logs.csv',
    note: 'The churn rate rises steadily with the length of the silent streak (about five times higher after 15+ silent days). Subscribers with no March logs at all sit near the average.' },
  { key: 'active_days', title: 'Active listening days in March', source: 'user_logs.csv',
    note: 'More active days means slightly less churn, but the effect is mild compared with billing.' },
  { key: 'last7_share', title: 'Share of March listening in the last 7 days', source: 'user_logs.csv',
    note: 'About 0.23 means a steady pace. Subscribers whose listening dried up in the final week (share 0) churn more.' },
  { key: 'has_logs', title: 'Has March listening logs', source: 'user_logs.csv',
    labels: { '0.0': 'no logs', '1.0': 'has logs' },
    note: 'Having logs or not barely changes the churn rate on its own.' },
  { key: 'age', title: 'Age (valid 10-90 only)', source: 'members.csv',
    note: 'Younger subscribers churn more. Remember that age is missing for about 60 % of subscribers.' },
  { key: 'gender', title: 'Gender', source: 'members.csv',
    labels: { '0.0': 'not given', '1.0': 'female', '2.0': 'male' },
    note: 'Subscribers who did not fill in gender churn less, probably because they registered through channels that skip the form.' },
  { key: 'tenure_days', title: 'Account age', source: 'members.csv',
    note: 'Account age changes the churn rate very little.' },
];

// Column-level schema of the five raw CSVs (dtype = what pandas infers with pd.read_csv)
const RAW_SCHEMA = [
  { file: 'train_data.csv', cols: [
    ['msno', 'object (string)', 'Anonymised subscriber ID (hash); join key for all tables'],
    ['is_churn', 'int64', 'Target: 1 = did not renew within 30 days of expiry, 0 = renewed'] ] },
  { file: 'kaggle_test_data.csv', cols: [
    ['msno', 'object (string)', 'Anonymised subscriber ID of a Kaggle test subscriber (no label)'] ] },
  { file: 'members.csv', cols: [
    ['msno', 'object (string)', 'Subscriber ID'],
    ['city', 'int64', 'City code (categorical, anonymised)'],
    ['bd', 'int64', 'Age as entered; has outliers (0, negative, over 100)'],
    ['gender', 'object (string)', 'male / female, often missing'],
    ['registered_via', 'int64', 'Registration channel code (categorical)'],
    ['registration_init_time', 'int64', 'Registration date as YYYYMMDD'] ] },
  { file: 'transactions.csv', cols: [
    ['msno', 'object (string)', 'Subscriber ID'],
    ['payment_method_id', 'int64', 'Payment method code (categorical)'],
    ['payment_plan_days', 'int64', 'Length of the plan bought, in days'],
    ['plan_list_price', 'int64', 'List price of the plan (NTD)'],
    ['actual_amount_paid', 'int64', 'Amount actually paid (NTD)'],
    ['is_auto_renew', 'int64', '1 = plan renews automatically'],
    ['transaction_date', 'int64', 'Transaction date as YYYYMMDD'],
    ['membership_expire_date', 'int64', 'Membership expiry date as YYYYMMDD'],
    ['is_cancel', 'int64', '1 = this transaction is a cancellation'] ] },
  { file: 'user_logs.csv', cols: [
    ['msno', 'object (string)', 'Subscriber ID'],
    ['date', 'int64', 'Day of listening as YYYYMMDD'],
    ['num_25', 'int64', 'Songs played less than 25 % of their length'],
    ['num_50', 'int64', 'Songs played 25-50 %'],
    ['num_75', 'int64', 'Songs played 50-75 %'],
    ['num_985', 'int64', 'Songs played 75-98.5 %'],
    ['num_100', 'int64', 'Songs played over 98.5 % (completed)'],
    ['num_unq', 'int64', 'Unique songs played that day'],
    ['total_secs', 'float64', 'Total seconds listened that day'] ] },
];

// Engineered feature matrix (data/processed/features_train.parquet), one row per subscriber
const FEATURE_SCHEMA = [
  ['msno', 'object (string)', 'ID', 'Subscriber ID (key, not a model input)'],
  ['is_churn', 'int64', 'Target', 'Label to predict (not a model input)'],
  ['city', 'float32', 'Demographic', 'City code (categorical)'],
  ['registered_via', 'float32', 'Demographic', 'Registration channel (categorical)'],
  ['gender', 'float32', 'Demographic', '0 = not given, 1 = female, 2 = male'],
  ['age', 'float32', 'Demographic', 'Age from bd, kept only if 10-90, else missing'],
  ['tenure_days', 'float32', 'Demographic', 'Days from registration to the 2017-03-31 cutoff'],
  ['has_member', 'float32', 'Demographic', '1 = subscriber appears in members.csv'],
  ['has_tx', 'float32', 'Billing', '1 = subscriber has any transaction'],
  ['tx_count', 'float32', 'Billing', 'Number of transactions'],
  ['total_paid', 'float32', 'Billing', 'Sum of actual_amount_paid'],
  ['avg_plan_days', 'float32', 'Billing', 'Mean plan length (days)'],
  ['auto_renew_ratio', 'float32', 'Billing', 'Share of transactions with auto-renew on'],
  ['cancel_count', 'float32', 'Billing', 'Number of cancellation transactions'],
  ['discount_count', 'float32', 'Billing', 'Transactions where amount paid is below list price'],
  ['n_payment_methods', 'float32', 'Billing', 'Distinct payment methods used'],
  ['last_payment_method', 'float32', 'Billing', 'Payment method of the last transaction (categorical)'],
  ['last_plan_days', 'float32', 'Billing', 'Plan length of the last transaction'],
  ['last_amount_paid', 'float32', 'Billing', 'Amount paid in the last transaction'],
  ['last_auto_renew', 'float32', 'Billing', 'Auto-renew flag of the last transaction'],
  ['last_is_cancel', 'float32', 'Billing', '1 = last transaction is a cancellation'],
  ['days_since_last_tx', 'float32', 'Billing', 'Days from last transaction to cutoff'],
  ['days_until_expiration', 'float32', 'Billing', 'Days from cutoff to expiry (negative = already expired)'],
  ['has_logs', 'float32', 'Listening', '1 = subscriber has March 2017 logs'],
  ['active_days', 'float32', 'Listening', 'Days with any listening in March'],
  ['total_hours', 'float32', 'Listening', 'Total hours listened in March'],
  ['secs_per_day', 'float32', 'Listening', 'Seconds listened per active day'],
  ['songs_per_day', 'float32', 'Listening', 'Songs played per active day'],
  ['unique_song_ratio', 'float32', 'Listening', 'Unique songs / songs played'],
  ['skip_ratio', 'float32', 'Listening', 'Songs played under 25 % / songs played'],
  ['complete_ratio', 'float32', 'Listening', 'Songs played over 98.5 % / songs played'],
  ['last7_share', 'float32', 'Listening', 'Share of March seconds in the last 7 days'],
  ['active_days_7d', 'float32', 'Listening', 'Active days in the last 7 days of March'],
  ['days_since_last_active', 'float32', 'Listening', 'Days from last listening day to cutoff'],
  ['daily_secs_cv', 'float32', 'Listening', 'Coefficient of variation of daily seconds'],
];

function dsnSchemaTable(head, rows) {
  const cls = i => i === 0 ? 'font-mono font-semibold text-text-primary whitespace-nowrap'
    : i === 1 ? 'font-mono text-text-secondary whitespace-nowrap' : 'text-text-muted';
  return `<table class="w-full text-xs"><thead class="bg-surface-subtle text-text-muted uppercase tracking-wider text-[10px]"><tr>${head.map(h => `<th class="text-left px-4 py-2">${h}</th>`).join('')}</tr></thead>
    <tbody class="divide-y divide-border-subtle">${rows.map(r => `<tr>${r.map((c, i) => `<td class="px-4 py-2 ${cls(i)}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function dsnRenderSchema() {
  const raw = document.getElementById('dsn-raw-schema');
  if (raw) {
    const info = f => (TABLE_INFO.find(t => t.file === f) || {}).one || '';
    const show = file => {
      const t = RAW_SCHEMA.find(x => x.file === file) || RAW_SCHEMA[0];
      raw.querySelectorAll('.fs-item').forEach(b => {
        const on = b.dataset.file === t.file;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on);
      });
      const pane = raw.querySelector('.fs-pane');
      pane.innerHTML = `<div class="fs-pane-head"><span class="font-mono font-bold text-text-primary">${t.file}</span>
          <span class="text-text-muted">${t.cols.length} column${t.cols.length > 1 ? 's' : ''} &middot; one row is ${info(t.file)}</span></div>
        <div class="overflow-x-auto">${dsnSchemaTable(['Column', 'Data type', 'What it represents'], t.cols)}</div>`;
      pane.classList.remove('fs-in'); void pane.offsetWidth; pane.classList.add('fs-in');
    };
    raw.className = 'fs';
    // one icon per kind of file: labels, unlabelled IDs, profiles, payments, listening
    const ICON = { 'train_data.csv': 'label', 'kaggle_test_data.csv': 'label_off', 'members.csv': 'person',
                   'transactions.csv': 'payments', 'user_logs.csv': 'headphones' };
    const rowsOf = f => { const ti = TABLE_INFO.find(t => t.file === f); const v = ti ? sdGet('data.' + ti.rows) : null; return typeof v === 'number' ? sdFormat(v, 'int') + ' rows' : ''; };
    raw.innerHTML = `<div class="fs-list" role="tablist" aria-label="Raw files">${RAW_SCHEMA.map(t => `
      <button type="button" role="tab" class="fs-item" data-file="${t.file}">
        <span class="fs-ic material-symbols-outlined" aria-hidden="true">${ICON[t.file] || 'description'}</span>
        <span class="fs-text">
          <span class="fs-name">${t.file}</span>
          <span class="fs-sub">${rowsOf(t.file)}</span>
        </span>
        <span class="fs-count"><b>${t.cols.length}</b>col${t.cols.length > 1 ? 's' : ''}</span>
      </button>`).join('')}</div><div class="fs-pane" role="tabpanel"></div>`;
    raw.querySelector('.fs-list').addEventListener('click', e => { const b = e.target.closest('.fs-item'); if (b) show(b.dataset.file); });
    show(RAW_SCHEMA[0].file);
  }
  const feat = document.getElementById('dsn-feature-schema');
  if (feat) feat.innerHTML = dsnSchemaTable(['Column', 'Data type', 'Group', 'What it represents'], FEATURE_SCHEMA);
}

function dsnRenderTables() {
  const tbody = document.getElementById('dsn-table-rows');
  if (!tbody) return;
  tbody.innerHTML = TABLE_INFO.map(t => `
    <tr>
      <td class="px-4 py-3 font-mono font-semibold text-text-primary whitespace-nowrap">${t.file}</td>
      <td class="px-4 py-3 text-right font-mono">${sdFormat(sdGet('data.' + t.rows), 'int')}</td>
      <td class="px-4 py-3 text-right font-mono">${t.ncol}</td>
      <td class="px-4 py-3 text-text-secondary">${t.one}</td>
      <td class="px-4 py-3 text-text-muted">${t.cols}</td>
      <td class="px-4 py-3 text-right font-mono">${t.cov ? sdFormat(sdGet('data.' + t.cov), 'raw1') + '%' : '–'}</td>
    </tr>`).join('');
}

function breakdownGroup(key, group) {
  return (sdGet('eda.breakdowns.' + key) || []).find(g => g.group === group);
}

function fillBreakdownSpans() {
  document.querySelectorAll('[data-ds-break]').forEach(el => {
    const [key, group] = el.dataset.dsBreak.split('|');
    const g = breakdownGroup(key, group);
    el.textContent = g ? sdFormat(g.churn_rate, 'pct1') : '–';
  });
  document.querySelectorAll('[data-ds-share]').forEach(el => {
    const [key, group] = el.dataset.dsShare.split('|');
    const all = sdGet('eda.breakdowns.' + key) || [];
    const total = all.reduce((s, g) => s + g.n, 0);
    const g = breakdownGroup(key, group);
    el.textContent = g && total ? sdFormat(g.n / total, 'pct1') : '–';
  });
}

function dsnRenderMissing() {
  const miss = sdGet('eda.missing_pct') || {};
  const entries = Object.entries(miss).sort((a, b) => b[1] - a[1]);
  makeChart('dsn-missing-chart', {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => featureName(k)),
      datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map(([k]) =>
        ['city', 'registered_via', 'gender', 'age', 'tenure_days'].includes(k) ? GROUP_COLORS.demographic : GROUP_COLORS.billing),
        borderRadius: 3 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.toFixed(2)} % missing` } } },
      scales: { x: { title: { text: '% of labelled subscribers' }, max: 70 }, y: { grid: { display: false } } },
    },
  });
}

let currentSignal = SIGNALS[0].key;
function dsnRenderSignal(key) {
  currentSignal = key;
  const cfg = SIGNALS.find(s => s.key === key);
  const rows = sdGet('eda.breakdowns.' + key) || [];
  const overall = sdGet('eda.churn_rate');
  SegTabs.select('dsn-signal-buttons', key, true);
  document.getElementById('dsn-signal-title').textContent = cfg.title;
  document.getElementById('dsn-signal-source').textContent = cfg.source;
  document.getElementById('dsn-signal-note').textContent = cfg.note;
  const rates = rows.map(r => r.churn_rate);
  document.getElementById('dsn-signal-range').textContent =
    `Lowest group ${sdFormat(Math.min(...rates), 'pct1')}, highest ${sdFormat(Math.max(...rates), 'pct1')}, overall ${sdFormat(overall, 'pct1')}.`;

  const labels = rows.map(r => (cfg.labels && cfg.labels[r.group]) || r.group);
  makeChart('dsn-signal-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'line', label: 'overall', data: labels.map(() => overall * 100), borderColor: '#B91C1C', borderDash: [5, 4],
          borderWidth: 1.5, pointRadius: 0, order: 0 },
        { label: 'churn rate', data: rates.map(r => r * 100), backgroundColor: rates.map(r => r > overall ? '#B91C1C' : '#334155'),
          borderRadius: 4, order: 1 },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.datasetIndex === 1 ? `${c.raw.toFixed(1)} % churn  (n = ${rows[c.dataIndex].n.toLocaleString('en-US')})` : `overall ${c.raw.toFixed(1)} %` } },
      },
      scales: { y: { beginAtZero: true, max: 100, title: { text: 'churn rate (%)' } }, x: { grid: { display: false } } },
    },
  });
}

function dsnRenderSignalButtons() {
  SegTabs.mount('dsn-signal-buttons', {
    items: SIGNALS.map(x => ({ key: x.key, label: featureName(x.key) })),
    active: currentSignal, size: 'sm', label: 'Variable', onSelect: dsnRenderSignal, arrows: { canvas: 'dsn-signal-chart' },
  });
}

function dsnRenderSplit() {
  const tbody = document.getElementById('dsn-split-rows');
  const split = sdGet('eda.split') || {};
  const total = Object.values(split).reduce((s, v) => s + v.rows, 0);
  tbody.innerHTML = ['train', 'val', 'test'].map(k => `
    <tr><td class="px-4 py-3 font-sans font-semibold text-text-primary">${{ train: 'Train', val: 'Validation', test: 'Test' }[k]}</td>
      <td class="px-4 py-3 text-right">${sdFormat(split[k].rows / total, 'pct0')}</td>
      <td class="px-4 py-3 text-right">${sdFormat(split[k].rows, 'int')}</td>
      <td class="px-4 py-3 text-right">${sdFormat(split[k].churn_rate, 'pct2')}</td></tr>`).join('');
}

// ---------- raw data distributions ----------
const binLabels = h => h.values.map((_, i) => `${+h.edges[i].toFixed(1)}`);
const RAW_TABS = {
  Members: [
    { key: 'age', title: 'Age (valid 10-90 only)', note: 'Ages outside 10-90 are excluded here; see the next chart.', hist: true },
    { key: 'age_checks', title: 'Age data quality', note: 'Most profiles have age 0, i.e. the form field was skipped.', obj: true, color: '#B45309' },
    { key: 'gender', title: 'Gender', note: 'Blank for most members; kept as its own category.' },
    { key: 'reg_year', title: 'Registrations per year', note: 'Account creation year; used to compute account age.', line: true },
  ],
  Transactions: [
    { key: 'plan_days', title: 'Plan length (days), top 8', note: 'Almost every transaction is a 30-day plan (log scale).', log: true },
    { key: 'payment_method', title: 'Payment method, top 12', note: 'Method IDs are codes, treated as categories by the models.' },
    { key: 'tx_per_user', title: 'Transactions per subscriber', note: '10 = ten or more. Most subscribers have few rows in this period.' },
    { key: 'amount_paid', title: 'Amount paid (NTD)', note: 'Clipped at 2000; log scale. Peaks at the standard plan prices.', hist: true, log: true },
  ],
  Listening: [
    { key: 'log_rows_per_day', title: 'Log rows per day of March 2017', note: 'Steady coverage over the month.' },
    { key: 'daily_hours', title: 'Listening hours per subscriber-day', note: 'Log scale; a few rows exceed 24 h and are clipped.', hist: true, log: true },
    { key: 'daily_songs', title: 'Songs per subscriber-day', note: '200 = 200 or more; log scale.', hist: true, log: true },
    { key: 'play_depth', title: 'How far songs were played', note: 'Most plays reach the end; early skips are the second-largest group.', color: '#15803D' },
  ],
};

function dsnRenderRawChart(i, cfg) {
  const raw = SITE.raw || {};
  const d = raw[cfg.key];
  setText(`dsn-raw-t${i}`, cfg.title);
  setText(`dsn-raw-n${i}`, cfg.note);
  if (!d) return;
  let labels, values;
  if (cfg.obj) { labels = Object.keys(d); values = Object.values(d); }
  else if (cfg.hist) { labels = binLabels(d); values = d.values; }
  else { labels = d.labels; values = d.values; }
  makeChart(`dsn-raw-c${i}`, {
    type: cfg.line ? 'line' : 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: cfg.color || '#334155', borderColor: '#1D4ED8', borderRadius: 2,
      barPercentage: cfg.hist ? 1 : 0.8, categoryPercentage: cfg.hist ? 1 : 0.8, pointRadius: 2 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => Number(c.raw).toLocaleString('en-US') } } },
      scales: { y: { type: cfg.log ? 'logarithmic' : 'linear', beginAtZero: !cfg.log }, x: { grid: { display: false }, ticks: { maxTicksLimit: 14 } } } },
  });
}

function dsnRenderCoverage() {
  const cov = (SITE.raw || {}).coverage || [];
  const labels = cov.map(r => `${r.profile ? 'P' : '-'}${r.transactions ? 'T' : '-'}${r.logs ? 'L' : '-'}`);
  setText('dsn-raw-t3', 'Churn rate by table presence');
  setText('dsn-raw-n3', 'P = has profile, T = has transactions, L = has March logs. Missing transactions means very high churn.');
  makeChart('dsn-raw-c3', {
    type: 'bar',
    data: { labels, datasets: [{ data: cov.map(r => r.churn_rate * 100), backgroundColor: '#B91C1C', borderRadius: 3 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.toFixed(1)} % churn (n = ${cov[c.dataIndex].n.toLocaleString('en-US')})` } } },
      scales: { y: { beginAtZero: true, max: 100, title: { text: 'churn rate (%)' } }, x: { grid: { display: false } } } },
  });
  setText('dsn-raw-t2', 'Labelled subscribers by table presence');
  setText('dsn-raw-n2', 'How many subscribers appear in each combination of tables.');
  makeChart('dsn-raw-c2', {
    type: 'bar',
    data: { labels, datasets: [{ data: cov.map(r => r.n), backgroundColor: '#334155', borderRadius: 3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { type: 'logarithmic' }, x: { grid: { display: false } } } },
  });
}

let currentRawTab = 'Members';
function dsnRenderRaw(tab) {
  currentRawTab = tab;
  SegTabs.select('dsn-raw-tabs', tab, true);
  if (tab === 'Coverage') {
    dsnRenderRawChart(0, RAW_TABS.Members[1]);
    dsnRenderRawChart(1, { key: 'tx_checks', title: 'Transaction data checks', note: 'Counts of unusual rows; free and discounted payments are kept as information.', obj: true, color: '#B45309', log: true });
    dsnRenderCoverage();
    return;
  }
  RAW_TABS[tab].forEach((cfg, i) => dsnRenderRawChart(i, cfg));
}

const SEG_ICONS = { Members: 'group', Transactions: 'receipt_long', Listening: 'headphones', Coverage: 'fact_check' };

function dsnRenderRawTabs() {
  SegTabs.mount('dsn-raw-tabs', {
    items: [...Object.keys(RAW_TABS), 'Coverage'].map(t => ({ key: t, label: t === 'Coverage' ? 'Coverage &amp; checks' : t, icon: SEG_ICONS[t] || 'table' })),
    active: currentRawTab, scroll: true, fade: true, label: 'Raw table', onSelect: dsnRenderRaw,
    arrows: { host: () => document.getElementById('dsn-raw-tabs').nextElementSibling },
  });
}

// ---------- feature analysis ----------
function dsnRenderSingleAuc() {
  const rows = (SITE.eda || {}).single_auc || [];
  makeChart('dsn-auc-chart', {
    type: 'bar',
    data: { labels: rows.map(r => featureName(r.feature)), datasets: [{ data: rows.map(r => r.auc), backgroundColor: rows.map(r => GROUP_COLORS[r.group]), borderRadius: 2 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `ROC-AUC ${c.raw.toFixed(3)} (${rows[c.dataIndex].direction})` } } },
      scales: { x: { min: 0.5, max: 1, title: { text: 'ROC-AUC of the feature alone' } }, y: { grid: { display: false }, ticks: { font: { size: 9 } } } } },
  });
}

function dsnRenderHist(feature) {
  const h = ((SITE.eda || {}).feature_hists || {})[feature];
  if (!h) return;
  const labels = h.renewed.map((_, i) => +((h.edges[i] + h.edges[i + 1]) / 2).toFixed(2));
  makeChart('dsn-hist-chart', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'renewed', data: h.renewed.map(v => v * 100), backgroundColor: 'rgba(51,65,85,0.6)', barPercentage: 1, categoryPercentage: 1 },
      { label: 'churned', data: h.churned.map(v => v * 100), backgroundColor: 'rgba(185,28,28,0.6)', barPercentage: 1, categoryPercentage: 1 },
    ] },
    options: { plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.toFixed(1)} % of class` } } },
      scales: { x: { stacked: false, title: { text: featureName(feature) }, ticks: { maxTicksLimit: 10 } }, y: { title: { text: '% of class' } } } },
  });
}

function dsnRenderHistSelect() {
  const sel = document.getElementById('dsn-hist-select');
  const feats = Object.keys((SITE.eda || {}).feature_hists || {});
  if (!sel || !feats.length) return;
  sel.innerHTML = feats.map(f => `<option value="${f}">${featureName(f)}</option>`).join('');
  sel.addEventListener('change', () => dsnRenderHist(sel.value));
  dsnRenderHist(feats[0]);
}

function dsnRenderCorr() {
  const c = (SITE.eda || {}).corr;
  const el = document.getElementById('dsn-corr');
  if (!c || !el) return;
  const color = v => v >= 0 ? `rgba(29,78,216,${Math.abs(v)})` : `rgba(185,28,28,${Math.abs(v)})`;
  const head = `<div class="flex"><div class="w-44 shrink-0"></div>${c.features.map(f => `<div class="w-5 shrink-0 h-32 relative"><span class="absolute bottom-0 left-2 origin-bottom-left -rotate-90 whitespace-nowrap text-[9px] text-text-muted">${featureName(f)}</span></div>`).join('')}</div>`;
  const rows = c.matrix.map((r, i) => `<div class="flex items-center"><div class="w-44 shrink-0 text-[9px] text-text-muted truncate pr-2 text-right">${featureName(c.features[i])}</div>${r.map((v, j) => `<div class="w-5 h-5 shrink-0 border border-page-bg" style="background:${color(v)}" title="${featureName(c.features[i])} vs ${featureName(c.features[j])}: ${v.toFixed(2)}"></div>`).join('')}</div>`).join('');
  el.innerHTML = head + rows;
}

// ---------- data for training ----------
const SUMMARY_COLS = [['feature', 'Feature'], ['missing_pct', 'Missing %'], ['unique', 'Unique'], ['zero_pct', 'Zero %'], ['mean', 'Mean'], ['std', 'Std'],
  ['min', 'Min'], ['1%', 'P1'], ['50%', 'Median'], ['99%', 'P99'], ['max', 'Max'], ['skew', 'Skew']];
let summarySort = { key: null, dir: 1 };
function dsnRenderSummary() {
  const rows = [...((SITE.eda || {}).feature_summary || [])];
  if (summarySort.key) rows.sort((a, b) => (a[summarySort.key] > b[summarySort.key] ? 1 : -1) * summarySort.dir);
  const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : +v.toFixed(3)) : v;
  setText('dsn-summary-head', '<tr>' + SUMMARY_COLS.map(([k, n], i) => `<th class="${i ? 'text-right' : 'text-left'} px-3 py-2 cursor-pointer select-none" onclick="dsnSortSummary('${k}')">${n}${summarySort.key === k ? (summarySort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>');
  setText('dsn-summary-rows', rows.map(r => '<tr>' + SUMMARY_COLS.map(([k], i) => i ? `<td class="px-3 py-1.5 text-right ${k === 'missing_pct' && r[k] > 0 ? 'text-accent-warning' : k === 'skew' && Math.abs(r[k]) > 3 ? 'text-accent-danger' : 'text-text-secondary'}">${fmt(r[k])}</td>` : `<td class="px-3 py-1.5 font-sans text-text-primary whitespace-nowrap">${featureName(r.feature)}</td>`).join('') + '</tr>').join(''));
}
window.dsnSortSummary = k => { summarySort = { key: k, dir: summarySort.key === k ? -summarySort.dir : 1 }; dsnRenderSummary(); };

function dsnRenderDecile(feature) {
  const d = ((SITE.eda || {}).decile_curves || {})[feature];
  if (!d) return;
  const overall = sdGet('eda.churn_rate');
  const f = v => (Math.abs(v) >= 100 ? Math.round(v) : +v.toFixed(2));
  const lab = d.map(r => (r.lo === r.hi ? `${f(r.lo)}` : `${f(r.lo)} to ${f(r.hi)}`));
  setText('dsn-decile-note', `Training subscribers in up to 10 quantile bins of ${featureName(feature)} (tied values share a bin). Dashed line = overall churn rate.`);
  makeChart('dsn-decile-chart', {
    type: 'line',
    data: { labels: lab, datasets: [
      { label: 'churn rate', data: d.map(r => r.churn_rate * 100), borderColor: '#1D4ED8', backgroundColor: '#1D4ED8', pointRadius: 4, borderWidth: 2 },
      { label: 'overall', data: lab.map(() => overall * 100), borderColor: '#B91C1C', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 },
    ] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.datasetIndex ? `overall ${c.raw.toFixed(1)} %` : `${c.raw.toFixed(1)} % churn (n = ${d[c.dataIndex].n.toLocaleString('en-US')})` } } },
      scales: { y: { beginAtZero: true, title: { text: 'churn rate (%)' } }, x: { title: { text: featureName(feature) }, ticks: { font: { size: 9 } } } } },
  });
}

function dsnRenderDecileSelect() {
  const sel = document.getElementById('dsn-decile-select');
  const feats = Object.keys((SITE.eda || {}).decile_curves || {});
  if (!sel || !feats.length) return;
  sel.innerHTML = feats.map(f => `<option value="${f}">${featureName(f)}</option>`).join('');
  sel.value = feats.includes('days_since_last_active') ? 'days_since_last_active' : feats[0];
  sel.addEventListener('change', () => dsnRenderDecile(sel.value));
  dsnRenderDecile(sel.value);
}

function dsnRenderMissingChurn() {
  const groups = { city: 'No member profile (city, channel, gender, account age)', age: 'Age missing or invalid', avg_plan_days: 'No transactions (last-transaction fields)' };
  const rows = ((SITE.eda || {}).missing_churn || []);
  makeChart('dsn-missing-churn-chart', {
    type: 'bar',
    data: { labels: rows.map(r => groups[r.feature] || featureName(r.feature)), datasets: [
      { label: 'value missing', data: rows.map(r => r.churn_missing * 100), backgroundColor: '#B91C1C', borderRadius: 3 },
      { label: 'value present', data: rows.map(r => r.churn_present * 100), backgroundColor: '#334155', borderRadius: 3 },
    ] },
    options: { plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw.toFixed(1)} % churn (${rows[c.dataIndex].missing_pct.toFixed(1)} % missing)` } } },
      scales: { y: { beginAtZero: true, title: { text: 'churn rate (%)' } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } },
  });
}

function dsnRenderShift() {
  const rows = ((SITE.eda || {}).shift || []);
  const mx = Math.max(...rows.map(r => Math.max(r.val, r.test, r.kaggle_test)));
  setText('dsn-shift-note', `Each numeric feature compared with the training split. Largest value: ${mx.toFixed(4)}, far below the usual 0.1 warning level, so validation, test and the Kaggle test set come from the same distribution as training.`);
  makeChart('dsn-shift-chart', {
    type: 'bar',
    data: { labels: rows.map(r => featureName(r.feature)), datasets: [
      { label: 'validation', data: rows.map(r => r.val), backgroundColor: '#15803D' },
      { label: 'test split', data: rows.map(r => r.test), backgroundColor: '#1D4ED8' },
      { label: 'Kaggle test set', data: rows.map(r => r.kaggle_test), backgroundColor: '#B45309' },
    ] },
    options: { indexAxis: 'y', plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: PSI ${c.raw.toFixed(5)}` } } },
      scales: { x: { title: { text: 'PSI' } }, y: { grid: { display: false }, ticks: { font: { size: 9 } } } } },
  });
}

// ---------- churn by group + file overlap (data from js/generated/ds_extra.js) ----------
const GROUP_DIMS = [
  { key: 'payment_method', short: 'Payment method', note: 'One payment method (41) carries more than half of all subscribers and churns at only 3 %. Method 38 churns at about 23 %, and subscribers with no transaction at all churn at 79 %.' },
  { key: 'plan_days', short: 'Plan length', note: 'The 30-day plan is 94 % of subscribers and churns at 4 %. Every longer fixed plan (90, 180, 195, 360, 410 days) is a prepaid card that does not auto-renew, so almost all of those subscribers churn at expiry.' },
  { key: 'price', short: 'Price paid', note: 'Paying list price every time churns at 6 %. A discounted payment raises it to 23 %, and a last payment of zero (a free trial) to 82 %.' },
  { key: 'tx_count', short: 'Transactions', note: 'Most subscribers have 1 or 2 transactions. Churn peaks at 54 % for 3 to 5 transactions, then falls as the subscriber history grows (22 % at 21 or more).' },
  { key: 'n_methods', short: 'Payment methods used', note: 'Switching payment method is a warning sign: two methods already means 52 % churn against 6 % for subscribers who only ever used one.' },
  { key: 'daily_hours', short: 'Listening per day', note: 'Listening time barely separates churners from renewers. Only very short days (under 15 minutes) stand out a little, at about 12 %.' },
  { key: 'skip', short: 'Early skips', note: 'The share of songs skipped early moves the churn rate only between 8.7 % and 9.5 %. It is a weak signal on its own.' },
  { key: 'city', short: 'City', note: 'City 1 holds 46 % of subscribers and churns at 6 %. Most other large cities sit at 12 to 14 %.' },
  { key: 'registered_via', short: 'Registration channel', note: 'Channel 7 (48 % of subscribers) churns at 4.5 %. Channels 3 and 4 churn at 17 % and 23 %.' },
];
let currentGroup = GROUP_DIMS[0].key;

function dsnGroupLabel(label, source) {
  if (label !== 'missing (no record)') return label;
  return source === 'members.csv' ? 'no member profile' : 'no transactions';
}

function dsnRenderGroup(key) {
  const X = window.DS_EXTRA;
  if (!X) return;
  currentGroup = key;
  SegTabs.select('dsn-group-buttons', key, true);
  const cfg = GROUP_DIMS.find(d => d.key === key), dim = X.dims[key];
  const rows = dim.rows.map(r => ({ ...r, label: dsnGroupLabel(r.group, dim.source) }));
  document.getElementById('dsn-group-title').textContent = dim.title;
  document.getElementById('dsn-group-source').textContent = dim.source;
  document.getElementById('dsn-group-note').textContent = cfg.note;
  document.getElementById('dsn-group-chart-wrap').style.height = Math.max(240, 44 + rows.length * 30) + 'px';
  document.getElementById('dsn-group-rows').innerHTML = rows.map(r => `
    <tr><td class="px-3 py-1.5 text-text-primary">${r.label}</td>
      <td class="px-3 py-1.5 text-right">${sdFormat(r.n, 'int')}</td>
      <td class="px-3 py-1.5 text-right">${sdFormat(r.share, 'pct1')}</td>
      <td class="px-3 py-1.5 text-right font-bold ${r.churn_rate > X.overall ? 'text-accent-danger' : ''}">${sdFormat(r.churn_rate, 'pct1')}</td></tr>`).join('');
  makeChart('dsn-group-chart', {
    type: 'bar',
    data: { labels: rows.map(r => r.label), datasets: [
      { label: 'churn rate', data: rows.map(r => r.churn_rate * 100), borderRadius: 4,
        backgroundColor: rows.map(r => r.churn_rate > X.overall ? '#B91C1C' : '#334155') } ] },
    options: { indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw.toFixed(1)} % churn  (n = ${rows[c.dataIndex].n.toLocaleString('en-US')})` } } },
      scales: { x: { beginAtZero: true, max: 100, title: { text: `churn rate (%), overall ${(X.overall * 100).toFixed(1)} %` } }, y: { grid: { display: false } } } },
  });
}

function dsnRenderExplorer() {
  const X = window.DS_EXTRA;
  if (!X) return;
  const find = (a, c) => X.cross.find(r => r.auto_renew === a && r.cancel === c);
  const cards = [
    { r: find(1, 0), t: 'Auto-renew on, no cancellation', d: 'The healthy core: the last plan renews by itself.', c: 'text-text-primary' },
    { r: find(0, 0), t: 'Auto-renew off', d: 'Subscribers who must renew by hand drop off about 17 times as often.', c: 'text-accent-danger' },
    { r: find(1, 1), t: 'Cancellation logged', d: 'Auto-renew was on, but the last transaction is a cancellation.', c: 'text-accent-danger' },
  ];
  document.getElementById('dsn-cross-cards').innerHTML = cards.map(k => `
    <div class="p-5 rounded-2xl bg-surface-card border border-border-subtle">
      <span class="text-[11px] font-bold text-text-muted uppercase tracking-wider">${k.t}</span>
      <div class="text-2xl font-extrabold ${k.c} my-1 font-mono">${sdFormat(k.r.churn_rate, 'pct1')} <span class="text-xs font-bold text-text-muted">churn</span></div>
      <p class="text-[11px] text-text-muted">${sdFormat(k.r.n, 'int')} subscribers. ${k.d}</p>
    </div>`).join('');
  SegTabs.mount('dsn-group-buttons', {
    items: GROUP_DIMS.map(d => ({ key: d.key, label: d.short })),
    active: currentGroup, size: 'sm', label: 'Grouping', onSelect: dsnRenderGroup, arrows: { canvas: 'dsn-group-chart' },
  });
  dsnRenderGroup(currentGroup);
}

const OVERLAP_FILES = [['train', 'train_data'], ['test', 'kaggle_test'], ['members', 'members'], ['transactions', 'transactions'], ['user_logs', 'user_logs']];

function dsnRenderOverlap() {
  const X = window.DS_EXTRA, tbl = document.getElementById('dsn-overlap-table');
  if (!X || !tbl) return;
  const O = X.overlap, pair = (a, b) => O.pair[a + '|' + b] ?? O.pair[b + '|' + a];
  const cards = [
    ['Distinct subscribers', sdFormat(O.union, 'int'), 'in at least one of the five files'],
    ['Train and test overlap', sdFormat(O.pair['train|test'], 'int'), 'no subscriber is in both, so no leakage'],
    ['Train with all 3 tables', sdFormat(O.complete.train, 'int'), sdFormat(O.complete.train / O.size.train, 'pct1') + ' of train have members, billing and listening'],
    ['Test with all 3 tables', sdFormat(O.complete.test, 'int'), sdFormat(O.complete.test / O.size.test, 'pct1') + ' of the Kaggle test set'],
  ];
  document.getElementById('dsn-overlap-cards').innerHTML = cards.map(c => `
    <div class="p-5 rounded-2xl bg-surface-card border border-border-subtle">
      <span class="text-[11px] font-bold text-text-muted uppercase tracking-wider">${c[0]}</span>
      <div class="text-2xl font-extrabold text-text-primary my-1 font-mono">${c[1]}</div>
      <p class="text-[10px] text-text-muted">${c[2]}</p></div>`).join('');
  const head = '<thead class="bg-surface-subtle text-text-muted uppercase tracking-wider text-[10px]"><tr><th class="text-left px-4 py-3">&nbsp;</th>' +
    OVERLAP_FILES.map(f => `<th class="text-right px-4 py-3 whitespace-nowrap">${f[1]}</th>`).join('') + '</tr></thead>';
  const body = OVERLAP_FILES.map(([a, an]) => '<tr><td class="px-4 py-3 font-mono font-semibold text-text-primary whitespace-nowrap">' + an + '</td>' +
    OVERLAP_FILES.map(([b]) => {
      const v = a === b ? O.size[a] : pair(a, b), pct = v / O.size[a];
      const bg = a === b ? 'rgba(100,116,139,0.18)' : `rgba(51,65,85,${(0.04 + 0.34 * pct).toFixed(3)})`;
      return `<td class="px-4 py-3 text-right font-mono" style="background:${bg}"><div class="font-semibold text-text-primary">${sdFormat(v, 'int')}</div>` +
        (a === b ? '<div class="text-[10px] text-text-muted">in file</div>' : `<div class="text-[10px] text-text-muted">${sdFormat(pct, 'pct0')}</div>`) + '</td>';
    }).join('') + '</tr>').join('');
  tbl.innerHTML = head + '<tbody class="divide-y divide-border-subtle">' + body + '</tbody>';
  document.getElementById('dsn-overlap-note').innerHTML =
    '<strong class="text-text-primary">Reading it.</strong> A subscriber can only be scored well if the tables describe them: about ' +
    sdFormat(O.complete.train / O.size.train, 'pct0') + ' of training subscribers appear in all three feature tables, and the Kaggle test set has almost the same share (' +
    sdFormat(O.complete.test / O.size.test, 'pct0') + '), so the model sees the same mix of complete and incomplete records at test time as in training. Most of members.csv (' +
    sdFormat(O.size.members, 'int') + ' profiles) belongs to subscribers who are in neither the train nor the test file.';
}

window.initDataStudio = function () {
  if (!window.SITE_DATA) return;
  fillSiteData(document.getElementById('view-data-studio'));
  dsnRenderTables();
  dsnRenderSchema();
  dsnRenderRawTabs();
  dsnRenderRaw(currentRawTab);
  fillBreakdownSpans();
  dsnRenderMissing();
  dsnRenderSignalButtons();
  dsnRenderSignal(currentSignal);
  dsnRenderExplorer();
  dsnRenderOverlap();
  dsnRenderSingleAuc();
  dsnRenderHistSelect();
  dsnRenderCorr();
  dsnRenderSummary();
  dsnRenderDecileSelect();
  dsnRenderMissingChurn();
  dsnRenderShift();
  dsnRenderSplit();
};

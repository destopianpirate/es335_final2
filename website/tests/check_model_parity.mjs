// Checks that the in-browser LightGBM (js/sandbox_engine.js + js/generated/model_lgbm.js) reproduces the
// Python predictions saved by notebooks/07_website_export.ipynb.     Run:  node website/tests/check_model_parity.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['js/generated/model_lgbm.js', 'js/sandbox_engine.js']) {
  vm.runInContext(readFileSync(join(site, f), 'utf8'), ctx, { filename: f });
}
const w = ctx.window;
const fx = JSON.parse(readFileSync(join(here, 'parity_fixtures.json'), 'utf8'));

const maxDiff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

// 1. raw feature rows from the test split
const rowProbs = fx.rows.map(r => w.lgbmPredict(r.map(v => (v === null ? NaN : v))).prob);
const d1 = maxDiff(rowProbs, fx.row_probs);

// 2. predictor form payloads (form -> features mapping + model)
const formProbs = fx.forms.map(p => w.computeClientSidePrediction(p).churn_probability);
const d2 = maxDiff(formProbs, fx.form_probs);

// 3. contributions add up to the raw score
const o = w.lgbmPredict(fx.rows[0].map(v => (v === null ? NaN : v)));
const d3 = Math.abs(o.bias + o.contrib.reduce((s, c) => s + c, 0) - o.raw);

console.log(`test rows   : ${fx.rows.length} | max |p_js - p_py| = ${d1.toExponential(2)}`);
console.log(`form inputs : ${fx.forms.length} | max |p_js - p_py| = ${d2.toExponential(2)}`);
console.log(`contributions sum check: ${d3.toExponential(2)}`);
const ok = d1 < 1e-9 && d2 < 1e-9 && d3 < 1e-9;
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);

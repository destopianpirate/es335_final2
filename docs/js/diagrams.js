// Mermaid diagrams: every element with data-mermaid="<key>" gets the diagram below,
// drawn in the current light / dark theme and redrawn when the theme changes.
// A diagram is either a fixed string or a function that builds it from window.SITE_DATA,
// so the numbers in it always match the results files.

const dgF4 = v => (typeof v === 'number' ? v.toFixed(4) : '?');
const dgSgn = v => (typeof v === 'number' ? (v >= 0 ? '+' : '') + v.toFixed(4) : '?');

const DIAGRAMS = {
  // Home: the answer at a glance, the two cutoffs side by side
  'home-answer': () => {
    const S = window.SITE_DATA || {};
    const abl = n => ((S.ablation || []).find(a => a.set === n) || {}).pr_auc;
    const st = n => (((S.strict || {}).metrics || []).find(m => m.model === n) || {}).pr_auc;
    const base = ((S.test_metrics || []).find(m => m.model === 'Majority (prior)') || {}).pr_auc;
    const d = S.ablation_diff || {}, g = (S.strict || {}).listening_gain || {};
    return `flowchart LR
    Q["Question<br/>will a subscriber churn after<br/>a March 2017 plan expiry?<br/>no-skill PR-AUC ${dgF4(base)}"]
    Q --> A["Cutoff 31 March<br/>March billing visible,<br/>often shows the renewal"]
    Q --> B["Strict cutoff 1 March<br/>before any plan expires"]
    A --> A1["Billing + demographics<br/>PR-AUC ${dgF4(abl('Billing + demographics'))}"] --> A2["+ listening<br/>PR-AUC ${dgF4(abl('All features'))}<br/>gain ${dgSgn(d.mean)}"]
    B --> B1["Billing + demographics<br/>PR-AUC ${dgF4(st('Strict billing + demographics'))}"] --> B2["+ listening<br/>PR-AUC ${dgF4(st('Strict billing + demographics + listening'))}<br/>gain ${dgSgn(g.mean)}"]
    A2 --> CA["Easy to rank:<br/>billing already records<br/>the decision"]
    B2 --> CB["Early warning is harder,<br/>and listening adds<br/>real signal"]
    classDef key stroke-width:2px
    class A2,B2 key`;
  },

  // Report: the nine sections in reading order; each box links to its section
  'report-pipeline': `flowchart TB
    subgraph R1[" "]
      direction LR
      Q["Question<br/>churn within 30 days<br/>of a March 2017 expiry"] --> D["01 Data<br/>5 Kaggle tables<br/>946,686 subscribers"] --> P["02 Preprocessing<br/>1 row per subscriber<br/>33 features, cutoff 31 Mar"] --> M["03 Baseline and methods<br/>majority, auto-renew rule,<br/>logistic regression, RF, LightGBM"] --> E["04 Evaluation<br/>70 / 10 / 20 split, tuning<br/>and threshold on validation"]
    end
    subgraph R2[" "]
      direction LR
      RS["05 Results<br/>test scored once,<br/>bootstrap CIs, strict 1 Mar check"] --> ER["06 Errors<br/>segments, missed<br/>churners, examples"] --> L["07 Limitations<br/>label overlap, one month,<br/>association not cause"] --> C["08 Conclusion<br/>what billing and<br/>listening add"] --> RP["09 Reproduction<br/>notebooks 01 to 08"]
    end
    R1 --> R2
    classDef key stroke-width:2px
    class RS,C key
    style R1 fill:none,stroke:none
    style R2 fill:none,stroke:none`,

  'data-flow': `flowchart LR
    subgraph RAW["Raw Kaggle files"]
      direction TB
      L["train_data.csv<br/>labels is_churn"]
      M["members.csv<br/>city, age, gender, registration"]
      T["transactions.csv<br/>plans, payments, auto-renew, cancels"]
      U["user_logs.csv<br/>daily listening, March 2017"]
    end
    M --> AM["Clean profile<br/>invalid ages to missing"]
    T --> AT["Aggregate per subscriber<br/>15 billing features"]
    U --> AU["Aggregate per subscriber<br/>12 listening features<br/>daily secs clipped to 24 h"]
    L --> J
    AM --> J
    AT --> J
    AU --> J
    J["Left join on msno<br/>nobody dropped<br/>has_member / has_tx / has_logs"] --> FM["Feature matrix<br/>946,686 x 33"]
    FM --> TR["Train 70%<br/>fit"]
    FM --> VA["Validation 10%<br/>tuning, threshold"]
    FM --> TE["Test 20%<br/>scored once"]`,
};

// Boxes that jump to a page section when clicked (diagram key -> node id -> element id)
const DIAGRAM_LINKS = {
  'report-pipeline': { D: 'ovn-data', P: 'ovn-preprocessing', M: 'ovn-models', E: 'ovn-evaluation', RS: 'ovn-results',
                       ER: 'ovn-errors', L: 'ovn-limitations', C: 'ovn-conclusion', RP: 'ovn-repro' },
  'home-answer': { A2: 'ovn-results', B1: 'ovn-strict', B2: 'ovn-strict' },
};

(function () {
  if (!window.mermaid) return;
  let seq = 0;

  function themeVars(dark) {
    return dark
      ? { primaryColor: '#1E1E1E', primaryTextColor: '#F1F5F9', primaryBorderColor: '#52525B', lineColor: '#A1A1AA',
          clusterBkg: '#161616', clusterBorder: '#3F3F46', titleColor: '#E4E4E7', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' }
      : { primaryColor: '#FFFFFF', primaryTextColor: '#121212', primaryBorderColor: '#94A3B8', lineColor: '#64748B',
          clusterBkg: '#F8FAFC', clusterBorder: '#CBD5E1', titleColor: '#334155', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px' };
  }

  function addLinks(el, key) {
    const links = DIAGRAM_LINKS[key];
    if (!links) return;
    el.querySelectorAll('g.node').forEach(n => {
      const m = (n.id || '').match(/^flowchart-(.+)-\d+$/);
      const target = m && links[m[1]];
      if (!target) return;
      n.style.cursor = 'pointer';
      n.setAttribute('role', 'link');
      n.setAttribute('tabindex', '0');
      const go = () => { window.location.hash = target; };
      n.addEventListener('click', go);
      n.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      t.textContent = 'Go to this section';
      n.prepend(t);
    });
  }

  async function renderAll() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const dark = document.documentElement.classList.contains('dark');
    mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: themeVars(dark), securityLevel: 'strict',
                         flowchart: { htmlLabels: false, padding: 12, curve: 'basis', useMaxWidth: true } });
    for (const el of document.querySelectorAll('[data-mermaid]')) {
      const def = DIAGRAMS[el.dataset.mermaid];
      if (!def) continue;
      try {
        const { svg } = await mermaid.render('mmd-' + (++seq), typeof def === 'function' ? def() : def);
        el.innerHTML = svg;
        addLinks(el, el.dataset.mermaid);
      } catch (e) {
        el.textContent = 'Diagram could not be drawn.';
      }
    }
  }

  window.renderDiagrams = renderAll;
  const start = () => renderAll();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // redraw when the theme toggle flips the "dark" class on <html>
  let wasDark = document.documentElement.classList.contains('dark');
  new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark !== wasDark) { wasDark = isDark; renderAll(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
})();

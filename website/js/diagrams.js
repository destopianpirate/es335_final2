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
      W["01 Why<br/>act before<br/>plans run out"] --> D["02 Data<br/>5 Kaggle tables<br/>946,686 subscribers"] --> P["03 Preprocessing<br/>1 row per subscriber<br/>33 features, cutoff 31 Mar"] --> E["04 Evaluation<br/>70 / 10 / 20 split,<br/>PR-AUC, bootstrap"] --> M["05 Baseline and methods<br/>majority, rule, LR,<br/>RF, LightGBM"] --> LK["06 Leakage<br/>cutoff, March overlap,<br/>strict 1 Mar check"]
    end
    subgraph R2[" "]
      direction LR
      RS["07 Results<br/>test scored once"] --> ER["08 Errors<br/>segments, examples"] --> F["09 Failure modes<br/>4 groups"] --> RT["10 Runtime model<br/>LightGBM in the browser"] --> L["11 Limitations"]
    end
    subgraph R3[" "]
      direction LR
      C["12 Conclusion"] --> NX["13 What next"] --> RP["14 Reproduction<br/>notebooks 01 to 08"] --> AI["15 AI assistance"] --> LB["16 Libraries<br/>and data"]
    end
    R1 --> R2 --> R3
    classDef key stroke-width:2px
    class RS,C key
    style R1 fill:none,stroke:none
    style R2 fill:none,stroke:none
    style R3 fill:none,stroke:none`,

  // Report, Leakage: what each cutoff can see on the timeline, and what it scores
  'leakage-timeline': () => {
    const S = window.SITE_DATA || {};
    const st = S.strict || {};
    const ov = st.overlap || [];
    const withM = ov.find(o => o.march_tx) || {}, without = ov.find(o => !o.march_tx) || {};
    const pct = v => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : '?');
    const sm = n => ((st.metrics || []).find(m => m.model === n) || {}).pr_auc;
    const champ = ((S.test_metrics || []).find(m => m.model === 'LightGBM (tuned)') || {}).pr_auc;
    const g = st.listening_gain || {};
    return `flowchart LR
    H["Jan 2015 to Feb 2017<br/>billing history<br/>plans, payments, auto-renew"] --- C1(["1 March 2017<br/>strict cutoff"])
    C1 --- MAR["March 2017<br/>labelled plans expire, renewals paid,<br/>listening logs recorded<br/>${pct(withM.share)} pay in March: churn ${pct(withM.churn_rate)}<br/>no March payment: churn ${pct(without.churn_rate)}"]
    MAR --- C2(["31 March 2017<br/>main cutoff"])
    C2 --- LAB["April 2017<br/>30 days after each expiry<br/>is_churn decided"]
    C1 ==> B["Model at 1 March<br/>billing before March only<br/>PR-AUC ${dgF4(sm('Strict billing + demographics + listening'))}<br/>listening adds ${dgSgn(g.mean)}"]
    C2 ==> A["Model at 31 March<br/>sees March renewals<br/>PR-AUC ${dgF4(champ)}"]
    classDef cut stroke-width:2px
    classDef key stroke-width:2px
    class C1,C2 cut
    class A,B key`;
  },

  'data-flow': `flowchart LR
    subgraph RAW["Five raw Kaggle files"]
      direction TB
      L["train_data.csv<br/>946,686 msno + is_churn"]
      K["kaggle_test_data.csv<br/>24,274 msno, no label"]
      M["members.csv<br/>city, age, gender, registration"]
      T["transactions.csv<br/>plans, payments, auto-renew, cancels"]
      U["user_logs.csv<br/>daily listening, March 2017"]
    end
    M --> AM["Clean profile<br/>invalid ages to missing<br/>6 demographic features"]
    T --> AT["Aggregate per subscriber<br/>15 billing features"]
    U --> AU["Aggregate per subscriber<br/>12 listening features<br/>daily secs clipped to 24 h"]
    L --> J
    K --> J
    AM --> J
    AT --> J
    AU --> J
    J["Left join on msno<br/>both ID lists, nobody dropped<br/>has_member / has_tx / has_logs"] --> FM["Labelled matrix<br/>946,686 x 33"]
    J --> KM["Kaggle test matrix<br/>24,274 x 33, no label"]
    FM --> TR["Train 70%<br/>fit"]
    FM --> VA["Validation 10%<br/>tuning, threshold"]
    FM --> TE["Test 20%<br/>scored once"]
    KM --> SUB["submission.csv<br/>churn probability from<br/>the tuned LightGBM<br/>scored by Kaggle, not here"]
    classDef side stroke-dasharray:4 3
    class K,KM,SUB side`,
};

// Boxes that jump to a page section when clicked (diagram key -> node id -> element id)
const DIAGRAM_LINKS = {
  'report-pipeline': { W: 'ovn-why', D: 'ovn-data', P: 'ovn-preprocessing', M: 'ovn-models', E: 'ovn-evaluation', LK: 'ovn-leakage', RS: 'ovn-results',
                       ER: 'ovn-errors', F: 'ovn-failures', RT: 'ovn-runtime', L: 'ovn-limitations', C: 'ovn-conclusion', NX: 'ovn-next', RP: 'ovn-repro', AI: 'ovn-ai', LB: 'ovn-libs' },
  'home-answer': { A2: 'ovn-results', B1: 'ovn-strict', B2: 'ovn-strict' },
  'leakage-timeline': { A: 'ovn-results', B: 'ovn-strict' },
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

// All-in-One Model Predictor Single-Screen Controller

const SUBMIT_BUTTON_IDLE_HTML = `
  <span>Run Churn Prediction</span>
`;

function loadArchetype(typeKey) {
  const arch = archetypes[typeKey];
  if (!arch) return;

  // 1. Subscription & Billing
  if (document.getElementById('sb-auto-renew')) document.getElementById('sb-auto-renew').value = arch.last_auto_renew;
  if (document.getElementById('sb-is-cancel')) document.getElementById('sb-is-cancel').value = arch.last_is_cancel;
  if (document.getElementById('sb-plan-days')) document.getElementById('sb-plan-days').value = arch.last_plan_days;
  if (document.getElementById('sb-amount-paid')) document.getElementById('sb-amount-paid').value = arch.last_amount_paid;
  if (document.getElementById('sb-expiration-days')) document.getElementById('sb-expiration-days').value = arch.days_until_expiration;
  if (document.getElementById('sb-payment-method')) document.getElementById('sb-payment-method').value = arch.last_payment_method;

  // 2. Listening Telemetry
  if (document.getElementById('sb-hours')) document.getElementById('sb-hours').value = arch.hours;
  if (document.getElementById('sb-active-days')) document.getElementById('sb-active-days').value = arch.active_days;
  if (document.getElementById('sb-inactivity')) document.getElementById('sb-inactivity').value = arch.inactivity;
  if (document.getElementById('sb-velocity')) document.getElementById('sb-velocity').value = arch.velocity;
  if (document.getElementById('sb-skip-ratio')) document.getElementById('sb-skip-ratio').value = Math.round(arch.skip_ratio * 100);

  // 3. Demographics
  if (document.getElementById('sb-age')) document.getElementById('sb-age').value = arch.age;
  if (document.getElementById('sb-gender')) document.getElementById('sb-gender').value = arch.gender;
  if (document.getElementById('sb-tenure')) document.getElementById('sb-tenure').value = arch.tenure;
  if (document.getElementById('sb-city')) document.getElementById('sb-city').value = arch.city;
  if (document.getElementById('sb-registered-via')) document.getElementById('sb-registered-via').value = arch.registered_via;

  // Trigger instant inference in the same screen
  runPrediction();
}

function resetSandboxDefaults() {
  loadArchetype('loyal');
}

async function runPrediction() {
  const submitBtn = document.getElementById('sb-submit-btn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Scoring...</span>
    `;
  }

  try {
    const rawSkip = parseFloat(document.getElementById('sb-skip-ratio')?.value || 20);
    const normalizedSkip = rawSkip > 1.0 ? rawSkip / 100.0 : rawSkip;

    const payload = {
      // 1. Subscription & Billing Terms
      last_is_auto_renew: parseInt(document.getElementById('sb-auto-renew')?.value || 1),
      last_is_cancel: parseInt(document.getElementById('sb-is-cancel')?.value || 0),
      last_plan_days: parseInt(document.getElementById('sb-plan-days')?.value || 30),
      last_amount_paid: parseFloat(document.getElementById('sb-amount-paid')?.value || 149),
      days_until_expiration: parseInt(document.getElementById('sb-expiration-days')?.value || 5),
      last_payment_method: parseInt(document.getElementById('sb-payment-method')?.value || 41),

      // 2. Listening Habits & Activity (Last 30 Days)
      total_secs_hours: parseFloat(document.getElementById('sb-hours')?.value || 22.5),
      active_days_count: parseInt(document.getElementById('sb-active-days')?.value || 16),
      days_since_last_active: parseInt(document.getElementById('sb-inactivity')?.value || 2),
      recent_activity_ratio: parseFloat(document.getElementById('sb-velocity')?.value || 0.25),
      skip_ratio: normalizedSkip,

      // 3. Subscriber Profile & Demographics
      bd_cleaned: parseFloat(document.getElementById('sb-age')?.value || 25),
      gender_encoded: parseInt(document.getElementById('sb-gender')?.value || 1),
      tenure_days: parseFloat(document.getElementById('sb-tenure')?.value || 750),
      city: parseInt(document.getElementById('sb-city')?.value || 1),
      registered_via: parseInt(document.getElementById('sb-registered-via')?.value || 7)
    };

    // The champion LightGBM runs locally in the browser (js/sandbox_engine.js); no backend call.
    const result = computeClientSidePrediction(payload);

    renderPredictionResult(result);

  } catch (err) {
    console.error("Prediction engine error:", err);
  } finally {
    // ALWAYS restore button from loading state
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = SUBMIT_BUTTON_IDLE_HTML;
    }
  }
}

function renderPredictionResult(res) {
  // Reveal active result card in the same screen
  const emptyState = document.getElementById('res-empty-state');
  const activeState = document.getElementById('res-active-state');
  if (emptyState) emptyState.classList.add('hidden');
  if (activeState) activeState.classList.remove('hidden');

  const probPct = (res.churn_probability * 100).toFixed(1);

  // 1. Main Probability Readout
  const probElem = document.getElementById('res-prob-display');
  if (probElem) {
    probElem.textContent = probPct + '%';
    probElem.style.color = res.risk_color;
  }

  // 2. Visual Progress Bar
  const barElem = document.getElementById('res-prob-bar');
  if (barElem) {
    barElem.style.width = Math.min(100, Math.max(3, probPct)) + '%';
    barElem.style.backgroundColor = res.risk_color;
  }

  // 3. What happened to test-set subscribers with a similar score (observed churn rate, Wilson 95% CI)
  const ciElem = document.getElementById('res-ci-readout');
  if (ciElem && res.score_band) {
    const b = res.score_band;
    ciElem.textContent = `Test subscribers scored ${(b.lo * 100).toFixed(0)}-${(b.hi * 100).toFixed(0)}%: ${(b.rate * 100).toFixed(1)}% churned [${(b.ci[0] * 100).toFixed(1)}-${(b.ci[1] * 100).toFixed(1)}%], n = ${b.n.toLocaleString('en-US')}`;
  }

  // Threshold marker position
  const tauPct = Math.round(res.optimal_threshold * 100);
  ['res-tau-mark', 'res-tau-label'].forEach(id => { const el = document.getElementById(id); if (el) el.style.left = tauPct + '%'; });
  const tauLabel = document.getElementById('res-tau-label');
  if (tauLabel) tauLabel.innerHTML = `&tau; = ${tauPct}%`;

  // 4. Verdict at the decision threshold
  const verdictElem = document.getElementById('res-verdict-badge');
  if (verdictElem) {
    if (res.churn_prediction === 1) {
      verdictElem.innerHTML = '<div class="whitespace-nowrap">CHURN</div><div class="whitespace-nowrap">PREDICTED</div>';
      verdictElem.className = 'text-right font-black text-2xl sm:text-3xl tracking-wider leading-tight text-accent-danger';
    } else {
      verdictElem.innerHTML = '<div class="whitespace-nowrap">RENEWAL</div><div class="whitespace-nowrap">PREDICTED</div>';
      verdictElem.className = 'text-right font-black text-2xl sm:text-3xl tracking-wider leading-tight text-accent-success';
    }
  }

  // 5. Risk Tier
  const tierElem = document.getElementById('res-tier-badge');
  if (tierElem) {
    tierElem.textContent = res.risk_tier;
    tierElem.style.color = res.risk_color;
  }

  // 6. Source Badge
  const sourceElem = document.getElementById('res-source-badge');
  if (sourceElem) sourceElem.textContent = 'LightGBM (in browser)';

  // 7. Features that raise and lower the prediction
  const riskList = document.getElementById('res-risk-list');
  if (riskList) {
    if (res.primary_risk_factors && res.primary_risk_factors.length) {
      riskList.innerHTML = res.primary_risk_factors.map(f => 
        `<li class="flex items-start gap-2 py-0.5 text-xs text-text-secondary leading-snug"><span class="text-accent-danger font-bold shrink-0 select-none">&bull;</span><span>${f}</span></li>`
      ).join('');
    } else {
      riskList.innerHTML = '<li class="py-0.5 text-xs text-text-muted">No critical behavioral risk flags detected.</li>';
    }
  }

  const protectiveList = document.getElementById('res-protective-list');
  if (protectiveList) {
    if (res.protective_factors && res.protective_factors.length) {
      protectiveList.innerHTML = res.protective_factors.map(p => 
        `<li class="flex items-start gap-2 py-0.5 text-xs text-text-secondary leading-snug"><span class="text-accent-success font-bold shrink-0 select-none">&bull;</span><span>${p}</span></li>`
      ).join('');
    } else {
      protectiveList.innerHTML = '<li class="py-0.5 text-xs text-text-muted">Baseline standard consumption patterns.</li>';
    }
  }

  // 8. Recommendation Box
  const recElem = document.getElementById('res-recommendation-text');
  if (recElem) {
    recElem.textContent = res.retention_recommendation || 'Standard retention cadence.';
  }


}

// Score the subscriber already in the form once everything has loaded, so the panel never opens empty
window.addEventListener('load', () => {
  if (window.LGBM_MODEL && document.getElementById('sandbox-form')) runPrediction();
});

// Expose globally
window.loadArchetype = loadArchetype;
window.resetSandboxDefaults = resetSandboxDefaults;
window.runPrediction = runPrediction;
window.renderPredictionResult = renderPredictionResult;

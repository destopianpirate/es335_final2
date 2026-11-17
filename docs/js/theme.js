// THEME CONTROLLER: DUAL-THEME ENGINE (DAY / NIGHT)
// Manages theme persistence, HTML root classes, desktop sliding pill, and mobile toggle

(function () {
  function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function refreshChartsTheme(isDark) {
    if (!window.Chart) return;
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
    const tickColor = isDark ? '#A1A1AA' : '#64748B';
    const legendColor = isDark ? '#E4E4E7' : '#334155';

    if (Chart.instances) {
      Object.values(Chart.instances).forEach(chart => {
        try {
          if (chart.options) {
            if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
              chart.options.plugins.legend.labels.color = legendColor;
            }
            if (chart.options.plugins && chart.options.plugins.tooltip) {
              chart.options.plugins.tooltip.backgroundColor = isDark ? '#1E1E1E' : '#FFFFFF';
              chart.options.plugins.tooltip.titleColor = isDark ? '#F8FAFC' : '#121212';
              chart.options.plugins.tooltip.bodyColor = isDark ? '#CBD5E1' : '#475569';
              chart.options.plugins.tooltip.borderColor = isDark ? '#2A2A2A' : '#E2E8F0';
            }
            if (chart.options.scales) {
              Object.values(chart.options.scales).forEach(scale => {
                if (scale.grid && scale.grid.display !== false) {
                  scale.grid.color = gridColor;
                }
                if (scale.ticks) {
                  scale.ticks.color = tickColor;
                }
                if (scale.title) {
                  scale.title.color = tickColor;
                }
              });
            }
          }
          chart.update();
        } catch (e) {
          // ignore transient chart update errors
        }
      });
    }

  }

  function applyTheme(theme) {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    updateThemeControls(theme);
    refreshChartsTheme(isDark);
  }

  function updateThemeControls(theme) {
    const isDark = theme === 'dark';

    // 1. Desktop & Mobile Animated SVG Toggle Switches
    const toggle = document.getElementById('toggle');
    const mobileToggle = document.getElementById('mobile-toggle');

    if (toggle && toggle.checked !== isDark) {
      toggle.checked = isDark;
    }
    if (mobileToggle && mobileToggle.checked !== isDark) {
      mobileToggle.checked = isDark;
    }

    const toggleBtn = document.getElementById('theme-toggle-button');
    const mobileToggleBtn = document.getElementById('mobile-theme-toggle-button');
    const labelText = isDark ? 'Switch to Day Mode' : 'Switch to Night Mode';

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-label', labelText);
      toggleBtn.setAttribute('title', labelText);
    }
    if (mobileToggleBtn) {
      mobileToggleBtn.setAttribute('aria-label', labelText);
      mobileToggleBtn.setAttribute('title', labelText);
    }

    // 2. Backward compatibility fallback for desktop capsule pill & buttons
    const pill = document.getElementById('theme-slider-pill');
    const dayBtn = document.getElementById('theme-btn-day');
    const nightBtn = document.getElementById('theme-btn-night');

    if (pill) {
      pill.style.transform = isDark ? 'translateX(100%)' : 'translateX(0%)';
    }

    if (dayBtn && nightBtn) {
      if (isDark) {
        dayBtn.classList.remove('text-slate-900', 'font-bold');
        dayBtn.classList.add('text-slate-400', 'font-medium');
        dayBtn.setAttribute('aria-pressed', 'false');

        nightBtn.classList.remove('text-slate-400', 'font-medium');
        nightBtn.classList.add('text-slate-900', 'dark:text-white', 'font-bold');
        nightBtn.setAttribute('aria-pressed', 'true');
      } else {
        dayBtn.classList.remove('text-slate-400', 'font-medium');
        dayBtn.classList.add('text-slate-900', 'font-bold');
        dayBtn.setAttribute('aria-pressed', 'true');

        nightBtn.classList.remove('text-slate-900', 'dark:text-white', 'font-bold');
        nightBtn.classList.add('text-slate-400', 'font-medium');
        nightBtn.setAttribute('aria-pressed', 'false');
      }
    }

    // 3. Backward compatibility fallback for mobile icon button
    const mobileIcon = document.getElementById('mobile-theme-icon');
    const mobileBtn = document.getElementById('mobile-theme-btn');
    if (mobileIcon) {
      mobileIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }
    if (mobileBtn) {
      mobileBtn.setAttribute('aria-label', labelText);
      mobileBtn.setAttribute('title', labelText);
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function showGradientToast(isActive) {
    let toast = document.getElementById('day-gradients-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'day-gradients-toast';
      toast.className = 'fixed right-6 z-[9999] transition-all duration-300';
      toast.style.bottom = '76px';   // above the palette button
      document.body.appendChild(toast);
      // stays open while the pointer is on it, so a colour can be picked
      toast.addEventListener('mouseenter', function () { toast._hover = true; holdToast(); });
      toast.addEventListener('mouseleave', function () { toast._hover = false; hideToastLater(1200); });
      toast.addEventListener('click', function (e) {
        const b = e.target.closest('[data-accent]');
        if (!b || !window.setAccent) return;
        window.setAccent(b.dataset.accent);
        toast.querySelectorAll('[data-accent]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    }
    toast.style.pointerEvents = 'auto';

    const stateText = isActive ? 'Activated' : 'Deactivated';
    const badgeClass = isActive
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';

    const colors = window.accentColors || [];
    const cur = window.currentAccent ? window.currentAccent() : '';
    const swatches = colors.map(function (c) {
      return `<button type="button" class="dg-swatch" data-accent="${c.hex}" title="${c.name}" aria-label="${c.name}" aria-pressed="${c.hex === cur ? 'true' : 'false'}" style="--c:${c.hex}"></button>`;
    }).join('');

    toast.innerHTML = `
      <div class="inline-flex flex-col gap-2.5 px-4 py-3 rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-md border border-slate-200 dark:border-zinc-700 shadow-xl text-xs font-semibold text-slate-800 dark:text-zinc-100">
        <div class="inline-flex items-center gap-2.5">
          <span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">palette</span>
          <span>Day Section Gradients:</span>
          <span class="px-2 py-0.5 rounded-lg border text-[11px] font-bold ${badgeClass}">${stateText}</span>
          <span class="text-[10px] text-slate-400 font-mono ml-1">Ctrl + /</span>
        </div>
        ${swatches ? `<div class="inline-flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200 dark:border-zinc-700">
          <span class="text-[11px] text-slate-500 dark:text-zinc-400">Accent colour</span>
          <span class="dg-row">${swatches}</span>
        </div>` : ''}
      </div>
    `;

    toast._hover = false;
    if (window.gsap) {
      gsap.killTweensOf(toast);
      gsap.fromTo(toast, { opacity: 0, y: 12, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' });
    } else {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }
    hideToastLater(3500);
  }

  // keep the toast up (pointer on it) / fade it out after a pause
  function holdToast() {
    const toast = document.getElementById('day-gradients-toast');
    if (!toast) return;
    clearTimeout(toast._timer);
    if (window.gsap) { gsap.killTweensOf(toast); gsap.to(toast, { opacity: 1, y: 0, scale: 1, duration: 0.15 }); }
    else { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }
  }
  function hideToastLater(ms) {
    const toast = document.getElementById('day-gradients-toast');
    if (!toast) return;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      if (toast._hover) return;
      toast.style.pointerEvents = 'none';
      if (window.gsap) {
        gsap.to(toast, { opacity: 0, y: 8, scale: 0.96, duration: 0.28, ease: 'power2.in', onComplete: function () { if (!toast._hover) toast.innerHTML = ''; } });
      } else {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
      }
    }, ms);
  }

  function toggleDayGradients() {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      applyTheme('light');
      root.classList.add('day-gradients');
      localStorage.setItem('day_gradients', 'true');
      showGradientToast(true);
      return true;
    }

    const isNowActive = root.classList.toggle('day-gradients');
    localStorage.setItem('day_gradients', isNowActive ? 'true' : 'false');
    showGradientToast(isNowActive);
    return isNowActive;
  }

  function initDayGradients() {
    const saved = localStorage.getItem('day_gradients');
    if (saved === 'true') {
      document.documentElement.classList.add('day-gradients');
    }
  }

  function bindDayGradientsShortcut() {
    window.addEventListener('keydown', function (e) {
      const isSlash = e.key === '/' || e.key === '?' || e.code === 'Slash' || e.code === 'NumpadDivide' || e.keyCode === 191;
      if ((e.ctrlKey || e.metaKey) && isSlash) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleDayGradients();
      }
    });
  }

  // Expose globally
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;
  window.toggleDayGradients = toggleDayGradients;

  // Initial theme application
  const initialTheme = getPreferredTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  function bindToggleListeners() {
    const toggle = document.getElementById('toggle');
    const mobileToggle = document.getElementById('mobile-toggle');

    if (toggle) {
      toggle.addEventListener('change', function () {
        applyTheme(this.checked ? 'dark' : 'light');
      });
    }
    if (mobileToggle) {
      mobileToggle.addEventListener('change', function () {
        applyTheme(this.checked ? 'dark' : 'light');
      });
    }

    // Keyboard accessibility for space / enter on toggle wrappers
    const toggleBtn = document.getElementById('theme-toggle-button');
    if (toggleBtn) {
      toggleBtn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          const chk = document.getElementById('toggle');
          if (chk) {
            chk.checked = !chk.checked;
            applyTheme(chk.checked ? 'dark' : 'light');
          }
        }
      });
    }
  }

  // Bind on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    bindToggleListeners();
    initDayGradients();
    bindDayGradientsShortcut();
    updateThemeControls(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

    // Listen to system changes if user hasn't explicitly set a preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem('theme')) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  });
})();

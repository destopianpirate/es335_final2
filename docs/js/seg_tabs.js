// SegTabs: one reusable segmented control (sliding highlight, optional icons, arrow-key navigation).
// Usage:  SegTabs.mount('dom-id', { items: [{ key, label, icon? }], size: 'md' | 'sm', scroll: bool,
//                                    fade: bool, label: 'aria label', onSelect: key => {} });
//         SegTabs.select('dom-id', key, animate)   // update visuals only
(function () {
  const cfgs = {};
  const el = w => (typeof w === 'string' ? document.getElementById(w) : w);

  function select(wrapRef, key, animate) {
    const wrap = el(wrapRef);
    if (!wrap) return;
    const cfg = cfgs[wrap.id] || {};
    wrap.dataset.active = key;
    const thumb = wrap.querySelector('.dsn-seg-thumb');
    let active = null;
    wrap.querySelectorAll('button[data-key]').forEach(b => {
      const on = b.dataset.key === key;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-active', on);
      if (on) active = b;
    });
    if (active && thumb && active.offsetWidth) {
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.height = active.offsetHeight + 'px';
      thumb.style.transform = 'translate(' + active.offsetLeft + 'px, ' + active.offsetTop + 'px)';
      thumb.classList.add('ready');
      if (cfg.scroll && animate) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    if (cfg.fade && animate) {
      const panel = wrap.nextElementSibling;
      if (panel) { panel.classList.remove('dsn-fade'); void panel.offsetWidth; panel.classList.add('dsn-fade'); }
    }
  }

  // prev / next arrows at the left and right edge of the chart(s) this control drives
  function arrows(wrap, opts) {
    const a = opts.arrows;
    if (!a) return;
    const host = typeof a.host === 'function' ? a.host() : (a.canvas ? (document.getElementById(a.canvas) || {}).parentElement : null);
    if (!host || host.dataset.arrows) return;
    host.dataset.arrows = '1';
    host.classList.add('sr-host');
    const mk = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sr-arrow sr-arrow-' + (dir < 0 ? 'l' : 'r');
      b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
      b.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">' + (dir < 0 ? 'chevron_left' : 'chevron_right') + '</span>';
      b.addEventListener('click', function () {
        const items = cfgs[wrap.id].items, i = items.findIndex(function (it) { return it.key === wrap.dataset.active; });
        const next = items[(i + dir + items.length) % items.length];
        if (cfgs[wrap.id].onSelect) cfgs[wrap.id].onSelect(next.key);
      });
      host.appendChild(b);
    };
    mk(-1); mk(1);
  }

  function mount(wrapRef, opts) {
    const wrap = el(wrapRef);
    if (!wrap) return;
    const first = !cfgs[wrap.id];
    cfgs[wrap.id] = opts;
    wrap.className = 'dsn-seg' + (opts.size === 'sm' ? ' dsn-seg-sm' : '') + (opts.scroll ? ' dsn-seg-scroll' : '');
    wrap.setAttribute('role', 'tablist');
    if (opts.label) wrap.setAttribute('aria-label', opts.label);
    const keep = wrap.dataset.active || (opts.active != null ? opts.active : opts.items[0].key);
    wrap.innerHTML = '<span class="dsn-seg-thumb" aria-hidden="true"></span>' + opts.items.map(function (it) {
      return '<button type="button" role="tab" data-key="' + it.key + '" class="dsn-seg-btn">' +
        (it.icon ? '<span class="material-symbols-outlined dsn-seg-ico" aria-hidden="true">' + it.icon + '</span>' : '') +
        '<span class="dsn-seg-label">' + it.label + '</span></button>';
    }).join('');
    select(wrap, keep, false);
    arrows(wrap, opts);
    if (!first) return;
    wrap.addEventListener('click', function (e) {
      const b = e.target.closest('button[data-key]');
      if (b && cfgs[wrap.id].onSelect) cfgs[wrap.id].onSelect(b.dataset.key);
    });
    wrap.addEventListener('keydown', function (e) {
      const list = Array.from(wrap.querySelectorAll('button[data-key]'));
      const i = list.findIndex(function (b) { return b.dataset.key === wrap.dataset.active; });
      let n = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % list.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + list.length) % list.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = list.length - 1;
      if (n < 0) return;
      e.preventDefault();
      list[n].focus();
      if (cfgs[wrap.id].onSelect) cfgs[wrap.id].onSelect(list[n].dataset.key);
    });
    const resync = function () { select(wrap, wrap.dataset.active, false); };
    if (window.ResizeObserver) new ResizeObserver(resync).observe(wrap);
    window.addEventListener('resize', resync);
  }

  window.SegTabs = { mount: mount, select: select };
})();

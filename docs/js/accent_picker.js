// Accent colour picker: Alt + \ (Option + \ on Mac) opens a small panel at the bottom right.
// The chosen colour replaces the red accent everywhere (title dots, section numbers, rail, scale)
// and is remembered for the next visit.
(function () {
  const ACCENTS = [
    { name: 'Red', hex: '#DC2626' },
    { name: 'Orange', hex: '#EA580C' },
    { name: 'Amber', hex: '#D97706' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Teal', hex: '#0D9488' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Indigo', hex: '#4F46E5' },
    { name: 'Violet', hex: '#7C3AED' },
    { name: 'Pink', hex: '#DB2777' },
  ];
  const KEY = 'accent_color';
  const root = document.documentElement;
  let panel = null, hideTimer = 0;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: keep for this visit only */ } }

  function apply(hex) {
    root.style.setProperty('--accent', hex);
    if (panel) panel.querySelectorAll('.ap-swatch').forEach(b => b.setAttribute('aria-pressed', b.dataset.hex === hex ? 'true' : 'false'));
  }

  // shared with the Ctrl + / toast (theme.js), which shows the same swatches
  window.accentColors = ACCENTS;
  window.setAccent = hex => { apply(hex); save(hex); };
  window.currentAccent = () => getComputedStyle(root).getPropertyValue('--accent').trim().toUpperCase() || '#DC2626';

  const saved = read();
  if (saved && ACCENTS.some(a => a.hex === saved)) apply(saved);

  function build() {
    panel = document.createElement('div');
    panel.id = 'accent-picker';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Accent colour');
    panel.innerHTML = `
      <div class="ap-head"><span>Accent colour</span><kbd>Alt + \\</kbd></div>
      <div class="ap-row">${ACCENTS.map(a => `<button type="button" class="ap-swatch" data-hex="${a.hex}" title="${a.name}" aria-label="${a.name}" style="--c:${a.hex}"></button>`).join('')}</div>`;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      const b = e.target.closest('.ap-swatch');
      if (!b) return;
      apply(b.dataset.hex); save(b.dataset.hex);
    });
    apply(getComputedStyle(root).getPropertyValue('--accent').trim().toUpperCase() || '#DC2626');
  }

  function toggle(force) {
    if (!panel) build();
    const open = force !== undefined ? force : !panel.classList.contains('is-open');
    clearTimeout(hideTimer);
    panel.classList.toggle('is-open', open);
    if (fab) fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { const cur = panel.querySelector('[aria-pressed="true"]') || panel.querySelector('.ap-swatch'); cur && cur.focus({ preventScroll: true }); }
  }

  // a small palette button at the bottom right opens the same panel without the keyboard
  let fab = null;
  function addButton() {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'accent-fab';
    fab.title = 'Accent colour (Alt + \\)';
    fab.setAttribute('aria-label', 'Accent colour');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">palette</span>';
    fab.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    fab.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(fab);
  }
  if (document.body) addButton(); else document.addEventListener('DOMContentLoaded', addButton);

  // Alt + \ : matched by character, physical key and legacy keyCode (220 / 226) to cover every keyboard layout.
  // Listened to on key press and, if the browser kept the press for itself, on key release.
  const isShortcut = e => e.altKey && !e.ctrlKey && !e.metaKey &&
    (e.key === '\\' || e.key === '|' || e.code === 'Backslash' || e.code === 'IntlBackslash' || e.keyCode === 220 || e.keyCode === 226);
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };
  let pressed = false;
  window.addEventListener('keydown', e => {
    if (isShortcut(e)) {
      if (typing()) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) { pressed = true; toggle(); }
    } else if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) {
      toggle(false);
    }
  }, true);
  window.addEventListener('keyup', e => {
    const backslash = e.key === '\\' || e.key === '|' || e.code === 'Backslash' || e.code === 'IntlBackslash' || e.keyCode === 220 || e.keyCode === 226;
    if (!backslash) return;
    if (!pressed && e.altKey && !e.ctrlKey && !e.metaKey && !typing()) toggle();
    pressed = false;
  }, true);
  document.addEventListener('pointerdown', e => {
    if (panel && panel.classList.contains('is-open') && !panel.contains(e.target)) toggle(false);
  });
})();

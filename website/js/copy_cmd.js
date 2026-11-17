// Copy buttons on command boxes (Reproduction steps)
(function () {
  document.addEventListener('click', function (e) {
    const b = e.target.closest('.rp-copy');
    if (!b) return;
    const code = b.parentElement.querySelector('code');
    if (!code) return;
    const text = code.textContent;
    const done = () => {
      const icon = b.querySelector('.material-symbols-outlined');
      b.classList.add('is-done'); if (icon) icon.textContent = 'check';
      setTimeout(() => { b.classList.remove('is-done'); if (icon) icon.textContent = 'content_copy'; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
    else {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (err) { /* copying not allowed */ }
      t.remove();
    }
  });
})();

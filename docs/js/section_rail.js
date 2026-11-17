// chapter plates fill in when they scroll into view
(function () {
  const plates = document.querySelectorAll('.chap');
  if (!('IntersectionObserver' in window)) { plates.forEach(p => p.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.6 });
  plates.forEach(p => io.observe(p));
})();

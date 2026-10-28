(() => {
  const bar = document.querySelector('.reading-progress');
  if (!bar) return;
  let pending = false;
  function update() {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (available > 0 ? Math.min(100, window.scrollY / available * 100) : 0) + '%';
    pending = false;
  }
  window.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(update); } }, {passive:true});
  update();
})();

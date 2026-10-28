(() => {
  const search = document.getElementById('blog-search');
  const category = document.getElementById('blog-category');
  const cards = [...document.querySelectorAll('.blog-card')];
  const normal = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function update() {
    const q = normal(search.value.trim());
    let shown = 0;
    for (const card of cards) {
      const visible = (!category.value || card.dataset.category === category.value) && (!q || normal(card.dataset.search).includes(q));
      card.hidden = !visible;
      if (visible) shown++;
    }
    document.getElementById('blog-count').textContent = `${shown} ${shown === 1 ? 'artículo encontrado' : 'artículos encontrados'}.`;
    document.getElementById('blog-empty').hidden = shown > 0;
  }
  search.addEventListener('input', update);
  category.addEventListener('change', update);
})();

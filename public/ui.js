// Presentation preferences only. No teaching, provider or account behavior.
(() => {
  const root = document.documentElement;
  const button = document.getElementById('themeToggle');
  function render(theme) {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    button.textContent = dark ? '☀ Light theme' : '☾ Dark theme';
    button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    button.setAttribute('aria-pressed', String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? '#101720' : '#f5f7fb';
  }
  render(root.dataset.theme === 'dark' ? 'dark' : 'light');
  button.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    render(theme);
    try { localStorage.setItem('hometutor.theme', theme); } catch {}
  });
})();

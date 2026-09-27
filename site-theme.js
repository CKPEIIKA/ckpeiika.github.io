// Remembers the light/dark choice across the site pages and the demos (localStorage
// "site-theme", the key demos/theme.js uses). demos/theme-init.js applies it before the
// first paint; without JavaScript the checkbox still switches the current page.
(() => {
  const box = document.getElementById('site-theme-toggle');
  if (!box) return;
  const root = document.documentElement;
  box.checked = root.classList.contains('theme-dark');
  box.addEventListener('change', () => {
    root.classList.toggle('theme-dark', box.checked);
    try {
      localStorage.setItem('site-theme', box.checked ? 'dark' : 'light');
    } catch (error) {
      console.warn('Theme storage unavailable', error);
    }
  });
})();

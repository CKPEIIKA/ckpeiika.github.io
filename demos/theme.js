const STORAGE_KEY = 'site-theme';
const root = document.documentElement;
const buttons = [...document.querySelectorAll('[data-theme-toggle]')];

function label() {
  const russian = root.lang.toLowerCase().startsWith('ru');
  if (root.classList.contains('theme-dark')) {
    return russian ? 'Включить светлую тему' : 'Use light theme';
  }
  return russian ? 'Включить тёмную тему' : 'Use dark theme';
}

function render() {
  const dark = root.classList.contains('theme-dark');
  for (const button of buttons) {
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', label());
    button.setAttribute('title', label());
    button.setAttribute('aria-pressed', String(dark));
  }
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    const dark = root.classList.toggle('theme-dark');
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Theme storage unavailable', error);
    }
    render();
    globalThis.dispatchEvent(new CustomEvent('site-theme-change', { detail: { dark } }));
  });
}

new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ['lang'] });
render();

try {
  if (localStorage.getItem('site-theme') === 'dark') {
    document.documentElement.classList.add('theme-dark');
  }
} catch (error) {
  console.warn('Theme storage unavailable', error);
}

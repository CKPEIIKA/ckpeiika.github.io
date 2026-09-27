// Shared EN/RU selection for every demo page: `?lang=` wins, then the browser language.

export const LANGUAGES = Object.freeze(['en', 'ru']);

export function initialLanguage(href, preferred) {
  const requested = new URL(href).searchParams.get('lang');
  if (LANGUAGES.includes(requested)) return requested;
  return String(preferred ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function pageLanguage() {
  return initialLanguage(globalThis.location.href, globalThis.navigator?.language);
}

export function rememberLanguage(language) {
  const url = new URL(globalThis.location.href);
  url.searchParams.set('lang', language);
  try {
    globalThis.history.replaceState(null, '', url);
  } catch (error) {
    // Opaque-origin previews may prohibit URL rewriting; the page still switches.
    console.warn('Could not store the language in the URL', error);
  }
}

// Marks the current language in [data-locale-switch] and switches in place on click.
// Without JavaScript the links still work as ordinary ?lang= navigation.
export function bindLocaleSwitch(getLanguage, onSelect) {
  const nav = document.querySelector('[data-locale-switch]');

  function mark() {
    const language = getLanguage();
    for (const link of nav?.querySelectorAll('[data-lang]') ?? []) {
      if (link.dataset.lang === language) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  nav?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-lang]');
    if (!link) return;
    event.preventDefault();
    const next = link.dataset.lang;
    if (!LANGUAGES.includes(next) || next === getLanguage()) return;
    rememberLanguage(next);
    onSelect(next);
    mark();
  });

  mark();
  return mark;
}

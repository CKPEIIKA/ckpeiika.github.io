import { rewriteChalkText } from '../lib/chalkish/examples/chalk-transition.js';

const LANGUAGES = new Set(['en', 'ru']);

const COMMON = Object.freeze({
  en: Object.freeze({
    'locale.label': 'Language',
    'nav.course': 'course page',
    'page.settings': 'Calculation settings',
    'page.showControls': 'Show parameters',
    'page.hideControls': 'Hide parameters',
    'page.experiment': 'Experiment',
    'page.case': 'Case',
    'stage.controls': 'Playback and viewport controls',
    'stage.speed': 'Playback speed',
    'stage.play': 'Play animation',
    'stage.pause': 'Pause animation',
    'stage.step': 'Advance one numerical step',
    'stage.grab': 'Grab and pan',
    'stage.zoomIn': 'Zoom in',
    'stage.zoomOut': 'Zoom out',
    'stage.resetView': 'Reset view',
    'stage.hideControls': 'Hide toolbar',
    'stage.showControls': 'Show toolbar',
    'stage.enterFullscreen': 'Enter fullscreen',
    'stage.exitFullscreen': 'Exit fullscreen',
    'stage.fullscreenUnavailable': 'Fullscreen unavailable',
  }),
  ru: Object.freeze({
    'locale.label': 'Язык',
    'nav.course': 'к странице курса',
    'page.settings': 'Параметры расчёта',
    'page.showControls': 'Показать параметры',
    'page.hideControls': 'Скрыть параметры',
    'page.experiment': 'Задача',
    'page.case': 'Расчётный случай',
    'stage.controls': 'Управление расчётом и областью просмотра',
    'stage.speed': 'Скорость воспроизведения',
    'stage.play': 'Продолжить расчёт',
    'stage.pause': 'Приостановить расчёт',
    'stage.step': 'Выполнить один численный шаг',
    'stage.grab': 'Перемещение области просмотра',
    'stage.zoomIn': 'Увеличить',
    'stage.zoomOut': 'Уменьшить',
    'stage.resetView': 'Восстановить область просмотра',
    'stage.hideControls': 'Скрыть панель управления',
    'stage.showControls': 'Показать панель управления',
    'stage.enterFullscreen': 'Развернуть на весь экран',
    'stage.exitFullscreen': 'Выйти из полноэкранного режима',
    'stage.fullscreenUnavailable': 'Полноэкранный режим недоступен',
  }),
});

export function withCommonTranslations(translations) {
  return {
    en: { ...COMMON.en, ...translations.en },
    ru: { ...COMMON.ru, ...translations.ru },
  };
}

function initialLanguage() {
  const requested = new URL(globalThis.location.href).searchParams.get('lang');
  if (LANGUAGES.has(requested)) return requested;
  return globalThis.navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function bindLabLanguage(translations) {
  let language = initialLanguage();
  const listeners = new Set();

  function translate(key) {
    return translations[language]?.[key] ?? translations.en?.[key] ?? key;
  }

  function apply({ animate = false } = {}) {
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const text = translate(node.dataset.i18n);
      if (animate && node.tagName !== 'OPTION') rewriteChalkText(node, text);
      else node.textContent = text;
    }
    for (const node of document.querySelectorAll('[data-i18n-aria-label]')) {
      node.setAttribute('aria-label', translate(node.dataset.i18nAriaLabel));
    }
    for (const node of document.querySelectorAll('[data-i18n-title]')) {
      node.setAttribute('title', translate(node.dataset.i18nTitle));
    }
    for (const node of document.querySelectorAll('[data-i18n-content]')) {
      node.setAttribute('content', translate(node.dataset.i18nContent));
    }
    for (const link of document.querySelectorAll('[data-lang]')) {
      const active = link.dataset.lang === language;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = translate('page.documentTitle');
    for (const listener of listeners) listener(language);
  }

  function setLanguage(next) {
    if (!LANGUAGES.has(next) || next === language) return;
    language = next;
    const url = new URL(globalThis.location.href);
    url.searchParams.set('lang', language);
    globalThis.history.replaceState(null, '', url);
    apply({ animate: true });
  }

  document.querySelector('[data-locale-switch]')?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-lang]');
    if (!link) return;
    event.preventDefault();
    setLanguage(link.dataset.lang);
  });

  apply();

  return Object.freeze({
    get language() {
      return language;
    },
    t: translate,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function bindMobileControls({ translate }) {
  const toggle = document.querySelector('[data-mobile-controls-toggle]');
  const controls = document.getElementById('lab-controls');
  if (!toggle || !controls) {
    return Object.freeze({ sync() {}, dispose() {} });
  }

  let open = false;
  const media = globalThis.matchMedia?.('(max-width: 760px)') ?? null;

  function sync() {
    const mobile = media?.matches === true;
    controls.classList.toggle('mobile-controls-open', !mobile || open);
    toggle.setAttribute('aria-expanded', String(mobile ? open : true));
    const key = mobile && open ? 'page.hideControls' : 'page.showControls';
    const label = translate(key);
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  toggle.addEventListener('click', () => {
    open = !open;
    sync();
  });
  media?.addEventListener?.('change', sync);
  sync();

  return Object.freeze({
    sync,
    dispose() {
      media?.removeEventListener?.('change', sync);
    },
  });
}

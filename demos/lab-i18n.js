import { rewriteChalkText } from '../lib/chalkish/src/chalk-transition.js';
import { bindControlsSheet } from './controls-sheet.js';
import { bindLocaleSwitch, pageLanguage } from './locale.js';

const COMMON = Object.freeze({
  en: Object.freeze({
    'locale.label': 'Language',
    'page.help': 'Help',
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
    'page.help': 'Справка',
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

export function bindLabLanguage(translations) {
  let language = pageLanguage();
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
    document.title = translate('page.documentTitle');
    for (const listener of listeners) listener(language);
  }

  bindLocaleSwitch(() => language, (next) => {
    language = next;
    apply({ animate: true });
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
  const layout = document.querySelector('.lab-layout');
  if (!toggle || !layout) {
    return Object.freeze({ sync() {}, dispose() {} });
  }
  const sheet = bindControlsSheet({
    toggle,
    root: layout,
    label: (collapsed) => translate(collapsed ? 'page.showControls' : 'page.hideControls'),
  });
  return Object.freeze({ sync: sheet.sync, dispose() {} });
}

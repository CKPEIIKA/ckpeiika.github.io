import { markChalkTransition } from '../../lib/chalkish/examples/chalk-transition.js';
import { PDE_DEMOS, localized } from './catalog.js';
import { mountDerivativeDemo } from './derivative-demo.js';
import { mountLessonDemo } from './lesson-demo.js';
import { createPdeShell } from './pde-shell.js';
import { mountPdePreview } from './preview.js';

const COPY = Object.freeze({
  ru: Object.freeze({
    documentTitle: 'Лекция 2 CFD: интерактивные УЧП',
    course: 'к странице курса',
    title: 'Лекция 2 CFD: уравнения в частных производных',
    catalogue: 'Каталог',
    introduction: 'Выберите рисунок. Готовая демонстрация откроется на месте каталога; кнопка × вернёт к списку.',
    ready: 'интерактив',
    planned: 'эскиз модуля',
    close: 'Закрыть демонстрацию и вернуться в каталог',
    previous: 'Предыдущая демонстрация',
    next: 'Следующая демонстрация',
    navigation: 'Навигация по демонстрациям',
  }),
  en: Object.freeze({
    documentTitle: 'CFD Lecture 2: interactive PDEs',
    course: 'course page',
    title: 'CFD Lecture 2: partial differential equations',
    catalogue: 'Catalogue',
    introduction: 'Choose a picture. An available demo opens in place; × returns to the catalogue.',
    ready: 'interactive',
    planned: 'module sketch',
    close: 'Close demo and return to catalogue',
    previous: 'Previous demo',
    next: 'Next demo',
    navigation: 'Demo navigation',
  }),
});

const VISIBLE_DEMOS = Object.freeze(
  PDE_DEMOS.filter((entry) => entry.hidden !== true),
);

const nodes = Object.freeze({
  course: document.querySelector('[data-course-label]'),
  title: document.querySelector('h1'),
  locale: document.querySelector('[data-locale-switch]'),
  gallery: document.getElementById('gallery'),
  galleryTitle: document.getElementById('gallery-title'),
  introduction: document.getElementById('gallery-introduction'),
  grid: document.getElementById('catalogue-grid'),
  demo: document.getElementById('demo-view'),
  close: document.getElementById('close-demo'),
  previous: document.getElementById('previous-demo'),
  next: document.getElementById('next-demo'),
  navigation: document.querySelector('.demo-navigation'),
  demoTitle: document.getElementById('demo-title'),
  host: document.getElementById('demo-host'),
});

let language = (() => {
  const requested = new URL(globalThis.location.href).searchParams.get('lang');
  if (requested === 'en' || requested === 'ru') return requested;
  return globalThis.navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
})();
let previewApps = [];
let activeModule = null;

function copy() {
  return COPY[language];
}

function disposeActive() {
  activeModule?.dispose?.();
  activeModule = null;
}

function disposePreviews() {
  for (const preview of previewApps) preview.dispose();
  previewApps = [];
}

function renderLocale() {
  document.documentElement.lang = language;
  document.title = copy().documentTitle;
  nodes.course.textContent = copy().course;
  nodes.title.textContent = copy().title;
  nodes.galleryTitle.textContent = copy().catalogue;
  nodes.introduction.textContent = copy().introduction;
  nodes.close.setAttribute('aria-label', copy().close);
  nodes.close.setAttribute('title', copy().close);
  nodes.previous.setAttribute('aria-label', copy().previous);
  nodes.previous.setAttribute('title', copy().previous);
  nodes.next.setAttribute('aria-label', copy().next);
  nodes.next.setAttribute('title', copy().next);
  nodes.navigation.setAttribute('aria-label', copy().navigation);
  for (const link of nodes.locale.querySelectorAll('[data-lang]')) {
    if (link.dataset.lang === language) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function renderGallery() {
  disposePreviews();
  const fragment = document.createDocumentFragment();
  const previews = [];
  for (const entry of VISIBLE_DEMOS) {
    const card = document.createElement('a');
    card.className = 'catalogue-card';
    card.href = `#${entry.id}`;
    card.dataset.available = String(entry.available === true);
    const picture = document.createElement('div');
    picture.className = 'catalogue-picture';
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 280;
    canvas.setAttribute('aria-hidden', 'true');
    picture.append(canvas);
    const body = document.createElement('span');
    body.className = 'catalogue-caption';
    const heading = document.createElement('strong');
    heading.textContent = localized(entry.title, language);
    const equation = document.createElement('span');
    equation.textContent = entry.equation;
    const status = document.createElement('small');
    status.textContent = entry.available ? copy().ready : copy().planned;
    body.append(heading, equation);
    card.append(picture, body);
    fragment.append(card);
    previews.push([canvas, entry]);
  }
  nodes.grid.replaceChildren(fragment);
  previewApps = previews.map(([canvas, entry]) => (
    mountPdePreview(canvas, entry, {
      surface: document.documentElement.classList.contains('theme-dark')
        ? 'paper-dark'
        : 'paper',
    })
  ));
}

function selectedEntry() {
  const id = globalThis.location.hash.slice(1);
  return VISIBLE_DEMOS.find((entry) => entry.id === id);
}

let savedLesson = null;

function route() {
  disposeActive();
  const entry = selectedEntry();
  if (!entry) {
    document.body.classList.remove('demo-open');
    nodes.demo.hidden = true;
    nodes.gallery.hidden = false;
    globalThis.requestAnimationFrame(() => {
      for (const preview of previewApps) preview.resize();
    });
    return;
  }
  document.body.classList.add('demo-open');
  nodes.gallery.hidden = true;
  nodes.demo.hidden = false;
  nodes.demoTitle.textContent = localized(entry.title, language);
  const shell = createPdeShell(nodes.host, entry, language);
  activeModule = entry.id === 'derivatives'
    ? mountDerivativeDemo(shell, language, savedLesson)
    : mountLessonDemo(shell, entry, language, savedLesson);
  savedLesson = null;
  for (const element of nodes.host.querySelectorAll(
    '.pde-equation',
  )) {
    markChalkTransition(element, 'write');
  }
}

let closing = false;

function closeDemo() {
  if (closing) return;
  const chalkElements = [...nodes.host.querySelectorAll(
    '.pde-equation',
  )];
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (const element of chalkElements) markChalkTransition(element, 'erase');
  closing = true;
  globalThis.setTimeout(() => {
    closing = false;
    globalThis.history.pushState(null, '', `${globalThis.location.pathname}${globalThis.location.search}`);
    route();
    nodes.galleryTitle.focus?.();
  }, reducedMotion ? 0 : 180);
}

function moveDemo(offset) {
  if (closing) return;
  const current = selectedEntry();
  const index = Math.max(0, VISIBLE_DEMOS.findIndex((entry) => entry.id === current?.id));
  const nextIndex = (index + offset + VISIBLE_DEMOS.length) % VISIBLE_DEMOS.length;
  globalThis.location.hash = VISIBLE_DEMOS[nextIndex].id;
}

nodes.close.addEventListener('click', closeDemo);
nodes.previous.addEventListener('click', () => moveDemo(-1));
nodes.next.addEventListener('click', () => moveDemo(1));
nodes.locale.addEventListener('click', (event) => {
  const link = event.target.closest('[data-lang]');
  if (!link || link.dataset.lang === language) return;
  event.preventDefault();
  savedLesson = activeModule?.snapshot?.() ?? null;
  language = link.dataset.lang;
  const url = new URL(globalThis.location.href);
  url.searchParams.set('lang', language);
  globalThis.history.replaceState(null, '', url);
  renderLocale();
  renderGallery();
  route();
});
globalThis.addEventListener('hashchange', route);
globalThis.addEventListener('site-theme-change', () => {
  renderGallery();
});
globalThis.addEventListener('pagehide', () => {
  disposeActive();
  disposePreviews();
}, { once: true });
document.addEventListener('keydown', (event) => {
  if (nodes.demo.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement
    && (target.matches('input, select, textarea') || target.isContentEditable)) return;
  const key = event.key.toLowerCase();
  if (key === 'q' || key === 'й') closeDemo();
  else if (event.key === 'ArrowLeft') moveDemo(-1);
  else if (event.key === 'ArrowRight') moveDemo(1);
  else return;
  event.preventDefault();
});

renderLocale();
renderGallery();
route();

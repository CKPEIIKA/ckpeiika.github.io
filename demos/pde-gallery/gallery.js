// Catalogue + in-place experiment page shared by the PDE lecture galleries.
// A lecture supplies its catalog, its model factory and a few titles; see startGallery().

import { Board } from './board.js';
import { renderTexElement } from '../../lib/chalkish/src/tex-element.js';
import { bindControlsSheet } from '../controls-sheet.js';
import { thumbnailCommands } from './thumbnails.js';
import { bindHelpDialog, bindKeys, renderKeyHelp } from '../keys.js';
import { bindLocaleSwitch, pageLanguage } from '../locale.js';

const UI = {
  'mobile-board-hint': ['↔ Доску можно прокручивать по горизонтали', '↔ Scroll the board horizontally to see both panels'],
  'catalogue-label': ['ИНТЕРАКТИВНЫЙ КАТАЛОГ', 'INTERACTIVE CATALOGUE'],
  'catalogue-count-label': ['опытов<br>с объяснениями', 'explained<br>experiments'],
  'catalogue-help': ['Нажмите на карточку. Опыт откроется здесь же. Esc — вернуться в каталог.', 'Select a card to open the experiment here. Esc returns to the catalogue.'],
  'control-heading': ['УСЛОВИЯ ОПЫТА', 'EXPERIMENT PARAMETERS'],
  'preset-heading': ['ПОПРОБУЙТЕ', 'TRY THESE'],
  'defaults': ['Параметры по умолчанию', 'Default parameters'],
  'question-heading': ['Что проверить?', 'What should you investigate?'],
  'math-heading': ['Математика опыта', 'Mathematical explanation'],
  'assumptions-heading': ['Соглашения и ограничения', 'Conventions and limitations'],
  'sources-heading': ['Источники и идеи', 'Sources and ideas'],
  'step': ['Шаг', 'Step'],
  'reset': ['↺ Сброс', '↺ Reset'],
  'speed-label': ['шаг/с', 'steps/s'],
};

export function quantize(value, control) {
  const { min, max, step } = control;
  const snapped = min + Math.round((Number(value) - min) / step) * step;
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(10));
}

// Restores ?state={"id":…,"p":{…}} for one experiment, accepting only values its controls allow.
export function paramsFromState(demo, base, stateText) {
  const params = { ...base };
  if (!stateText) return params;
  let data;
  try {
    data = JSON.parse(stateText);
  } catch (error) {
    console.warn('Ignoring malformed ?state parameter', error);
    return params;
  }
  if (data?.id !== demo.id) return params;
  for (const control of demo.controls) {
    const value = data.p?.[control.key];
    if (control.type === 'range' && typeof value === 'number' && Number.isFinite(value)) {
      params[control.key] = quantize(value, control);
    } else if (control.type === 'select' && control.options.some((option) => option.value === value)) {
      params[control.key] = value;
    }
  }
  if (Array.isArray(data.p?.nodes)) {
    const nodes = data.p.nodes.filter((v) => Number.isInteger(v) && Math.abs(v) <= 3);
    params.nodes = [...new Set(nodes)].sort((a, b) => a - b);
  }
  return params;
}

/**
 * @param {object} config
 * @param {{demos, groups, sources, defaults, translate}} config.catalog
 * @param {(id: string, params: object, lang: string) => object} config.createModel
 * @param {[string, string]} config.lecture   e.g. ['Лекция 4', 'Lecture 4']
 * @param {[string, string]} config.subtitle
 * @param {{[id: string]: [string, string]}} config.text  lecture-specific catalogue copy
 * @param {string} config.debugName  read-only diagnostics global for browser tests
 * @param {{catalog: URL, labs: URL}} [config.modules]  module files, for the thumbnail worker
 * @param {{[file: string]: string}} [config.notes]  plain-text notes shown in a dialog for links to these files
 * @param {(demo, key, params) => void} [config.onControlChange]  lecture-specific parameter coupling
 * @param {(host: HTMLElement, demo) => {dispose()}} [config.preview]  draws a catalogue picture itself
 *        (for lectures whose experiments are live scenes rather than board commands)
 *
 * A model is either a board model (render() returns { ink, … }) or a live model with
 * mount(stage, { redraw, pause }) that draws its own scene; see demos/README.md.
 */
export function startGallery(config) {
  const { catalog, createModel } = config;
  const { demos, groups, sources, defaults, translate } = catalog;
  const $ = (id) => document.getElementById(id);
  const ui = { ...UI, ...config.text };
  const notes = config.notes ?? {};
  const states = new Map();
  let lang = pageLanguage();
  let filter = -1, active = null, model = null, board = null, params = {}, lastView = null;
  let writeIn = false; // the next draw writes the board in (only when an experiment opens)
  let playing = false, accumulator = 0, lastFrame = 0, raf = 0, galleryBoards = [], lastGalleryScroll = 0;
  let thumbnailQueue = [], thumbnailTimer = 0, thumbnailWorker = null, liveFrames = 0;
  const controlRows = new Map();

  const T = (value) => translate(value, lang);
  const L = (ru, en) => (lang === 'en' ? en : ru);
  const makeModel = (id, p) => createModel(id, p, lang);
  const isLive = () => typeof model?.mount === 'function';
  const pageTitle = () => `${T(config.lecture)} · ${T(config.subtitle)}`;
  const sheet = bindControlsSheet({
    toggle: $('sheet-toggle'),
    root: document.querySelector('.lab-layout'),
    label: (collapsed) => (collapsed ? L('Показать параметры', 'Show parameters') : L('Скрыть параметры', 'Hide parameters')),
  });

  function setLanguage() {
    document.documentElement.lang = lang;
    document.title = pageTitle();
    $('page-title').textContent = pageTitle();
    document.querySelector('.demo-home').setAttribute('aria-label', L('К странице курса', 'Course page'));
    document.querySelector('.demo-home-label').textContent = L('к странице курса', 'course page');
    document.querySelector('[data-locale-switch]').setAttribute('aria-label', L('Язык', 'Language'));
    // UI strings are fixed markup from this file and the lecture config, never user input.
    for (const [id, s] of Object.entries(ui)) $(id).innerHTML = T(s);
    $('catalogue-count').textContent = String(demos.length);
    $('previous').setAttribute('aria-label', L('Предыдущий опыт', 'Previous experiment'));
    $('next').setAttribute('aria-label', L('Следующий опыт', 'Next experiment'));
    $('close-demo').setAttribute('aria-label', L('Вернуться в каталог', 'Return to catalogue'));
    $('fullscreen').title = L('Полный экран', 'Full screen');
    const helpButton = document.querySelector('[data-help-toggle]');
    helpButton?.setAttribute('aria-label', L('Справка', 'Help'));
    helpButton?.setAttribute('title', L('Справка', 'Help'));
    sheet.sync();
  }

  // Equations: { tex } or { tex: [ru, en] } are chalk TeX (lib/chalkish/src/tex.js);
  // [ru, en] is plain text; a string is fixed markup from the catalog file.
  let equationTex = null, equationKey = null;
  function showEquation(value) {
    const tex = value && typeof value === 'object' && !Array.isArray(value) ? T(value.tex) : null;
    const key = JSON.stringify([tex ?? value, lang]);
    if (key === equationKey) return; // draw() runs every step; redraw only on change
    equationKey = key;
    const bar = $('equation');
    if (tex !== null) {
      if (equationTex) equationTex.update(tex);
      else equationTex = renderTexElement(bar, tex);
      return;
    }
    equationTex?.dispose();
    equationTex = null;
    bar.setAttribute('aria-label', L('Уравнение', 'Equation'));
    if (Array.isArray(value)) bar.textContent = T(value);
    else if (typeof value === 'string') bar.innerHTML = value;
    else bar.textContent = '';
  }

  // Thumbnails never block the page: a module worker computes them when the lecture names its
  // module files (config.modules); otherwise one is computed per idle slot, paused while an
  // experiment is open.
  function startThumbnailWorker(boards) {
    thumbnailWorker?.terminate();
    thumbnailWorker = null;
    if (!config.modules || typeof Worker !== 'function') return false;
    try {
      const worker = new Worker(new URL('./thumbnail-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data.error) console.error(`Thumbnail for ${data.id} failed`, data.error);
        else boards.get(data.id)?.render(data.cmd);
      };
      worker.onerror = (event) => {
        console.warn('Thumbnail worker unavailable; computing thumbnails on the page', event.message);
        event.preventDefault();
        worker.terminate();
        if (thumbnailWorker === worker) thumbnailWorker = null;
        scheduleThumbnails();
      };
      worker.postMessage({ catalogUrl: String(config.modules.catalog), labsUrl: String(config.modules.labs), lang });
      thumbnailWorker = worker;
      return true;
    } catch (error) {
      console.warn('Thumbnail worker unavailable; computing thumbnails on the page', error);
      return false;
    }
  }

  function scheduleThumbnails() {
    if (thumbnailWorker) return;
    if (thumbnailTimer || thumbnailQueue.length === 0 || active) return;
    const run = () => {
      thumbnailTimer = 0;
      if (active) return;
      thumbnailQueue.shift()?.();
      scheduleThumbnails();
    };
    thumbnailTimer = globalThis.requestIdleCallback ? requestIdleCallback(run, { timeout: 250 }) : setTimeout(run, 16);
  }

  function buildGallery() {
    for (const b of galleryBoards) b.destroy();
    galleryBoards = [];
    thumbnailQueue = [];
    const boards = new Map();
    $('catalogue-grid').replaceChildren();
    $('filters').replaceChildren();
    $('filters').hidden = groups.length < 2;
    const addFilter = (n, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.className = n === filter ? 'active' : '';
      b.setAttribute('aria-pressed', String(n === filter));
      b.onclick = () => { filter = n; buildGallery(); };
      $('filters').append(b);
    };
    addFilter(-1, L('Все опыты', 'All experiments'));
    groups.forEach((g, i) => addFilter(i, T(g)));
    demos.forEach((d, i) => {
      if (filter !== -1 && d.group !== filter) return;
      const card = document.createElement('button');
      card.className = 'demo-card';
      card.type = 'button';
      card.dataset.demo = d.id;
      card.setAttribute('aria-label', `${i + 1}. ${T(d.title)}`);
      const image = document.createElement('div');
      image.className = 'thumbnail';
      image.setAttribute('aria-hidden', 'true');
      const text = document.createElement('div');
      text.className = 'card-text';
      const num = document.createElement('span');
      num.className = 'card-num';
      num.textContent = String(i + 1).padStart(2, '0');
      const words = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = T(d.title);
      const short = document.createElement('p');
      short.className = 'card-short';
      short.textContent = T(d.short);
      const group = document.createElement('span');
      group.className = 'card-group';
      group.textContent = T(groups[d.group]);
      words.append(title, short, group);
      text.append(num, words);
      card.append(image, text);
      card.onclick = () => { lastGalleryScroll = scrollY; location.hash = d.id; };
      $('catalogue-grid').append(card);
      if (config.preview) {
        try {
          const preview = config.preview(image, d);
          galleryBoards.push({ destroy: () => preview.dispose() });
        } catch (error) {
          console.error(`Preview for ${d.id} failed`, error);
        }
        return;
      }
      const b = new Board(image, { preview: true });
      galleryBoards.push(b);
      boards.set(d.id, b);
      thumbnailQueue.push(() => {
        try {
          b.render(thumbnailCommands(catalog, createModel, d, lang));
        } catch (error) {
          console.error(`Thumbnail for ${d.id} failed`, error);
        }
      });
    });
    if (!config.preview && !startThumbnailWorker(boards)) scheduleThumbnails();
  }

  // A live model may take a new parameter without restarting (setParameter returns true).
  function applyChange(control, value) {
    params[control.key] = value;
    config.onControlChange?.(active, control.key, params);
    if (isLive() && model.setParameter?.(control.key, value, params) === true) {
      states.set(active.id, structuredClone(params));
      syncControls();
      draw();
    } else {
      restart(false);
    }
  }

  function buildControls() {
    $('controls').replaceChildren();
    $('presets').replaceChildren();
    controlRows.clear();
    for (const c of active.controls) {
      const row = document.createElement('div');
      row.className = c.type === 'toggle' ? 'control control-toggle' : 'control';
      const label = document.createElement('label');
      label.htmlFor = 'control-' + c.key;
      label.textContent = T(c.label);
      row.append(label);
      if (c.type === 'range') {
        const wrap = document.createElement('div');
        wrap.className = 'control-row';
        const slider = document.createElement('input'), number = document.createElement('input');
        slider.type = 'range';
        number.type = 'number';
        slider.id = 'control-' + c.key;
        number.id = 'number-' + c.key;
        for (const el of [slider, number]) {
          el.min = c.min; el.max = c.max; el.step = c.step; el.value = params[c.key]; el.dataset.key = c.key;
        }
        number.setAttribute('aria-label', T(c.label));
        const set = (value) => {
          if (!Number.isFinite(Number(value))) return;
          const v = quantize(value, c);
          slider.value = number.value = v;
          applyChange(c, v);
        };
        slider.addEventListener('input', () => set(slider.value));
        number.addEventListener('change', () => set(number.value));
        wrap.append(slider, number);
        row.append(wrap);
      } else if (c.type === 'toggle') {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = 'control-' + c.key;
        box.checked = params[c.key] !== false;
        box.onchange = () => applyChange(c, box.checked);
        row.append(box);
      } else {
        const select = document.createElement('select');
        select.id = 'control-' + c.key;
        select.dataset.key = c.key;
        for (const o of c.options) {
          const option = document.createElement('option');
          option.value = o.value;
          option.textContent = T(o.label);
          select.append(option);
        }
        select.value = params[c.key];
        select.onchange = () => applyChange(c, c.options.find((o) => String(o.value) === select.value).value);
        row.append(select);
      }
      if (c.help) {
        const help = document.createElement('small');
        help.className = 'control-help';
        help.textContent = T(c.help);
        row.append(help);
      }
      controlRows.set(c.key, row);
      $('controls').append(row);
    }
    for (const preset of active.presets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.textContent = T(preset.label);
      b.onclick = () => { params = { ...defaults(active), ...structuredClone(preset.values) }; buildControls(); restart(false); };
      $('presets').append(b);
    }
    syncControls();
  }

  function syncControls() {
    for (const c of active.controls) {
      for (const id of ['control-', 'number-']) {
        const el = $(id + c.key);
        if (!el) continue;
        if (c.type === 'toggle') el.checked = params[c.key] !== false;
        else el.value = params[c.key];
      }
      // Some controls only matter in some modes (e.g. a flux only for a flux boundary).
      const row = controlRows.get(c.key);
      if (row) row.hidden = active.visible ? !active.visible(c.key, params) : false;
    }
  }

  function setPlayback() {
    const dynamic = Boolean(active?.dynamic);
    $('play').hidden = $('step').hidden = $('speed-wrapper').hidden = !dynamic;
    $('play').textContent = playing ? L('❚❚ Пауза', '❚❚ Pause') : '▶ ' + T(active?.action ?? ['Пуск', 'Play']);
    $('step').textContent = T(active?.stepLabel ?? ['Шаг', 'Step']);
    $('play').setAttribute('aria-pressed', String(playing));
    $('step').disabled = Boolean(model?.stop);
    $('play').disabled = Boolean(model?.stop);
    $('tool').hidden = !model?.tool;
    if (model?.tool) {
      $('tool').textContent = '✎ ' + T(model.tool.label);
      $('tool').setAttribute('aria-pressed', String(Boolean(model.toolActive)));
    }
    // Live scenes run in continuous time: the slider scales it (24 = 1×) instead of counting steps.
    const live = isLive();
    $('speed-label').textContent = live ? L('скорость', 'speed') : L('шаг/с', 'steps/s');
    $('speed-value').textContent = live ? `${(Number($('speed').value) / 24).toFixed(2)}×` : $('speed').value;
  }

  function draw() {
    if (!model || (!board && !isLive())) return;
    try {
      lastView = model.render();
      showEquation(lastView.equation ? (typeof lastView.equation === 'string' ? [lastView.equation, lastView.equation] : lastView.equation) : active.equation);
      if (lastView.ink) board?.render(lastView.ink, { write: writeIn });
      writeIn = false;
      if (isLive()) syncControls(); // live scenes move params themselves (e.g. the time slider)
      $('equation-caption').textContent = lastView.caption ?? '';
      $('equation-caption').hidden = !lastView.caption;
      $('metrics').replaceChildren();
      for (const [label, value] of lastView.stats) {
        const m = document.createElement('div');
        m.className = 'metric';
        const a = document.createElement('span');
        a.className = 'metric-label';
        a.textContent = label;
        const b = document.createElement('span');
        b.className = 'metric-value';
        b.textContent = value;
        m.append(a, b);
        $('metrics').append(m);
      }
      if (lastView.note) {
        $('status').textContent = lastView.note;
        $('status').className = lastView.warning ? 'warning' : '';
      }
      if (model.stop) {
        playing = false;
        $('status').textContent = model.stop === '■'
          ? L('Конец показанного интервала. Сбросьте опыт для нового запуска.', 'End of displayed interval. Reset the experiment to run it again.')
          : model.stop;
        $('status').className = 'warning';
      }
      setPlayback();
    } catch (e) {
      playing = false;
      console.error(e);
      $('status').textContent = L('Ошибка опыта: ', 'Experiment error: ') + e.message;
      $('status').className = 'warning';
      setPlayback();
    }
  }

  function restart() {
    playing = false;
    accumulator = 0;
    model?.dispose?.();
    model = makeModel(active.id, params);
    if (isLive()) {
      board?.destroy();
      board = null;
      model.mount($('stage'), { redraw: () => draw(), pause: () => { playing = false; setPlayback(); } });
    } else if (!board) {
      board = new Board($('stage'));
    }
    states.set(active.id, structuredClone(params));
    syncControls();
    $('status').className = '';
    $('status').textContent = model.hint ?? (active.dynamic
      ? L('Параметры изменяют задачу; новый опыт начинается с t = 0. Пробел — пуск, N — шаг.', 'Changing parameters starts a new problem at t = 0. Space: play; N: step.')
      : model.click || model.paint
        ? L('Можно взаимодействовать с рисунком: нажмите на узел или ячейку.', 'Interact with the diagram: click a node or a cell.')
        : L('Изменяйте параметры и сравнивайте фактические значения.', 'Change the parameters and compare the computed values.'));
    draw();
  }

  function loadParams(d) {
    const base = { ...defaults(d), ...(states.get(d.id) || {}) };
    return paramsFromState(d, base, new URLSearchParams(location.search).get('state'));
  }

  function dispose() {
    playing = false;
    model?.dispose?.();
    board?.destroy();
    board = null;
    model = null;
    lastView = null;
    accumulator = 0;
  }

  function route() {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      id = ''; // A malformed hash simply shows the catalogue.
    }
    const d = demos.find((x) => x.id === id);
    dispose();
    active = d || null;
    document.body.classList.toggle('lab-active', Boolean(d));
    $('catalogue').hidden = Boolean(d);
    $('demo-view').hidden = !d;
    if (!d) {
      document.title = pageTitle();
      requestAnimationFrame(() => scrollTo(0, lastGalleryScroll));
      scheduleThumbnails();
      return;
    }
    params = loadParams(d);
    $('demo-title').textContent = T(d.title);
    $('demo-section').textContent = T(groups[d.group]);
    $('demo-number').textContent = String(demos.indexOf(d) + 1).padStart(2, '0');
    document.title = T(d.title) + ' · ' + T(config.lecture);
    showEquation(d.equation);
    $('question').textContent = T(d.question);
    $('explanation').textContent = T(d.explanation);
    $('caveat').textContent = T(d.caveat);
    $('demo-sources').replaceChildren();
    $('demo-sources').closest('details').hidden = d.sources.length === 0;
    for (const key of d.sources) {
      const s = sources[key], a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.label + ' ↗';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      $('demo-sources').append(a);
    }
    const stage = $('stage');
    stage.onclick = (e) => {
      if (!board || !model?.click) return;
      const [x, y] = board.point(e);
      if (model.click(x, y)) { states.set(d.id, structuredClone(params)); syncControls(); draw(); }
    };
    stage.onpointerdown = (e) => {
      if (!board || !model?.paint) return;
      const [x, y] = board.point(e);
      if (model.paint(x, y)) { states.set(d.id, structuredClone(params)); playing = false; stage.setPointerCapture(e.pointerId); draw(); }
    };
    stage.onpointermove = (e) => {
      if (!board || e.buttons !== 1 || !model?.paint || !stage.hasPointerCapture(e.pointerId)) return;
      const [x, y] = board.point(e);
      if (model.paint(x, y)) { states.set(d.id, structuredClone(params)); draw(); }
    };
    $('speed').value = d.speed ?? 24;
    buildControls();
    writeIn = true;
    restart();
    $('controls-panel').scrollTop = 0;
    scrollTo(0, 0);
  }

  function changeDemo(delta) {
    if (!active) return;
    location.hash = demos[(demos.indexOf(active) + delta + demos.length) % demos.length].id;
  }

  $('previous').onclick = () => changeDemo(-1);
  $('next').onclick = () => changeDemo(1);
  $('close-demo').onclick = () => { location.hash = ''; };
  $('defaults').onclick = () => { params = defaults(active); buildControls(); restart(); };
  $('reset').onclick = () => restart();
  $('play').onclick = () => {
    if (!(model?.step || model?.advance) || model.stop) return;
    playing = !playing;
    accumulator = 0;
    setPlayback();
  };
  $('step').onclick = () => { playing = false; model?.step?.(); draw(); };
  $('speed').oninput = () => setPlayback();
  $('tool').onclick = () => {
    if (!model?.setTool) return;
    playing = false;
    model.setTool(!model.toolActive);
    setPlayback();
    draw();
  };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $('demo-view').requestFullscreen();
    } catch (error) {
      console.warn(error);
      $('status').textContent = L('Браузер не разрешил полноэкранный режим.', 'The browser did not allow fullscreen mode.');
    }
  };
  // Links to a lecture's notes (e.g. ./SOURCES.md) open the bundled text instead of a raw file.
  let notesDialog = null;
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a');
    const key = (link?.getAttribute('href') ?? '').split('/').pop();
    if (!link || !Object.hasOwn(notes, key)) return;
    e.preventDefault();
    if (!notesDialog) {
      notesDialog = document.createElement('dialog');
      notesDialog.className = 'docs-dialog';
      document.body.append(notesDialog);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', L('Закрыть', 'Close'));
    close.onclick = () => notesDialog.close();
    const title = document.createElement('h2');
    title.textContent = key;
    const text = document.createElement('pre');
    text.textContent = notes[key];
    notesDialog.replaceChildren(close, title, text);
    notesDialog.showModal();
    notesDialog.scrollTop = 0;
  });

  bindLocaleSwitch(() => lang, (next) => {
    if (active) states.set(active.id, structuredClone(params));
    lang = next;
    setLanguage();
    buildGallery();
    route();
  });

  function frame(now) {
    const elapsed = Math.min(0.15, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    if (playing && model?.advance) {
      model.advance(elapsed * Number($('speed').value) / 24);
      if (model.stop) playing = false;
      liveFrames += 1;
      if (liveFrames % 6 === 0 || !playing) draw();
      else model.render();
    } else if (playing && model?.step) {
      accumulator += elapsed * Number($('speed').value);
      let updated = false;
      while (accumulator >= 1 && playing) {
        accumulator--;
        model.step();
        updated = true;
        if (model.stop) playing = false;
      }
      if (updated) draw();
    }
    raf = requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) { playing = false; setPlayback(); } });
  window.addEventListener('hashchange', route);
  // Shared keys (../keys.js). An action returns false when it does not apply, leaving the key alone.
  const keyActions = {
    play: () => (model?.step && !model.stop ? $('play').click() : false),
    step: () => (model?.step ? $('step').click() : false),
    reset: () => (active ? restart() : false),
    previous: () => (active ? changeDemo(-1) : false),
    next: () => (active ? changeDemo(1) : false),
    back: () => (active && !document.fullscreenElement ? (location.hash = '') : false),
    help: () => toggleHelp(),
  };
  const helpDialog = document.createElement('dialog');
  helpDialog.className = 'docs-dialog help-dialog';
  document.body.append(helpDialog);
  const toggleHelp = bindHelpDialog(helpDialog, () => {
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', L('Закрыть', 'Close'));
    close.onclick = () => helpDialog.close();
    const title = document.createElement('h2');
    title.textContent = L('Как пользоваться', 'How to use this page');
    const steps = [
      L('Выберите карточку: опыт откроется здесь же, фильтры сверху сужают каталог.', 'Pick a card: the experiment opens in place; the filters above narrow the catalogue.'),
      L('Слева — условия опыта (на телефоне — под доской). «Попробуйте» задаёт готовые наборы.', 'Parameters are on the left (below the board on a phone). “Try these” sets prepared cases.'),
      L('Опыты во времени запускаются кнопкой «Пуск» или шагом; изменение условий начинает задачу заново.', 'Time-dependent experiments run with Play or step by step; changing parameters starts a new problem.'),
      L('Если внизу есть подсказка про рисунок, на доску можно нажимать; кнопка ✎ включает рисование.', 'When the hint below the board says so, you can click the board; the ✎ button turns drawing on.'),
    ];
    const list = document.createElement('ul');
    list.append(...steps.map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    const keysTitle = document.createElement('h3');
    keysTitle.textContent = L('Клавиши', 'Keys');
    const keys = document.createElement('dl');
    keys.className = 'key-help';
    renderKeyHelp(keys, lang, keyActions);
    helpDialog.replaceChildren(close, title, list, keysTitle, keys);
  });
  bindKeys(keyActions);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(raf);
    dispose();
    for (const b of galleryBoards) b.destroy();
    thumbnailWorker?.terminate();
  });

  setLanguage();
  buildGallery();
  route();
  raf = requestAnimationFrame(frame);

  // Read-only diagnostics for reproducibility and automated browser tests.
  Object.defineProperty(window, config.debugName, {
    value: {
      get id() { return active?.id ?? null; },
      get engine() { return board?.engine ?? (isLive() ? 'chalkish' : null); },
      get params() { return structuredClone(params); },
      get time() { return model?.time ?? 0; },
      get count() { return model?.count ?? 0; },
      get stats() { return lastView?.stats ?? []; },
      get commands() { return lastView?.ink.cmd ?? []; },
      get rows() { return lastView?.rows ?? []; },
      get stop() { return model?.stop ?? ''; },
      get running() { return playing; },
      get ids() { return demos.map((d) => d.id); },
      get renderError() { return board?.renderError ?? null; },
    },
  });
}

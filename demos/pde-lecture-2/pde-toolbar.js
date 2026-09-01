const COPY = Object.freeze({
  ru: Object.freeze({
    pause: 'Приостановить',
    play: 'Продолжить',
    restart: 'Начать заново',
    speed: 'Скорость времени',
    draw: 'Задавать поле мышью',
    inject: 'Сообщить импульс мышью',
    fullscreen: 'На весь экран',
    leaveFullscreen: 'Выйти из полноэкранного режима',
  }),
  en: Object.freeze({
    pause: 'Pause',
    play: 'Continue',
    restart: 'Restart',
    speed: 'Time speed',
    draw: 'Draw field with pointer',
    inject: 'Inject momentum with pointer',
    fullscreen: 'Enter fullscreen',
    leaveFullscreen: 'Leave fullscreen',
  }),
});

const ICONS = Object.freeze({
  pause: Object.freeze(['M7.2 5.2L7 18.8', 'M16.8 5L17.1 19']),
  restart: Object.freeze(['M5 9.2A7.7 7.7 0 1 1 5.8 16.2', 'M4.8 4.7L4.9 9.5L9.5 9.1']),
  draw: Object.freeze([
    'M7.1 11.4V7.1C7.1 5.8 9 5.7 9 7V10.1V5.6C9 4.2 11 4.2 11 5.6V10V6.3C11 4.9 13 4.9 13 6.3V10.4V7.6C13 6.2 15 6.2 15 7.6V12.1L17.1 10.5C18.5 9.5 19.9 11.2 18.8 12.5L15.4 17.4C14.2 19.1 12.4 20 10.4 20H9.3C7.3 20 5.8 19.1 4.7 17.5L2.8 14.4C2 13.1 3.7 11.8 4.7 13L7.1 15.2',
  ]),
  fullscreen: Object.freeze([
    'M4.2 9V4.2H9',
    'M15 4.2H19.8V9',
    'M19.8 15V19.8H15',
    'M9 19.8H4.2V15',
  ]),
});

function icon(paths, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('pde-tool-icon');
  if (className) svg.classList.add(className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const definition of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', definition);
    svg.append(path);
  }
  return svg;
}

function toolButton(paths, label, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pde-tool ${className}`.trim();
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.append(icon(paths));
  return button;
}

function setLabel(element, label) {
  element.setAttribute('aria-label', label);
  element.setAttribute('title', label);
}

export function createPdeToolbar(shell, language, options = {}) {
  const copy = COPY[language] ?? COPY.ru;
  const animated = options.animated !== false;
  const pause = animated ? toolButton(ICONS.pause, copy.pause, 'pde-pause-tool') : null;
  if (pause) {
    const play = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    play.classList.add('pde-play-glyph');
    play.setAttribute('d', 'M8 5.2L18.5 12.1L8.1 18.8Z');
    pause.querySelector('svg').append(play);
  }

  const restart = toolButton(ICONS.restart, copy.restart);
  const speed = animated ? document.createElement('label') : null;
  let speedSelect = null;
  if (speed) {
    speed.className = 'pde-tool pde-speed-tool';
    speed.setAttribute('title', copy.speed);
    speed.append(icon(['M4.2 17.3A8 8 0 0 1 19.8 17.1', 'M12 16L16.3 10.1']));
    speedSelect = document.createElement('select');
    speedSelect.setAttribute('aria-label', copy.speed);
    for (const value of [0.25, 0.5, 1, 2]) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = `${value}\u00d7`;
      option.selected = value === 1;
      speedSelect.append(option);
    }
    speed.append(speedSelect);
  }

  const drawLabel = options.inject ? copy.inject : copy.draw;
  const draw = options.drawable ? toolButton(ICONS.draw, drawLabel) : null;
  if (draw) draw.setAttribute('aria-pressed', 'false');
  const fullscreen = toolButton(ICONS.fullscreen, copy.fullscreen);
  fullscreen.classList.add('pde-fullscreen-tool');

  shell.stageTools.append(...[pause, restart, speed, draw, fullscreen].filter(Boolean));

  function syncFullscreen() {
    const active = document.fullscreenElement === shell.board;
    fullscreen.setAttribute('aria-pressed', String(active));
    setLabel(fullscreen, active ? copy.leaveFullscreen : copy.fullscreen);
  }

  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === shell.board) await document.exitFullscreen();
      else await shell.board.requestFullscreen();
    } catch (error) {
      console.error(error);
    }
  });
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();

  return Object.freeze({
    pause,
    restart,
    speed: speedSelect,
    draw,
    readout: shell.stageReadout,
    setPaused(paused) {
      if (!pause) return;
      pause.setAttribute('aria-pressed', String(paused));
      setLabel(pause, paused ? copy.play : copy.pause);
    },
    dispose() {
      document.removeEventListener('fullscreenchange', syncFullscreen);
    },
  });
}

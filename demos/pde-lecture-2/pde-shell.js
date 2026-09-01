import { localized } from './catalog.js';

function element(name, className = '', text = '') {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createPdeShell(host, entry, language) {
  const shell = element('section', 'pde-shell');
  const board = element('div', 'pde-board');
  const concept = element('header', 'pde-concept');
  const equation = element('p', 'pde-equation', entry.equation);
  const meaning = element('p', 'pde-meaning', localized(entry.meaning, language));
  concept.append(equation, meaning);

  const stage = element('div', 'pde-stage');
  const controls = element('aside', 'pde-controls');
  controls.setAttribute('aria-label', language === 'ru' ? 'Параметры задачи' : 'Problem parameters');

  const stageFooter = element('footer', 'pde-stage-footer');
  stageFooter.setAttribute(
    'aria-label',
    language === 'ru' ? 'Управление демонстрацией' : 'Demo controls',
  );
  const stageTools = element('div', 'pde-stage-tools');
  const stageReadout = element('output', 'pde-stage-readout');
  stageReadout.setAttribute('aria-live', 'polite');
  stageFooter.append(stageTools, stageReadout);

  const notice = element('footer', 'pde-notice');
  const noticeTitle = element(
    'strong',
    '',
    language === 'ru' ? 'На что обратить внимание' : 'What should you notice',
  );
  const prompt = element('span', '', localized(entry.prompt, language));
  notice.append(noticeTitle, prompt);
  board.append(concept, stage, stageFooter, notice);
  shell.append(controls, board);
  host.replaceChildren(shell);
  return Object.freeze({
    shell,
    board,
    concept,
    equation,
    meaning,
    stage,
    stageFooter,
    stageTools,
    stageReadout,
    controls,
    notice,
    prompt,
  });
}

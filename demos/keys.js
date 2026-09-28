// One keyboard map for every demo. A page binds the actions it supports; its help dialog
// lists exactly those keys, so the help can never disagree with the behaviour.

export const KEY_MAP = Object.freeze([
  { action: 'play', keys: [' '], label: 'Space', text: ['пуск / пауза', 'play / pause'] },
  { action: 'step', keys: ['n', 'т'], label: 'N', text: ['один шаг', 'one step'] },
  { action: 'reset', keys: ['r', 'к'], label: 'R', text: ['сброс', 'reset'] },
  { action: 'previous', keys: ['arrowleft'], label: '←', text: ['предыдущий опыт', 'previous experiment'] },
  { action: 'next', keys: ['arrowright'], label: '→', text: ['следующий опыт', 'next experiment'] },
  { action: 'back', keys: ['escape', 'q', 'й'], label: 'Esc / Q', text: ['к каталогу', 'back to the catalogue'] },
  { action: 'help', keys: ['?', ','], label: '?', text: ['справка', 'help'] },
]);

const EDITABLE = /^(INPUT|SELECT|TEXTAREA)$/;

// Pure: which shared action a keydown means, or null. On the Russian layout '?' is Shift+7, and the
// US '?' position (Shift + the key left of right Shift) gives ',' — both open help.
export function actionForEvent(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = String(event.key ?? '').toLowerCase();
  if (key === ',' && !event.shiftKey) return null;
  return KEY_MAP.find((entry) => entry.keys.includes(key))?.action ?? null;
}

// actions: { play() {...}, step() {...}, ... } — only what the page supports.
// extra: page-specific keys { keys: ['g', 'п'], label, text: [ru, en], run(event) }, listed in help after the shared ones.
export function bindKeys(actions, extra = []) {
  function onKey(event) {
    if (EDITABLE.test(event.target?.tagName ?? '') || event.target?.isContentEditable) return;
    const action = actionForEvent(event);
    // An open dialog owns Escape and the keyboard; only help may close it again.
    if (document.querySelector('dialog[open]') && action !== 'help') return;
    if (action && actions[action]) {
      if (actions[action](event) !== false) event.preventDefault();
      return;
    }
    const custom = extra.find((item) => item.keys.includes(String(event.key).toLowerCase()));
    if (custom && !event.ctrlKey && !event.metaKey && !event.altKey) {
      custom.run(event);
      event.preventDefault();
    }
  }
  // A slider, checkbox or dropdown used with the mouse keeps the focus, and then Space and the
  // arrows would move it instead of the demo. Once a pointer changed it, focus returns to the
  // page; a keyboard user who tabs into a control keeps its native keys.
  let pointerControl = null;
  const POINTER_CONTROLS = 'input[type="range"], input[type="checkbox"], select';
  const onPointerDown = (event) => { pointerControl = event.target?.closest?.(POINTER_CONTROLS) ?? null; };
  const onChange = (event) => {
    if (pointerControl && event.target === pointerControl) {
      pointerControl.blur();
      pointerControl = null;
    }
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('keydown', onKey);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('keydown', onKey);
  };
}

// Fills a <dl> with the keys a page supports, in the shared order.
export function renderKeyHelp(list, lang, actions, extra = [], labels = {}) {
  const t = (pair) => pair[lang === 'en' ? 1 : 0];
  const rows = [
    ...KEY_MAP.filter((entry) => actions[entry.action]).map((entry) => [entry.label, labels[entry.action] ?? entry.text]),
    ...extra.map((item) => [item.label, item.text]),
  ];
  list.replaceChildren(...rows.flatMap(([keys, text]) => {
    const term = document.createElement('dt');
    for (const [index, key] of keys.split(' / ').entries()) {
      if (index) term.append(' / ');
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      term.append(kbd);
    }
    const description = document.createElement('dd');
    description.textContent = t(text);
    return [term, description];
  }));
}

// Wires the header's [data-help-toggle] button and the help key to a dialog.
export function bindHelpDialog(dialog, onOpen) {
  const button = document.querySelector('[data-help-toggle]');
  const toggle = () => {
    if (dialog.open) dialog.close();
    else {
      onOpen?.();
      dialog.showModal();
    }
  };
  button?.addEventListener('click', toggle);
  for (const close of dialog.querySelectorAll('[data-help-close]')) close.addEventListener('click', () => dialog.close());
  return toggle;
}

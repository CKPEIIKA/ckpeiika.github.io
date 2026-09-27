// Phone layout shared by the demos: the controls sit in a sheet under the board
// (about 30% of the screen) and one bar hides or shows them. CSS does the layout;
// this only flips `controls-collapsed` on the layout root and keeps the bar's labels right.

// `collapsed` sets the starting state; `onToggle` lets a page remember it when it rebuilds the layout.
export function bindControlsSheet({ toggle, root, label, collapsed: initial = false, onToggle }) {
  let collapsed = initial;

  function sync() {
    root.classList.toggle('controls-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const text = label(collapsed);
    toggle.textContent = `${collapsed ? '▴' : '▾'} ${text}`;
    toggle.setAttribute('aria-label', text);
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    sync();
    onToggle?.(collapsed);
  });

  sync();
  return Object.freeze({
    sync,
    get collapsed() {
      return collapsed;
    },
  });
}

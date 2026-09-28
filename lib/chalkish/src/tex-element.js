// Chalk TeX inside an ordinary page element (an equation bar, a caption): the formula is
// painted on a canvas in the element's own font, size and colour, broken into rows at its
// \quad gaps when the element is narrow, and re-laid out on resize and when fonts load.
// The element keeps a plain-text version as its accessible name.

import { canvasMeasure, layoutTex, paintTex, texToText } from './tex.js';

export function renderTexElement(element, tex, { minScale = 0.7 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.style.maxWidth = '100%';
  element.replaceChildren(canvas);
  element.setAttribute('role', 'math');
  let source = '';
  let lastWidth = -1;

  const draw = () => {
    const style = getComputedStyle(element);
    const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (!(available > 0)) return;
    const context = canvas.getContext('2d');
    const pixels = parseFloat(style.fontSize) || 16;
    const family = style.fontFamily || 'sans-serif';
    const measure = canvasMeasure(context, family);
    let layout = layoutTex(source, measure, { maxWidth: available / pixels });
    // A single piece wider than the element shrinks, to minScale at most; beyond that it
    // is scaled down by the canvas's max-width.
    const scale = Math.max(minScale, Math.min(1, available / (layout.width * pixels)));
    if (scale < 1) layout = layoutTex(source, measure, { maxWidth: available / (pixels * scale) });
    const em = pixels * scale;
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const pad = 0.12 * em;
    const width = Math.ceil(layout.width * em + 2 * pad);
    const height = Math.ceil((layout.ascent + layout.descent) * em + 2 * pad);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    paintTex(context, layout, { x: pad, y: pad + layout.ascent * em, pixels: em, family, color: style.color });
    lastWidth = element.clientWidth;
    // A canvas does not make the browser fetch a web font; ask for it and draw again.
    const font = `${Math.round(em)}px ${family}`;
    if (document.fonts && !document.fonts.check(font, source)) {
      document.fonts.load(font, source).then(
        (faces) => { if (faces.length) draw(); },
        (error) => console.error('Formula font could not be loaded.', error),
      );
    }
  };

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { if (element.clientWidth !== lastWidth) draw(); })
    : null;
  observer?.observe(element);

  const update = (next) => {
    source = String(next);
    element.setAttribute('aria-label', texToText(source));
    draw();
  };
  update(tex);
  return {
    update,
    dispose() {
      observer?.disconnect();
      element.removeAttribute('role');
    },
  };
}

// Chalk formulas: a small TeX subset laid out in the board's handwriting font.
//
// Supported: ^ _ {…}; \frac \dfrac \tfrac \sqrt; accents \bar \overline \underline \hat
// \widehat \tilde \widetilde \vec \dot \ddot; \text \mathrm \operatorname \mathbf;
// \left…\right with ( ) [ ] | \{ \} \langle \rangle and "."; spacing \, \: \; \! \quad
// \qquad \  and ~; Greek letters, common operators, relations and arrows (see SYMBOLS);
// named functions (\sin, \max, \lim, …) and \sum \prod \int \oint; matrices with
// \begin{matrix|pmatrix|bmatrix|vmatrix|cases} … & … \\ … \end{…}. Unicode may be typed
// directly. Anything else throws, so an unsupported formula fails in tests instead of
// drawing wrongly on the board. layoutTex can break a long formula at its top-level
// \quad/\qquad gaps, and texToText gives a readable plain-text version (screen readers).
//
// No imports: the layout is pure (text widths come from a `measure` callback) and
// paintTex needs only a Canvas 2D context, so thumbnails and fallbacks can use it too.
// Layout units are em of the base size; y grows downwards and the baseline is y = 0.

const SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
  varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ',
  Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', emptyset: '∅', ell: 'ℓ',
  hbar: 'ℏ', prime: '′', dagger: '†', star: '⋆', ldots: '…', dots: '…', cdots: '⋯',
  vdots: '⋮', ddots: '⋱', top: '⊤', '{': '{', '}': '}', '%': '%', '#': '#', '&': '&', _: '_', $: '$',
};
const BINARY = {
  pm: '±', mp: '∓', times: '×', cdot: '·', div: '÷', ast: '∗', circ: '∘', cup: '∪',
  cap: '∩', setminus: '∖', oplus: '⊕', otimes: '⊗', wedge: '∧', vee: '∨',
};
const RELATIONS = {
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼',
  simeq: '≃', equiv: '≡', propto: '∝', ll: '≪', gg: '≫', to: '→', rightarrow: '→',
  leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', iff: '⇔',
  implies: '⇒', mapsto: '↦', uparrow: '↑', downarrow: '↓', in: '∈', notin: '∉', ni: '∋',
  subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', perp: '⊥', parallel: '∥',
  mid: '∣', coloneqq: '≔', lesssim: '≲', gtrsim: '≳', asymp: '≍', cong: '≅',
};
const DELIMITERS = {
  langle: '⟨', rangle: '⟩', lvert: '|', rvert: '|', vert: '|', Vert: '‖', '|': '‖',
  lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', lbrace: '{', rbrace: '}', lVert: '‖', rVert: '‖',
};
const BIG_OPERATORS = { sum: '∑', prod: '∏', int: '∫', iint: '∬', oint: '∮', coprod: '∐' };
const LIMIT_OPERATORS = new Set(['sum', 'prod', 'coprod', 'lim', 'max', 'min', 'sup', 'inf']);
const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos',
  'arctan', 'exp', 'log', 'ln', 'lg', 'max', 'min', 'sup', 'inf', 'lim', 'det', 'sgn',
  'arg', 'dim', 'ker', 'deg', 'gcd', 'Re', 'Im',
]);
const SPACES = { ',': 3 / 18, ':': 4 / 18, ';': 5 / 18, '!': -3 / 18, ' ': 0.3, quad: 1, qquad: 2 };
const ACCENTS = new Set(['bar', 'overline', 'underline', 'hat', 'widehat', 'tilde', 'widetilde', 'vec', 'dot', 'ddot']);
const FRACTIONS = new Set(['frac', 'dfrac', 'tfrac']);
const TEXT_COMMANDS = new Set(['text', 'mathrm', 'operatorname', 'textrm']);
const CHAR_CLASS = {
  '+': 'bin', '−': 'bin', '±': 'bin', '×': 'bin', '·': 'bin', '∓': 'bin', '÷': 'bin',
  '=': 'rel', '<': 'rel', '>': 'rel', '≤': 'rel', '≥': 'rel', '≠': 'rel', '≈': 'rel', '→': 'rel',
  ':': 'rel', '(': 'open', '[': 'open', ')': 'close', ']': 'close', ',': 'punct', ';': 'punct',
  '!': 'close', '?': 'close',
};
const OPEN_DELIMITERS = new Set(['(', '[', '{', '⟨', '⌊', '⌈']);
const MATRICES = { matrix: ['', ''], pmatrix: ['(', ')'], bmatrix: ['[', ']'], vmatrix: ['|', '|'], cases: ['{', ''] };

// Glyph box of the handwriting font, in em. Constant so that layout never depends on
// which fallback font happened to load.
const ASCENT = 0.72;
const DESCENT = 0.22;
const AXIS = 0.25;
const RULE = 0.05;

export class TexError extends Error {
  constructor(message, source) {
    super(`${message} in formula "${source}"`);
    this.name = 'TexError';
  }
}

// ---------- parsing ----------

function tokenize(source) {
  const chars = Array.from(source);
  const tokens = [];
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char === '\\') {
      let name = '';
      while (index + 1 < chars.length && /[A-Za-z]/.test(chars[index + 1])) name += chars[++index];
      if (!name) {
        if (index + 1 >= chars.length) throw new TexError('a lone backslash', source);
        name = chars[++index];
      }
      tokens.push({ type: 'command', value: name });
    } else if (/\d/.test(char)) {
      // A decimal number is one glyph run, so it keeps the font's own spacing.
      let number = char;
      while (index + 1 < chars.length && /[\d.]/.test(chars[index + 1])) {
        if (chars[index + 1] === '.' && !/\d/.test(chars[index + 2] ?? '')) break;
        number += chars[++index];
      }
      tokens.push({ type: 'char', value: number });
    } else if (/\s/.test(char)) {
      tokens.push({ type: 'space', value: char });
    } else {
      tokens.push({ type: 'char', value: char });
    }
  }
  return tokens;
}

class Parser {
  constructor(source) {
    this.source = source;
    this.tokens = tokenize(source);
    this.index = 0;
    this.matrixDepth = 0;
  }

  fail(message) {
    throw new TexError(message, this.source);
  }

  peek() {
    return this.tokens[this.index];
  }

  next() {
    return this.tokens[this.index++];
  }

  skipSpaces() {
    while (this.peek()?.type === 'space') this.index += 1;
  }

  // Atoms until the end, a closing brace or a \right.
  parseList(stopAtRight = false) {
    const list = [];
    for (;;) {
      this.skipSpaces();
      const token = this.peek();
      if (!token) break;
      if (token.type === 'char' && token.value === '}') break;
      if (token.type === 'command' && token.value === 'right') {
        if (!stopAtRight) this.fail('\\right without \\left');
        break;
      }
      // Cell and row separators end a list inside a matrix and are errors elsewhere.
      if ((token.type === 'char' && token.value === '&') || (token.type === 'command' && (token.value === '\\' || token.value === 'end'))) {
        if (!this.matrixDepth) this.fail(token.value === 'end' ? '\\end without \\begin' : `${token.value === '&' ? '&' : '\\\\'} outside a matrix`);
        break;
      }
      if (token.type === 'char' && (token.value === '^' || token.value === '_')) {
        const base = list.length && list.at(-1).type !== 'space' ? list.pop() : { type: 'group', body: [] };
        list.push(this.parseScripts(base));
        continue;
      }
      list.push(this.parseAtom());
    }
    return list;
  }

  parseScripts(base) {
    const node = base.type === 'scripts' && !(base.sup && base.sub)
      ? base
      : { type: 'scripts', base, sup: null, sub: null };
    for (;;) {
      this.skipSpaces();
      const token = this.peek();
      if (!(token?.type === 'char' && (token.value === '^' || token.value === '_'))) return node;
      this.next();
      const key = token.value === '^' ? 'sup' : 'sub';
      if (node[key]) this.fail(`double ${key === 'sup' ? 'superscript' : 'subscript'}`);
      node[key] = this.parseArgument();
    }
  }

  parseArgument() {
    this.skipSpaces();
    const token = this.peek();
    if (!token) this.fail('a missing argument');
    if (token.type === 'char' && token.value === '{') return this.parseGroup();
    if (token.type === 'char' && token.value.length > 1) {
      // x^10 means x^{1}0 in TeX; keep that rule rather than guess.
      this.next();
      this.tokens.splice(this.index, 0, { type: 'char', value: token.value.slice(1) });
      return symbol(token.value[0]);
    }
    return this.parseAtom();
  }

  parseGroup() {
    this.next();
    const body = this.parseList();
    const close = this.next();
    if (!(close?.type === 'char' && close.value === '}')) this.fail('a missing }');
    return { type: 'group', body };
  }

  readTextArgument() {
    this.skipSpaces();
    const open = this.next();
    if (!(open?.type === 'char' && open.value === '{')) this.fail('text needs {…}');
    let depth = 1;
    let text = '';
    for (;;) {
      const token = this.next();
      if (!token) this.fail('a missing }');
      if (token.type === 'char' && token.value === '{') depth += 1;
      if (token.type === 'char' && token.value === '}' && --depth === 0) return text;
      text += token.type === 'command' ? (token.value.length === 1 ? token.value : `\\${token.value}`) : token.value;
    }
  }

  readDelimiter() {
    this.skipSpaces();
    const token = this.next();
    if (!token) this.fail('a missing delimiter');
    if (token.type === 'char') {
      if (token.value === '.') return '';
      if ('()[]|/'.includes(token.value)) return token.value;
    } else if (token.value === '{' || token.value === '}') {
      return token.value;
    } else if (DELIMITERS[token.value]) {
      return DELIMITERS[token.value];
    }
    return this.fail(`unsupported delimiter ${token.type === 'command' ? `\\${token.value}` : token.value}`);
  }

  parseMatrix() {
    const env = this.readTextArgument();
    if (!(env in MATRICES)) this.fail(`unsupported environment ${env}`);
    this.matrixDepth += 1;
    const rows = [[]];
    for (;;) {
      rows.at(-1).push({ type: 'group', body: this.parseList() });
      const token = this.next();
      if (!token) this.fail(`\\begin{${env}} without \\end`);
      if (token.type === 'char' && token.value === '&') continue;
      if (token.type === 'command' && token.value === '\\') {
        rows.push([]);
        continue;
      }
      if (token.type === 'command' && token.value === 'end') {
        if (this.readTextArgument() !== env) this.fail(`\\begin{${env}} closed by a different \\end`);
        break;
      }
      this.fail('an unexpected }');
    }
    this.matrixDepth -= 1;
    // A trailing \\ leaves an empty last row.
    if (rows.length > 1 && rows.at(-1).length === 1 && rows.at(-1)[0].body.length === 0) rows.pop();
    return { type: 'matrix', env, rows };
  }

  parseAtom() {
    const token = this.next();
    if (token.type === 'char') {
      if (token.value === '{') {
        this.index -= 1;
        return this.parseGroup();
      }
      if (token.value === '~') return { type: 'space', width: SPACES[' '] };
      if (token.value === '}') this.fail('an unexpected }');
      return symbol(token.value);
    }
    const name = token.value;
    if (name in SPACES) return { type: 'space', width: SPACES[name] };
    if (name in SYMBOLS) return { type: 'symbol', text: SYMBOLS[name], cls: OPEN_DELIMITERS.has(SYMBOLS[name]) ? 'open' : name === '}' ? 'close' : 'ord' };
    if (name in BINARY) return { type: 'symbol', text: BINARY[name], cls: 'bin' };
    if (name in RELATIONS) return { type: 'symbol', text: RELATIONS[name], cls: 'rel' };
    if (name in DELIMITERS) {
      const text = DELIMITERS[name];
      return { type: 'symbol', text, cls: OPEN_DELIMITERS.has(text) ? 'open' : name.startsWith('r') ? 'close' : 'ord' };
    }
    if (name in BIG_OPERATORS) return { type: 'bigop', text: BIG_OPERATORS[name], limits: LIMIT_OPERATORS.has(name) };
    if (FUNCTIONS.has(name)) return { type: 'function', text: name, limits: LIMIT_OPERATORS.has(name) };
    if (FRACTIONS.has(name)) return { type: 'frac', num: this.parseArgument(), den: this.parseArgument() };
    if (name === 'sqrt') return { type: 'sqrt', body: this.parseArgument() };
    if (ACCENTS.has(name)) return { type: 'accent', accent: name, body: this.parseArgument() };
    if (TEXT_COMMANDS.has(name)) {
      const text = this.readTextArgument();
      return name === 'operatorname' ? { type: 'function', text, limits: false } : { type: 'text', text };
    }
    if (name === 'mathbf' || name === 'boldsymbol') return { type: 'bold', body: this.parseArgument() };
    if (name === 'begin') return this.parseMatrix();
    if (name === 'left') {
      const open = this.readDelimiter();
      const body = this.parseList(true);
      const right = this.next();
      if (!(right?.type === 'command' && right.value === 'right')) this.fail('\\left without \\right');
      return { type: 'leftright', open, close: this.readDelimiter(), body };
    }
    return this.fail(`unsupported command \\${name}`);
  }
}

function symbol(text) {
  const value = text === '-' ? '−' : text === '*' ? '∗' : text === "'" ? '′' : text;
  return { type: 'symbol', text: value, cls: CHAR_CLASS[value] ?? 'ord' };
}

export function parseTex(source) {
  if (typeof source !== 'string') throw new TypeError('formula must be a string');
  const parser = new Parser(source);
  const body = parser.parseList();
  if (parser.peek()) parser.fail('an unexpected }');
  return { type: 'group', body };
}

// ---------- layout ----------

function emptyBox() {
  return { width: 0, ascent: 0, descent: 0, items: [] };
}

function place(target, box, dx, dy) {
  for (const item of box.items) {
    if (item.kind === 'glyph') target.items.push({ ...item, x: item.x + dx, y: item.y + dy });
    else target.items.push({ ...item, points: item.points.map((value, index) => value + (index % 2 ? dy : dx)) });
  }
}

function glyph(text, scale, context, { weight = context.weight, y = 0 } = {}) {
  const width = context.measure(text, weight) * scale;
  return {
    width,
    ascent: ASCENT * scale - y,
    descent: DESCENT * scale + y,
    items: [{ kind: 'glyph', text, x: 0, y, size: scale, weight }],
  };
}

function line(points, width) {
  return { kind: 'line', points, width };
}

// Space between atom classes, a simplified version of TeX's table (in em).
function spacing(left, right, scale) {
  if (!left || !right) return 0;
  const tight = scale < 0.9;
  if (left === 'rel' || right === 'rel') return left === right || tight ? 0 : 5 / 18;
  if (left === 'bin' || right === 'bin') return tight ? 0 : 4 / 18;
  if (left === 'punct') return tight ? 0 : 3 / 18;
  if ((left === 'op' && (right === 'ord' || right === 'op' || right === 'inner'))
    || (right === 'op' && left !== 'open')) return 3 / 18;
  if (left === 'inner' || right === 'inner') return tight ? 0 : 1 / 6;
  return 0;
}

// A unary minus or a sign after a relation is an ordinary symbol, as in TeX.
function atomClasses(list) {
  const classes = list.map(nodeClass);
  for (let index = 0; index < classes.length; index += 1) {
    if (classes[index] !== 'bin') continue;
    const previous = classes.slice(0, index).reverse().find(value => value !== null);
    const following = classes.slice(index + 1).find(value => value !== null);
    if (!previous || ['bin', 'rel', 'open', 'punct', 'op'].includes(previous)
      || !following || ['rel', 'close', 'punct'].includes(following)) classes[index] = 'ord';
  }
  return classes;
}

function nodeClass(node) {
  switch (node.type) {
    case 'symbol': return node.cls;
    case 'space': return null;
    case 'bigop':
    case 'function': return 'op';
    case 'scripts': return nodeClass(node.base) === 'op' ? 'op' : 'ord';
    case 'leftright': return 'inner';
    case 'group': return node.body.length === 1 ? nodeClass(node.body[0]) : 'ord';
    default: return 'ord';
  }
}

function layoutList(list, scale, context) {
  const box = emptyBox();
  const classes = atomClasses(list);
  let previous = null;
  for (let index = 0; index < list.length; index += 1) {
    const node = list[index];
    if (node.type === 'space') {
      box.width += node.width * scale;
      continue;
    }
    box.width += spacing(previous, classes[index], scale) * scale;
    const child = layoutNode(node, scale, context);
    place(box, child, box.width, 0);
    box.width += child.width;
    box.ascent = Math.max(box.ascent, child.ascent);
    box.descent = Math.max(box.descent, child.descent);
    previous = classes[index];
  }
  return box;
}

function scriptScale(scale) {
  return Math.max(0.5, scale * 0.7);
}

function layoutScripts(node, scale, context) {
  const base = layoutNode(node.base, scale, context);
  const small = scriptScale(scale);
  const sup = node.sup && layoutNode(node.sup, small, context);
  const sub = node.sub && layoutNode(node.sub, small, context);
  const box = emptyBox();
  const limits = (node.base.type === 'bigop' || node.base.type === 'function') && node.base.limits && scale >= 0.9;
  if (limits) {
    // Limits above and below, centred, as in display-style \sum and \lim.
    const width = Math.max(base.width, sup?.width ?? 0, sub?.width ?? 0);
    place(box, base, (width - base.width) / 2, 0);
    box.width = width;
    box.ascent = base.ascent;
    box.descent = base.descent;
    if (sup) {
      const y = -(base.ascent + 0.1 * scale + sup.descent);
      place(box, sup, (width - sup.width) / 2, y);
      box.ascent = -y + sup.ascent;
    }
    if (sub) {
      const y = base.descent + 0.1 * scale + sub.ascent;
      place(box, sub, (width - sub.width) / 2, y);
      box.descent = y + sub.descent;
    }
    return box;
  }
  place(box, base, 0, 0);
  const supShift = sup ? Math.max(base.ascent - 0.36 * scale, 0.34 * scale) : 0;
  let subShift = sub ? Math.max(base.descent - 0.05 * scale, 0.2 * scale) : 0;
  if (sup && sub) {
    // Glyph boxes are full-height, real script glyphs rarely are: allow the boxes to overlap
    // a little before the subscript is pushed down.
    const gap = (supShift - sup.descent) - (sub.ascent - subShift);
    if (gap < -0.12 * scale) subShift += -0.12 * scale - gap;
  }
  const kern = 0.04 * scale;
  if (sup) place(box, sup, base.width + kern, -supShift);
  if (sub) place(box, sub, base.width + (node.base.type === 'bigop' ? 0 : kern * 0.5), subShift);
  box.width = base.width + Math.max(sup ? sup.width + kern : 0, sub ? sub.width + kern : 0);
  box.ascent = Math.max(base.ascent, sup ? supShift + sup.ascent : 0);
  box.descent = Math.max(base.descent, sub ? subShift + sub.descent : 0);
  return box;
}

function layoutFraction(node, scale, context) {
  const inner = scale >= 0.9 ? scale * 0.85 : Math.max(0.5, scale * 0.75);
  const num = layoutNode(node.num, inner, context);
  const den = layoutNode(node.den, inner, context);
  const axis = AXIS * scale;
  const gap = 0.1 * scale;
  const rule = RULE * scale;
  const pad = 0.1 * scale;
  const width = Math.max(num.width, den.width) + 2 * pad;
  const box = emptyBox();
  const numY = -(axis + rule / 2 + gap + num.descent);
  const denY = -axis + rule / 2 + gap + den.ascent;
  place(box, num, (width - num.width) / 2, numY);
  place(box, den, (width - den.width) / 2, denY);
  box.items.push(line([pad * 0.5, -axis, width - pad * 0.5, -axis], rule));
  box.width = width;
  box.ascent = -numY + num.ascent;
  box.descent = denY + den.descent;
  return box;
}

function layoutRoot(node, scale, context) {
  const body = layoutNode(node.body, scale, context);
  const top = -(Math.max(body.ascent, ASCENT * scale) + 0.12 * scale);
  const bottom = Math.max(body.descent, DESCENT * scale);
  const height = bottom - top;
  const left = 0.52 * scale;
  const box = emptyBox();
  place(box, body, left, 0);
  const end = left + body.width + 0.06 * scale;
  box.items.push(line([
    0, top + 0.62 * height,
    0.1 * scale, top + 0.55 * height,
    0.26 * scale, bottom,
    0.46 * scale, top,
    end, top,
  ], RULE * scale));
  box.width = end + 0.04 * scale;
  box.ascent = -top + RULE * scale;
  box.descent = bottom;
  return box;
}

function layoutAccent(node, scale, context) {
  const body = layoutNode(node.body, scale, context);
  const box = emptyBox();
  place(box, body, 0, 0);
  box.width = body.width;
  box.ascent = body.ascent;
  box.descent = body.descent;
  const stroke = RULE * scale;
  if (node.accent === 'underline') {
    const y = body.descent + 0.08 * scale;
    box.items.push(line([0, y, body.width, y], stroke));
    box.descent = y + stroke;
    return box;
  }
  const y = -(Math.max(body.ascent, 0.5 * scale) + 0.1 * scale);
  const center = body.width / 2;
  const wide = node.accent === 'overline' || node.accent.startsWith('wide');
  const half = wide ? body.width / 2 : Math.min(body.width, 0.5 * scale) / 2;
  const lift = 0.1 * scale;
  switch (node.accent) {
    case 'bar':
    case 'overline':
      box.items.push(line([center - half, y, center + half, y], stroke));
      break;
    case 'hat':
    case 'widehat':
      box.items.push(line([center - half, y, center, y - lift, center + half, y], stroke));
      break;
    case 'tilde':
    case 'widetilde':
      box.items.push(line([center - half, y, center - half / 3, y - lift * 0.8, center + half / 3, y, center + half, y - lift * 0.8], stroke));
      break;
    case 'vec':
      box.items.push(
        line([center - half, y, center + half, y], stroke),
        line([center + half - lift, y - lift * 0.7, center + half, y, center + half - lift, y + lift * 0.7], stroke),
      );
      break;
    case 'dot':
      box.items.push(line([center - 0.01 * scale, y, center + 0.01 * scale, y], stroke * 2));
      break;
    case 'ddot':
      for (const dx of [-0.1 * scale, 0.1 * scale]) {
        box.items.push(line([center + dx - 0.01 * scale, y, center + dx + 0.01 * scale, y], stroke * 2));
      }
      break;
    default:
      throw new TexError(`unsupported accent \\${node.accent}`, '');
  }
  box.ascent = -y + lift + stroke;
  return box;
}

// Delimiters around a laid-out body, grown to its height and centred on it.
function wrapDelimiters(body, open, close, scale, context) {
  const height = Math.max(body.ascent + body.descent, (ASCENT + DESCENT) * scale) + 0.1 * scale;
  const size = Math.min(4 * scale, Math.max(scale, height / (ASCENT + DESCENT)));
  const center = (body.descent - body.ascent) / 2;
  // A glyph's visual centre sits (ASCENT - DESCENT) / 2 above its baseline.
  const y = center + (ASCENT - DESCENT) / 2 * size;
  const box = emptyBox();
  const pad = 0.04 * scale;
  if (open) {
    const glyphBox = glyph(open, size, context, { y });
    place(box, glyphBox, 0, 0);
    box.width = glyphBox.width + pad;
  }
  place(box, body, box.width, 0);
  box.width += body.width;
  if (close) {
    const glyphBox = glyph(close, size, context, { y });
    place(box, glyphBox, box.width + pad, 0);
    box.width += pad + glyphBox.width;
  }
  box.ascent = Math.max(body.ascent, open || close ? ASCENT * size - y : 0);
  box.descent = Math.max(body.descent, open || close ? DESCENT * size + y : 0);
  return box;
}

function layoutDelimited(node, scale, context) {
  return wrapDelimiters(layoutList(node.body, scale, context), node.open, node.close, scale, context);
}

// Rows and columns centred on the math axis; cases are left-aligned.
function layoutMatrix(node, scale, context) {
  const cells = node.rows.map(row => row.map(cell => layoutNode(cell, scale, context)));
  const columns = Math.max(...cells.map(row => row.length));
  const widths = Array.from({ length: columns }, (_, column) => Math.max(0, ...cells.map(row => row[column]?.width ?? 0)));
  const rowGap = 0.3 * scale;
  const columnGap = (node.env === 'cases' ? 1 : 0.8) * scale;
  const rows = cells.map(row => ({
    ascent: Math.max(ASCENT * scale, ...row.map(cell => cell.ascent)),
    descent: Math.max(DESCENT * scale, ...row.map(cell => cell.descent)),
  }));
  const height = rows.reduce((sum, row) => sum + row.ascent + row.descent, 0) + rowGap * (rows.length - 1);
  const body = emptyBox();
  let y = -AXIS * scale - height / 2;
  cells.forEach((row, rowIndex) => {
    y += rows[rowIndex].ascent;
    let x = 0.1 * scale;
    row.forEach((cell, column) => {
      const offset = node.env === 'cases' ? 0 : (widths[column] - cell.width) / 2;
      place(body, cell, x + offset, y);
      x += widths[column] + columnGap;
    });
    y += rows[rowIndex].descent + rowGap;
  });
  body.width = widths.reduce((sum, width) => sum + width, 0) + columnGap * (columns - 1) + 0.2 * scale;
  body.ascent = AXIS * scale + height / 2;
  body.descent = height / 2 - AXIS * scale;
  const [open, close] = MATRICES[node.env];
  return wrapDelimiters(body, open, close, scale, context);
}

function layoutNode(node, scale, context) {
  switch (node.type) {
    case 'group':
      return layoutList(node.body, scale, context);
    case 'symbol':
      return glyph(node.text, scale, context);
    case 'text':
    case 'function':
      return glyph(node.text, scale, context, { weight: 'normal' });
    case 'bigop': {
      const size = scale * (node.text === '∫' || node.text === '∮' || node.text === '∬' ? 1.5 : 1.3);
      // Centre the enlarged operator on the math axis.
      return glyph(node.text, size, context, { y: -AXIS * scale + (ASCENT - DESCENT) / 2 * size });
    }
    case 'scripts':
      return layoutScripts(node, scale, context);
    case 'frac':
      return layoutFraction(node, scale, context);
    case 'sqrt':
      return layoutRoot(node, scale, context);
    case 'accent':
      return layoutAccent(node, scale, context);
    case 'leftright':
      return layoutDelimited(node, scale, context);
    case 'matrix':
      return layoutMatrix(node, scale, context);
    case 'bold':
      return layoutNode(node.body, scale, { ...context, weight: 'bold' });
    case 'space':
      return { ...emptyBox(), width: node.width * scale };
    default:
      throw new TypeError(`unknown formula node ${node.type}`);
  }
}

// A formula wider than maxWidth breaks at top-level gaps of at least a \quad; rows are
// filled greedily and stacked with `lineGap` em between them.
function breakRows(list, maxWidth, align, lineGap, context) {
  const segments = [[]];
  const gaps = [];
  for (const node of list) {
    if (node.type === 'space' && node.width >= 1) {
      segments.push([]);
      gaps.push(node);
    } else {
      segments.at(-1).push(node);
    }
  }
  const rows = [];
  let current = segments[0];
  for (let index = 1; index < segments.length; index += 1) {
    const joined = [...current, gaps[index - 1], ...segments[index]];
    if (layoutList(joined, 1, context).width <= maxWidth) current = joined;
    else {
      rows.push(current);
      current = segments[index];
    }
  }
  rows.push(current);
  const boxes = rows.map(row => layoutList(row, 1, context));
  const width = Math.max(...boxes.map(box => box.width));
  const box = emptyBox();
  let baseline = 0;
  boxes.forEach((row, index) => {
    if (index) baseline += boxes[index - 1].descent + lineGap + row.ascent;
    place(box, row, align === 'left' ? 0 : align === 'right' ? width - row.width : (width - row.width) / 2, baseline);
  });
  box.width = width;
  box.ascent = boxes[0].ascent;
  box.descent = baseline + boxes.at(-1).descent;
  box.rows = boxes.length;
  return box;
}

// measure(text, weight) → advance width in em (size 1). Returns a box whose items are
// glyphs { text, x, y, size, weight } and chalk lines { points, width }. With maxWidth (em)
// a long formula is broken into rows (align: center | left | right).
export function layoutTex(source, measure, { maxWidth = Infinity, align = 'center', lineGap = 0.35 } = {}) {
  if (typeof measure !== 'function') throw new TypeError('measure must be a function');
  const tree = typeof source === 'string' ? parseTex(source) : source;
  const context = { measure, weight: 'normal' };
  const box = layoutNode(tree, 1, context);
  if (box.width <= maxWidth || tree.type !== 'group') return { ...box, rows: 1 };
  return breakRows(tree.body, maxWidth, align, lineGap, context);
}

// ---------- plain text ----------

const SUPERSCRIPTS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', T: 'ᵀ', k: 'ᵏ', m: 'ᵐ', t: 'ᵗ' };
const SUBSCRIPTS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '−': '₋', '=': '₌', '(': '₍', ')': '₎', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', h: 'ₕ', x: 'ₓ', t: 'ₜ', n: 'ₙ', m: 'ₘ', a: 'ₐ', e: 'ₑ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', u: 'ᵤ', v: 'ᵥ' };
const COMBINING = { bar: '\u0304', overline: '\u0304', hat: '\u0302', widehat: '\u0302', tilde: '\u0303', widetilde: '\u0303', vec: '\u20d7', dot: '\u0307', ddot: '\u0308', underline: '\u0332' };

function scriptText(text, table, marker) {
  const characters = Array.from(text);
  if (characters.length && characters.every(character => table[character])) return characters.map(character => table[character]).join('');
  return `${marker}(${text})`;
}

function simple(text) {
  return Array.from(text).length === 1 || /^[\p{L}\p{N}.]+$/u.test(text) ? text : `(${text})`;
}

function nodeText(node) {
  switch (node.type) {
    case 'group':
      return node.body.map((child, index) => {
        const text = nodeText(child);
        const cls = child.type === 'symbol' ? child.cls : null;
        if (cls === 'rel' || (cls === 'bin' && index > 0)) return ` ${text} `;
        if (cls === 'punct') return `${text} `;
        if (child.type === 'function') return `${text} `;
        return text;
      }).join('');
    case 'symbol':
    case 'text':
    case 'function':
    case 'bigop':
      return node.text;
    case 'space':
      return node.width >= 0.15 ? ' ' : '';
    case 'scripts': {
      let text = nodeText(node.base);
      if (node.sub) text += scriptText(nodeText(node.sub).replace(/\s+/g, ''), SUBSCRIPTS, '_');
      if (node.sup) text += scriptText(nodeText(node.sup).replace(/\s+/g, ''), SUPERSCRIPTS, '^');
      return text;
    }
    case 'frac':
      return `${simple(nodeText(node.num).trim())}/${simple(nodeText(node.den).trim())}`;
    case 'sqrt':
      return `√${simple(nodeText(node.body).trim())}`;
    case 'accent': {
      const text = nodeText(node.body);
      return Array.from(text).length === 1 ? text + COMBINING[node.accent] : `${node.accent}(${text})`;
    }
    case 'leftright':
      return `${node.open}${nodeText({ type: 'group', body: node.body })}${node.close}`;
    case 'bold':
      return nodeText(node.body);
    case 'matrix': {
      const [open, close] = MATRICES[node.env];
      const rows = node.rows.map(row => row.map(cell => nodeText(cell).trim()).join(', '));
      return `${open || '['}${rows.join('; ')}${close || (open ? '' : ']')}`;
    }
    default:
      return '';
  }
}

// A readable plain-text version for screen readers and copy: Unicode scripts where they
// exist (uᵢⁿ⁺¹), otherwise u^(…) and a/b for fractions.
export function texToText(source) {
  const tree = typeof source === 'string' ? parseTex(source) : source;
  return nodeText(tree).replace(/\s+/g, ' ').trim().normalize('NFC');
}

// A measure function for a Canvas 2D context and a CSS font family.
export function canvasMeasure(context, family) {
  return (text, weight) => {
    context.font = `${weight === 'bold' ? 'bold ' : ''}100px ${family}`;
    return context.measureText(text).width / 100;
  };
}

// Draws a layout with (x, y) in the context's current units and `pixels` per em.
// align: left | center | right; baseline: alphabetic | middle | top | bottom; limit draws
// only the first items (glyphs and strokes in reading order), for writing it progressively.
export function paintTex(context, layout, {
  x = 0, y = 0, pixels = 16, family = 'sans-serif', color = '#f3f0e8',
  align = 'left', baseline = 'alphabetic', maxWidth, limit = Infinity,
} = {}) {
  let em = pixels;
  if (maxWidth !== undefined && layout.width * em > maxWidth && layout.width > 0) em = maxWidth / layout.width;
  const width = layout.width * em;
  const left = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0);
  const top = baseline === 'middle' ? (layout.ascent - layout.descent) / 2 * em
    : baseline === 'top' ? layout.ascent * em
      : baseline === 'bottom' ? -layout.descent * em : 0;
  const originY = y + top;
  context.fillStyle = color;
  context.strokeStyle = color;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const [index, item] of layout.items.entries()) {
    if (index >= limit) break;
    if (item.kind === 'glyph') {
      context.font = `${item.weight === 'bold' ? 'bold ' : ''}${item.size * em}px ${family}`;
      context.fillText(item.text, left + item.x * em, originY + item.y * em);
    } else {
      context.lineWidth = Math.max(1, item.width * em);
      context.beginPath();
      context.moveTo(left + item.points[0] * em, originY + item.points[1] * em);
      for (let index = 2; index < item.points.length; index += 2) {
        context.lineTo(left + item.points[index] * em, originY + item.points[index + 1] * em);
      }
      context.stroke();
    }
  }
  return { width, ascent: layout.ascent * em, descent: layout.descent * em };
}

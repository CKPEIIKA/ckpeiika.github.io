import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas2DRenderer } from '../src/canvas2d.js';
import { Camera2D, MathLabel, Scene } from '../src/core.js';
import { layoutTex, paintTex, parseTex, TexError, texToText } from '../src/tex.js';
import { RecordingContext2D } from '../support/recording-context.js';

// Half an em per character: layouts become exact numbers.
const measure = text => Array.from(text).length * 0.5;
const glyphs = layout => layout.items.filter(item => item.kind === 'glyph');
const lines = layout => layout.items.filter(item => item.kind === 'line');
const find = (layout, text) => glyphs(layout).find(item => item.text === text);

test('symbols, Greek letters, numbers and signs become glyphs', () => {
  const layout = layoutTex('\\alpha + 0.55 = -x', measure);
  assert.deepEqual(glyphs(layout).map(item => item.text), ['α', '+', '0.55', '=', '−', 'x']);
  // Binary + gets 4/18 em each side, relation = gets 5/18; the minus after = is unary.
  const plus = find(layout, '+'), number = find(layout, '0.55'), equals = find(layout, '=');
  assert.ok(Math.abs(plus.x - (0.5 + 4 / 18)) < 1e-12);
  assert.ok(Math.abs(number.x - (plus.x + 0.5 + 4 / 18)) < 1e-12);
  assert.ok(Math.abs(equals.x - (number.x + 2 + 5 / 18)) < 1e-12);
  assert.ok(Math.abs(find(layout, '−').x - (equals.x + 0.5 + 5 / 18)) < 1e-12);
});

test('superscripts rise, subscripts sink, both shrink', () => {
  const layout = layoutTex('u_i^{n+1}', measure);
  const base = find(layout, 'u'), sub = find(layout, 'i'), one = find(layout, '1');
  assert.equal(base.y, 0);
  assert.ok(sub.y > 0 && one.y < 0);
  assert.ok(sub.size < 1 && one.size < 1);
  assert.ok(sub.x >= 0.5 && one.x > sub.x);
  assert.ok(layout.ascent > 0.72 && layout.descent > 0.22);
  // Scripts of scripts stop shrinking at half size.
  assert.equal(find(layoutTex('e^{x^{y^z}}', measure), 'z').size, 0.5);
});

test('a fraction stacks numerator over a rule over denominator', () => {
  const layout = layoutTex('\\frac{a+b}{2}', measure);
  const [rule] = lines(layout);
  const ruleY = rule.points[1];
  assert.ok(ruleY < 0, 'the rule sits on the math axis, above the baseline');
  assert.ok(find(layout, 'a').y < ruleY && find(layout, '2').y > ruleY);
  assert.ok(rule.points[2] - rule.points[0] >= measure('a+b') * 0.85);
  const denominator = find(layout, '2');
  assert.ok(Math.abs(denominator.x + measure('2') * denominator.size / 2 - layout.width / 2) < 1e-9, 'centred');
});

test('roots, accents and delimiters draw chalk lines or scaled glyphs', () => {
  const root = layoutTex('\\sqrt{x}', measure);
  assert.equal(lines(root)[0].points.length, 10);
  assert.ok(find(root, 'x').x > 0.4);
  for (const accent of ['bar', 'hat', 'tilde', 'vec', 'dot', 'ddot', 'overline', 'underline', 'widehat']) {
    const layout = layoutTex(`\\${accent}{u}`, measure);
    assert.ok(lines(layout).length >= 1, accent);
    assert.ok(layout.width >= 0.5, accent);
  }
  const tall = layoutTex('\\left( \\frac{1}{2} \\right)', measure);
  const [open, , , close] = glyphs(tall);
  assert.equal(open.text, '(');
  assert.equal(close.text, ')');
  assert.ok(open.size > 1 && open.size === close.size);
  assert.equal(glyphs(layoutTex('\\left. x \\right|', measure)).map(item => item.text).join(''), 'x|');
});

test('operators, functions, text and spacing', () => {
  const sum = layoutTex('\\sum_{i=1}^{N} x_i', measure);
  const sigma = find(sum, '∑');
  assert.ok(sigma.size > 1);
  assert.ok(find(sum, 'N').y < sigma.y - 0.5 && find(sum, 'i').y > sigma.y, 'limits above and below');
  const integral = layoutTex('\\int_0^1 f\\,dx', measure);
  assert.ok(find(integral, '1').x > find(integral, '∫').x, 'integral limits stay at the side');
  assert.equal(find(layoutTex('\\sin x', measure), 'sin').weight, 'normal');
  assert.equal(find(layoutTex('\\text{if } x', measure), 'if ').text, 'if ');
  assert.equal(find(layoutTex('\\mathbf{v}', measure), 'v').weight, 'bold');
  assert.ok(layoutTex('a\\quad b', measure).width > layoutTex('a\\,b', measure).width);
  assert.equal(layoutTex('', measure).width, 0);
});

test('unsupported or malformed formulas throw a TexError naming the problem', () => {
  for (const [source, message] of [
    ['\\foo', /unsupported command \\foo/],
    ['{x', /missing \}/],
    ['x}', /unexpected \}/],
    ['x^2^3', /double superscript/],
    ['\\frac{1}', /missing argument/],
    ['\\left( x', /\\left without \\right/],
    ['x \\right)', /\\right without \\left/],
    ['\\left\\foo x \\right)', /unsupported delimiter/],
    ['x\\', /lone backslash/],
  ]) {
    assert.throws(() => parseTex(source), error => error instanceof TexError && message.test(error.message), source);
  }
  assert.throws(() => parseTex(null), TypeError);
  assert.throws(() => layoutTex('x', null), TypeError);
});

test('layouts stay finite for many generated formulas', () => {
  const parts = ['x', '\\alpha', '0.5', '+', '-', '=', '\\le', '\\frac{a}{b}', '\\sqrt{y}', 'u_i', 'e^{n}', '\\bar{u}', '\\left(z\\right)', '\\sum_{k}', '\\,', '\\text{ok}'];
  let seed = 11;
  const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let run = 0; run < 500; run += 1) {
    const length = 1 + Math.floor(random() * 8);
    let source = '';
    for (let index = 0; index < length; index += 1) source += parts[Math.floor(random() * parts.length)] + ' ';
    const layout = layoutTex(`{${source}}^{${source}}`, measure);
    for (const value of [layout.width, layout.ascent, layout.descent]) assert.ok(Number.isFinite(value) && value >= 0, source);
    for (const item of layout.items) {
      const numbers = item.kind === 'glyph' ? [item.x, item.y, item.size] : [...item.points, item.width];
      assert.ok(numbers.every(Number.isFinite), source);
    }
  }
});

test('paintTex aligns, fits maxWidth and draws glyphs and strokes', () => {
  const context = new RecordingContext2D(400, 200);
  const layout = layoutTex('\\frac{1}{2}', measure);
  const painted = paintTex(context, layout, { x: 200, y: 100, pixels: 20, align: 'center', family: 'serif' });
  assert.ok(Math.abs(painted.width - layout.width * 20) < 1e-9);
  assert.equal(context.count('fillText'), 2);
  assert.equal(context.count('stroke'), 1);
  const first = context.commands.find(entry => entry[0] === 'fillText');
  assert.ok(Math.abs(first[2] - (200 - painted.width / 2 + find(layout, '1').x * 20)) < 1e-9);
  const narrow = paintTex(new RecordingContext2D(), layout, { pixels: 20, maxWidth: 5 });
  assert.ok(Math.abs(narrow.width - 5) < 1e-9);
});

test('MathLabel renders through the Chalkish renderer in world units', () => {
  const label = new MathLabel('x^2', { size: 20, align: 'left', baseline: 'alphabetic', style: { fill: '#fff', passes: 1 } });
  const scene = new Scene();
  scene.add(label);
  const context = new RecordingContext2D(500, 305);
  const fonts = [];
  const fillText = context.fillText.bind(context);
  context.fillText = (...args) => { fonts.push(context.font); fillText(...args); };
  const renderer = new Canvas2DRenderer(context);
  const camera = new Camera2D({ centerX: 0, centerY: 0, height: 610, flipY: false });
  renderer.render(scene, camera);
  assert.deepEqual(fonts.map(font => Number(font.match(/([\d.]+)px/)[1])), [10, 7]);
  assert.equal(label.data.accessibleText, 'x²');
  const second = renderer.render(scene, camera);
  assert.equal(second.cacheMisses, 0, 'the layout is cached');
  label.setTex('x^3');
  assert.equal(renderer.render(scene, camera).cacheMisses, 1);
  assert.throws(() => new MathLabel('x'), RangeError);
  assert.throws(() => new MathLabel('\\nope', { size: 1 }), TexError);
  assert.throws(() => new MathLabel('x', { size: 1, align: 'middle' }), RangeError);
});

test('matrices align cells in rows and columns inside grown delimiters', () => {
  const layout = layoutTex('\\begin{bmatrix} r & K \\\\ 0 & s \\end{bmatrix}', measure);
  const [open, r, k, zero, s, close] = glyphs(layout);
  assert.deepEqual([open.text, close.text], ['[', ']']);
  assert.ok(open.size > 1, 'the brackets grow to two rows');
  assert.equal(r.y, k.y);
  assert.equal(zero.y, s.y);
  assert.ok(zero.y > r.y, 'second row below the first');
  assert.equal(r.x, zero.x);
  assert.equal(k.x, s.x);
  assert.equal(glyphs(layoutTex('\\begin{matrix} a \\end{matrix}', measure)).length, 1);
  const cases = layoutTex('|x| = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}', measure);
  assert.ok(glyphs(cases).some(item => item.text === '{'));
  for (const [source, message] of [
    ['a & b', /& outside a matrix/],
    ['a \\\\ b', /outside a matrix/],
    ['\\begin{foo} a \\end{foo}', /unsupported environment foo/],
    ['\\begin{matrix} a \\end{pmatrix}', /different \\end/],
    ['\\begin{matrix} a', /without \\end/],
    ['a \\end{matrix}', /\\end without \\begin/],
  ]) {
    assert.throws(() => parseTex(source), error => error instanceof TexError && message.test(error.message), source);
  }
});

test('long formulas break into rows at their quad gaps', () => {
  const source = 'a = b\\qquad c = d\\qquad e = f';
  const wide = layoutTex(source, measure);
  assert.equal(wide.rows, 1);
  const narrow = layoutTex(source, measure, { maxWidth: 6 });
  assert.equal(narrow.rows, 3);
  assert.ok(narrow.width <= 6);
  const ys = [...new Set(glyphs(narrow).map(item => item.y))];
  assert.equal(ys.length, 3);
  assert.ok(ys[1] > ys[0] && ys[2] > ys[1]);
  assert.ok(Math.abs(narrow.descent - (ys[2] + 0.22)) < 1e-9);
  const two = layoutTex(source, measure, { maxWidth: 10 });
  assert.equal(two.rows, 2, 'rows are filled greedily');
  // No gap to break at: the formula stays one row, wider than asked.
  assert.equal(layoutTex('a+b+c+d', measure, { maxWidth: 1 }).rows, 1);
});

test('texToText gives readable plain text', () => {
  assert.equal(texToText('u^{n+1}_i = u_i - \\lambda\\left[f(u_{i+1})-f(u_i)\\right]'), 'uᵢⁿ⁺¹ = uᵢ − λ[f(uᵢ₊₁) − f(uᵢ)]');
  assert.equal(texToText('\\frac{a+b}{2}'), '(a + b)/2');
  assert.equal(texToText('\\bar u'), 'ū');
  assert.equal(texToText('\\sqrt{2}'), '√2');
  assert.equal(texToText('x^{\\alpha}'), 'x^(α)');
  assert.equal(texToText('\\text{if } x \\le 0'), 'if x ≤ 0');
  assert.equal(texToText('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}'), '(1, 2; 3, 4)');
  assert.equal(texToText('\\int_0^1 f\\,dx'), '∫₀¹f dx');
});

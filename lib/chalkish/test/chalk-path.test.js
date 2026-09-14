import test from 'node:test';
import assert from 'node:assert/strict';

import { strokeChalkPath2D } from '../src/chalk.js';

test('strokeChalkPath2D deposits multiple passes without leaking context state', () => {
  const calls = [];
  const context = {
    globalAlpha: 0.8,
    lineWidth: 2,
    lineDashOffset: 3,
    lineCap: 'butt',
    lineJoin: 'miter',
    dash: [4, 2],
    getLineDash() { return [...this.dash]; },
    setLineDash(value) { this.dash = [...value]; },
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    translate(x, y) { calls.push(['translate', x, y]); },
    stroke() { calls.push(['stroke', this.globalAlpha, this.lineWidth, [...this.dash]]); },
  };

  strokeChalkPath2D(context);

  assert.equal(calls.filter(call => Array.isArray(call) && call[0] === 'stroke').length, 3);
  assert.equal(calls.filter(call => call === 'save').length, 3);
  assert.equal(calls.filter(call => call === 'restore').length, 3);
  assert.deepEqual(context.dash, [4, 2]);
});

test('strokeChalkPath2D rejects non-canvas input', () => {
  assert.throws(() => strokeChalkPath2D(null), TypeError);
});

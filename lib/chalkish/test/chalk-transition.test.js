import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import {
  CHALK_TIMING,
  markChalkTransition,
  rewriteChalkLabel,
  rewriteChalkText,
  writeChalkText,
} from '../src/chalk-transition.js';
import { MathLabel, TextLabel } from '../src/core.js';

function fakeElement() {
  return { dataset: {}, offsetWidth: 120, textContent: '' };
}

test('chalk transitions retrigger named write and erase phases', () => {
  const element = fakeElement();
  markChalkTransition(element, 'write', { reducedMotion: false });
  assert.equal(element.dataset.chalkTransition, 'write');
  markChalkTransition(element, 'erase', { reducedMotion: false });
  assert.equal(element.dataset.chalkTransition, 'erase');
});

test('chalk text replacement respects reduced motion', () => {
  const element = fakeElement();
  writeChalkText(element, 'Ttrans — Trot', { reducedMotion: true });
  assert.equal(element.textContent, 'Ttrans — Trot');
  assert.equal(element.dataset.chalkTransition, undefined);
});

test('DOM text can request a full erase and rewrite pass', () => {
  const element = fakeElement();
  element.textContent = 'VHS';
  rewriteChalkText(element, 'VSS', { reducedMotion: false });
  assert.equal(element.textContent, 'VSS');
  assert.equal(element.dataset.chalkTransition, 'rewrite');
});

function frameClock() {
  const frames = [];
  return {
    frames,
    options: {
      duration: 100,
      reducedMotion: false,
      requestFrame(callback) { frames.push(callback); return frames.length; },
      cancelFrame() {},
    },
  };
}

test('Canvas labels are erased and rewritten with the board pen (reveal)', () => {
  const label = new TextLabel('VHS');
  const clock = frameClock();
  const seen = [];
  rewriteChalkLabel(label, 'VSS + LB', { ...clock.options, render: () => seen.push([label.text, label.reveal]) });
  for (const timestamp of [0, 21, 42, 47, 76, 100]) clock.frames.shift()(timestamp);
  assert.deepEqual(seen[1], ['VHS', 0.5], 'half erased at a quarter of the time');
  assert.deepEqual(seen[3], ['VSS + LB', 0], 'the new text waits, unwritten, between the phases');
  assert.equal(seen[4][1], 0.5, 'half written');
  assert.deepEqual(seen.at(-1), ['VSS + LB', 1]);
  assert.equal(clock.frames.length, 0);
});

test('formula labels are rewritten through setTex; reduced motion swaps at once', () => {
  const formula = new MathLabel('u_t = 0', { size: 1 });
  const clock = frameClock();
  rewriteChalkLabel(formula, 'u_t + u_x = 0', clock.options);
  for (const timestamp of [0, 50, 100]) clock.frames.shift()(timestamp);
  assert.equal(formula.tex, 'u_t + u_x = 0');
  assert.equal(formula.reveal, 1);
  const label = new TextLabel('a');
  rewriteChalkLabel(label, 'b', { reducedMotion: true });
  assert.deepEqual([label.text, label.reveal], ['b', 1]);
  assert.throws(() => rewriteChalkLabel({ text: 'x', setText() {} }, 'y'), TypeError);
});

test('the page CSS uses the same chalk timing as the board', () => {
  const theme = readFileSync(new URL('../../../demos/shell.css', import.meta.url), 'utf8');
  assert.match(theme, new RegExp(`--chalk-transition-duration:\\s*${CHALK_TIMING.writeMs}ms`));
  assert.match(theme, new RegExp(`--chalk-rewrite-duration:\\s*${CHALK_TIMING.rewriteMs}ms`));
  assert.match(theme, new RegExp(`${CHALK_TIMING.eraseEnd * 100}% \\{\\s*clip-path: inset\\(0 0 0 100%\\)`));
  assert.match(theme, new RegExp(`${CHALK_TIMING.writeStart * 100}% \\{\\s*clip-path: inset\\(0 100% 0 0\\)`));
});

test('chalk transition rejects unsupported phases without mutation', () => {
  const element = fakeElement();
  assert.throws(
    () => markChalkTransition(element, 'slide', { reducedMotion: false }),
    /write, erase, or rewrite/,
  );
  assert.deepEqual(element.dataset, {});
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  markChalkTransition,
  rewriteChalkLabel,
  rewriteChalkText,
  writeChalkText,
} from '../examples/chalk-transition.js';

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

test('Canvas labels erase and rewrite through an injected frame clock', () => {
  const frames = [];
  const writes = [];
  const label = {
    text: 'VHS',
    setText(value) {
      this.text = value;
      writes.push(value);
    },
  };
  rewriteChalkLabel(label, 'VSS + LB', {
    duration: 100,
    reducedMotion: false,
    requestFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame() {},
  });
  for (const timestamp of [0, 42, 52, 76, 100]) frames.shift()(timestamp);
  assert.ok(writes.includes(''));
  assert.equal(label.text, 'VSS + LB');
});

test('chalk transition rejects unsupported phases without mutation', () => {
  const element = fakeElement();
  assert.throws(
    () => markChalkTransition(element, 'slide', { reducedMotion: false }),
    /write, erase, or rewrite/,
  );
  assert.deepEqual(element.dataset, {});
});

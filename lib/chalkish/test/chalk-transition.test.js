import assert from 'node:assert/strict';
import test from 'node:test';

import {
  markChalkTransition,
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

test('chalk transition rejects unsupported phases without mutation', () => {
  const element = fakeElement();
  assert.throws(
    () => markChalkTransition(element, 'slide', { reducedMotion: false }),
    /write or erase/,
  );
  assert.deepEqual(element.dataset, {});
});

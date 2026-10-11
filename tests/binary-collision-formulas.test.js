import assert from 'node:assert/strict';
import test from 'node:test';

import { CHAPTERS } from '../demos/binary-collision/chapters.js';
import { parseTex, texToText } from '../lib/chalkish/src/tex.js';

test('every binary-collision step has chalk TeX formulas in both languages', () => {
  for (const chapter of CHAPTERS) {
    for (const step of chapter.steps) {
      assert.ok(Array.isArray(step.tex) && step.tex.length > 0, step.title);
      for (const [tex, cls] of step.tex) {
        assert.equal(typeof cls, 'string');
        for (const source of [].concat(tex)) assert.doesNotThrow(() => parseTex(source), source);
        // A formula with words has an English version without Cyrillic.
        const english = Array.isArray(tex) ? tex[1] : tex;
        assert.doesNotMatch(texToText(english), /[А-Яа-яЁё]/, english);
      }
    }
  }
});

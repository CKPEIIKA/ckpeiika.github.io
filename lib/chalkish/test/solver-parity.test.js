import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const LABS = new URL('../examples/boards/', import.meta.url);

function sha256(source) {
  return createHash('sha256').update(source).digest('hex');
}

function removeHeader(source) {
  return source.replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
}

test('DG engine differs from the original solver only by its module wrapper', async () => {
  const moduleSource = await readFile(new URL('dg-fv-lab/dg-fv-lab-engine.js', LABS), 'utf8');
  const legacySource = removeHeader(moduleSource)
    .replace(/^let DgEngine;\n/, '')
    .replace(
      '  DgEngine = Object.freeze({',
      '  const root = globalThis;\n  root.DgEngine = Object.freeze({',
    )
    .replace(/\n\nexport \{ DgEngine \};\n$/, '\n');

  assert.equal(
    sha256(legacySource),
    '8ea16424cb737960b69dafebe8f1b11a24d6a4404bbebc7c0d3889ec821fcd9a',
  );
});

test('DSMC core differs from the original solver only by its module export', async () => {
  const moduleSource = await readFile(new URL('dsmc-lab/dsmc-lab-core.js', LABS), 'utf8');
  const legacySource = removeHeader(moduleSource).replace(
    /\n\n\nexport \{ Dsmc \};\n$/,
    '\n\nif (typeof window !== "undefined") {\n    window.Dsmc = Dsmc;\n}\n',
  );

  assert.equal(
    sha256(legacySource),
    '0dc31795c07e02a3b7ae2de95dfa4a614b4951701987c7d48a4e826f57330c18',
  );
});

test('typed DSMC runtime differs from the original solver only by its module wrapper', async () => {
  const moduleSource = await readFile(new URL('dsmc-lab/dsmc-lab-runtime.js', LABS), 'utf8');
  const legacySource = removeHeader(moduleSource)
    .replace("import { Dsmc } from './dsmc-lab-core.js';\n\n", '')
    .replace('const DsmcTyped = (() => {', '(() => {')
    .replace(
      '    return Object.freeze({ createRuntime });\n})();\n\nexport { DsmcTyped };\n',
      '    window.DsmcTyped = {\n        createRuntime,\n    };\n    window.DsmcWasm = window.DsmcTyped;\n})();\n',
    );

  assert.equal(
    sha256(legacySource),
    '8943a745170f88a21309cbf9f21e15232e83c0013ea4d99dd7c26ba4551ea260',
  );
});

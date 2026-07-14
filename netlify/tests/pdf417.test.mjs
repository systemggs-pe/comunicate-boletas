import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import pdf417Module from 'pdf417/build/index.js';

test('PDF417 is bundled from a valid module instead of a runtime public script', () => {
  const generator = pdf417Module?.default || pdf417Module;
  const loaderSource = readFileSync(new URL('../../src/utils/pdfLibraries.js', import.meta.url), 'utf8');
  const publicScript = new URL('../../public/pdf417.js', import.meta.url);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({fillRect() {}, set fillStyle(_) {}}),
    toDataURL: () => 'data:image/png;base64,valid-pdf417',
  };
  const previousDocument = globalThis.document;

  assert.equal(typeof generator, 'function');
  assert.match(loaderSource, /pdf417\/build\/index\.js/);
  assert.doesNotMatch(loaderSource, /document\.createElement\(['"]script['"]\)/);
  assert.equal(existsSync(publicScript), false);

  try {
    globalThis.document = {createElement: element => {
      assert.equal(element, 'canvas');
      return canvas;
    }};
    assert.equal(generator('BOLETA|12345678|TEST', 2, 1), 'data:image/png;base64,valid-pdf417');
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const UI_TEXT_FILES = [
  '../../src/features/boletas/BoletaExtranjera.jsx',
  '../../src/features/boletas/boletaPdf.js',
  '../../src/utils/currency.js',
];

test('boleta UI and PDF text contain no mojibake sequences', async () => {
  for (const relativePath of UI_TEXT_FILES) {
    const url = new URL(relativePath, import.meta.url);
    const source = await readFile(url, 'utf8');
    assert.doesNotMatch(source, /Ã|Â|â/, `Texto con codificación dañada en ${relativePath}`);
  }
});

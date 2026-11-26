// Selbsttest für das Einfügen von Claude-Antworten: node tests/einfuegen.test.mjs
import assert from 'node:assert/strict';
import { cleanPasted, mergeText, wordCount } from '../js/einfuegen.js';

assert.equal(cleanPasted('**Antwort:** Das ist *wichtig* → ja ✓ 🙂'), 'Antwort: Das ist wichtig - ja');
assert.equal(cleanPasted('## Überschrift\n\n• eins\n* zwei\n- drei'), 'Überschrift\n\n- eins\n- zwei\n- drei');
assert.equal(cleanPasted('a\r\n\r\n\r\n\r\nb  \n'), 'a\n\nb');
assert.equal(cleanPasted('2 * 3 = 6 und 5*4'), '2 * 3 = 6 und 5*4', 'Rechenzeichen bleiben');
assert.equal(cleanPasted('§ 286 Abs. 1 BGB „Mitte November“'), '§ 286 Abs. 1 BGB „Mitte November“', 'normale Zeichen bleiben');
assert.equal(cleanPasted(null), '');
assert.equal(mergeText('Alt', 'Neu', 'replace'), 'Neu');
assert.equal(mergeText('Alt  \n', 'Neu', 'append'), 'Alt\n\nNeu');
assert.equal(mergeText('   ', 'Neu', 'append'), 'Neu', 'leer: anhängen = ersetzen');
assert.equal(wordCount(' zwei  Wörter\n'), 2);
console.log('OK – Einfügen');

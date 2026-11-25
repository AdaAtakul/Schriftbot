// Selbsttest für das Profil-Modell: node tests/profile.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf, progress, checkPair, parseProfile, GROUPS } from '../js/profile.js';

const p = emptyProfile();
const total = progress(p).total;
assert.equal(total, GROUPS.filter(g => !g.optional).reduce((n, g) => n + g.chars.length, 0));
assert.equal(new Set(GROUPS.flatMap(g => g.chars)).size, GROUPS.flatMap(g => g.chars).length, 'keine doppelten Zeichen');

variantsOf(p, 'a')[0].push([[0, 0, 0.5, 0], [1, -1, 0.6, 16]]);
variantsOf(p, '€')[0].push([[0, 0, 0.5, 0]]); // Extra zählt nicht
assert.deepEqual(progress(p), { done: 1, total });

assert.match(checkPair(p, 'x'), /2 bis 4/);
assert.match(checkPair(p, 'ch'), /gibt es schon/);
assert.match(checkPair(p, 'a b'), /ohne Leerzeichen/);
assert.equal(checkPair(p, 'ft'), null);
p.customPairs.push('ft');
assert.equal(progress(p).total, total + 1);

// Export → Import ergibt dasselbe Profil
const back = parseProfile(JSON.stringify(p));
assert.deepEqual(back.glyphs.a, p.glyphs.a);
assert.deepEqual(back.customPairs, ['ft']);

// Kaputte Dateien werden abgelehnt
assert.throws(() => parseProfile('kein json'), /kein gültiges JSON/);
assert.throws(() => parseProfile('{"format":"x"}'), /kein Handschrift-Profil/);
assert.throws(() => parseProfile(JSON.stringify({ ...p, glyphs: { a: [[[[0, 0, 'x', 0]]]] } })), /Ungültige Striche/);
console.log('OK – Gesamtzahl Zeichen:', total);

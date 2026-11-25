// Selbsttest für das Profil-Modell: node tests/profile.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf, progress, checkPair, parseProfile, GROUPS, align, alignAll } from '../js/profile.js';

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

// Ausrichten: o schwebt knapp über der Grundlinie und steht links → mittig (Kästchen 3 breit) und auf y = 0
const o = [[[0.2, -1, .5, 0], [1.2, -0.1, .5, 10]]];
assert.equal(align('o', o), true);
assert.deepEqual(o[0].map(p => [p[0], p[1]]), [[1, -0.9], [2, 0]]);
assert.equal(align('o', o), false); // schon ausgerichtet → bleibt stehen
// g mit Unterlänge und f mit großer Abweichung: Höhe bleibt, nur waagerecht mittig
const g = [[[1, -1, .5, 0], [2, 0.9, .5, 10]]];
align('g', g);
assert.equal(g[0][1][1], 0.9);
const f = [[[1, -2, .5, 0], [2, 0.8, .5, 10]]];
align('f', f);
assert.equal(f[0][1][1], 0.8);
// Bindestrich schwebt absichtlich, Leerzeichen bleibt unangetastet
const dash = [[[1, -0.5, .5, 0], [2, -0.5, .5, 10]]];
align('-', dash);
assert.equal(dash[0][0][1], -0.5);
const space = [[[0, 0, .5, 0], [2, 0, .5, 10]]];
assert.equal(align(' ', space), false);
// Paare: „ei“ wird eingerastet, „ng“ (Unterlänge) nicht
const q = emptyProfile();
q.glyphs.ei = [[[[0, -1, .5, 0], [1, 0.2, .5, 9]]], [], []];
q.glyphs.ng = [[[[0, -1, .5, 0], [1, 0.2, .5, 9]]], [], []];
assert.equal(alignAll(q), true);
assert.equal(q.glyphs.ei[0][0][1][1], 0);
assert.equal(q.glyphs.ng[0][0][1][1], 0.2);
assert.equal(alignAll(q), false);
console.log('OK – Gesamtzahl Zeichen:', total);

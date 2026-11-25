// Selbsttest für das Profil-Modell: node tests/profile.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf, progress, checkPair, parseProfile, GROUPS, align, alignAll, equalize, typicalXHeight, scaleAll } from '../js/profile.js';

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

// Größen angleichen: zu kleines m und zu kleines h werden auf die eigene typische Höhe gebracht
const e = emptyProfile();
const bump = (top, w = 1) => [[[1, 0, .5, 0], [1 + w / 2, -top, .5, 5], [1 + w, 0, .5, 9]]];
for (const ch of 'nao') e.glyphs[ch] = [bump(0.9), bump(1), bump(1.1)];
e.glyphs.m = [bump(0.45, 1.2), bump(1, 1.2), []];
for (const ch of 'bdl') e.glyphs[ch] = [bump(1.8), bump(1.7), bump(1.75)];
e.glyphs.h = [bump(0.8), bump(1.75), []];
e.glyphs['.'] = [[[[1, 0, .5, 0], [1.05, -0.05, .5, 5]]], [], []];
const dot = JSON.stringify(e.glyphs['.']);
assert.deepEqual(equalize(e).sort(), ['h', 'm']);
assert.ok(Math.abs(-Math.min(...e.glyphs.m[0].flat().map(p => p[1])) - 1) < 0.01, 'm auf x-Höhe');
assert.ok(Math.abs(-Math.min(...e.glyphs.h[0].flat().map(p => p[1])) - 1.75) < 0.01, 'h auf Oberlänge');
assert.equal(e.glyphs.m[0][0][0][1], 0, 'bleibt auf der Grundlinie');
assert.equal(JSON.stringify(e.glyphs['.']), dot, 'Satzzeichen unberührt');
assert.deepEqual(equalize(e), [], 'zweiter Durchlauf ändert nichts');

// Kästchen an die eigene Schrift anpassen: typische x-Höhe messen, alles auf 1 skalieren
const s = emptyProfile();
for (const ch of 'naoe') s.glyphs[ch] = [bump(0.6), bump(0.62), bump(0.65)];
s.glyphs.h = [bump(1.1), [], []];
s.glyphs[' '] = [[[[0, 0, .5, 0], [0.9, 0, .5, 9]]], [], []];
assert.equal(typicalXHeight(emptyProfile()), null, 'ohne Daten keine Messung');
const m = typicalXHeight(s);
assert.equal(m, 0.62);
scaleAll(s, 1 / m);
assert.ok(Math.abs(typicalXHeight(s) - 1) < 0.01, 'danach typische x-Höhe 1');
assert.ok(Math.abs(-Math.min(...s.glyphs.h[0].flat().map(p => p[1])) - 1.1 / 0.62) < 0.01, 'Verhältnisse bleiben');
assert.ok(Math.abs(s.glyphs[' '][0][0][1][0] - s.glyphs[' '][0][0][0][0] - 0.9 / 0.62) < 0.01, 'Wortabstand wächst mit');
const cx = s.glyphs.n[0].flat().map(p => p[0]);
assert.ok(Math.abs((Math.min(...cx) + Math.max(...cx)) / 2 - 1.5) < 0.01, 'wieder mittig im Kästchen');
console.log('OK – Gesamtzahl Zeichen:', total);

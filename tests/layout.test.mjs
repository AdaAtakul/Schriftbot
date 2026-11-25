// Selbsttest für das Layout: node tests/layout.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { layout, bounds, lineMetrics, DEFAULTS } from '../js/layout.js';

const p = emptyProfile();
const line = (x0, x1) => [[[x0, 0, 0.5, 0], [x1, -1, 0.5, 10]]];
['a', 'b', "'"].forEach(ch => variantsOf(p, ch).forEach((v, i) => v.push(...line(0.3, 1.2 + i * 0.1))));
variantsOf(p, ' ')[0].push([[0, 0, 0.5, 0], [1.5, 0, 0.5, 10]]);

const right = DEFAULTS.pageW - DEFAULTS.margin;

// Zeilenumbruch an Wortgrenzen, nichts ragt über den Rand
const long = Array(80).fill('abba').join(' ');
const r1 = layout(long, p);
const items = r1.pages.flatMap(pg => pg.items);
const ys = [...new Set(items.map(i => i.y))];
assert.ok(ys.length > 1, 'mehrere Zeilen');
for (const it of items) {
  const b = bounds(it.strokes);
  assert.ok(it.x + b.maxX * it.s <= right + 0.01, 'innerhalb des Randes');
}
// Jede Zeile beginnt mit einem ganzen Wort: 4 Buchstaben pro Wort → Zeilenlänge durch 4 teilbar
for (const y of ys.slice(0, -1)) assert.equal(items.filter(i => i.y === y).length % 4, 0);

// Nie zweimal dieselbe Variante hintereinander
const seq = layout('aaaaaaaaaaaaaaaaaaaa', p, {}, 7).pages[0].items.map(i => p.glyphs.a.indexOf(i.strokes));
for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
assert.equal(new Set(seq).size, 3, 'alle Varianten kommen vor');

// Fehlende Zeichen werden markiert, nicht ausgelassen
const r2 = layout('abxa', p);
assert.deepEqual(r2.missing, ['x']);
assert.equal(r2.pages[0].items.filter(i => i.missing === 'x').length, 1);
assert.equal(r2.pages[0].items.length, 4);

// Typografischer Apostroph der iPad-Tastatur nutzt das aufgenommene '
assert.deepEqual(layout('a’b', p).missing, []);

// Absätze und automatische neue Seiten
const r3 = layout(Array(60).fill('ab').join('\n'), p);
assert.ok(r3.pages.length >= 2, 'neue Seite');
for (const pg of r3.pages) for (const it of pg.items) assert.ok(it.y <= DEFAULTS.pageH - DEFAULTS.margin);

// Gleicher Startwert → gleiches Ergebnis (Vorschau springt beim Tippen nicht)
assert.deepEqual(layout('abab ab', p, {}, 3), layout('abab ab', p, {}, 3));
// Verbundene Paare: längstes Paar gewinnt, Regler 0 % schaltet sie ab
['c', 'h', 's'].forEach(ch => variantsOf(p, ch)[0].push(...line(0.2, 1)));
variantsOf(p, 'ch')[0].push(...line(0.2, 1.8));
variantsOf(p, 'sch')[0].push(...line(0.2, 2.5));
const keysOf = r => r.pages[0].items.map(it => Object.keys(p.glyphs).find(k => p.glyphs[k].includes(it.strokes)));
assert.deepEqual(keysOf(layout('asch', p, { connect: 1 })), ['a', 'sch']);
assert.deepEqual(keysOf(layout('ach', p, { connect: 1 })), ['a', 'ch']);
assert.deepEqual(keysOf(layout('asch', p, { connect: 0 })), ['a', 's', 'c', 'h']);
assert.deepEqual(keysOf(layout('Sch', p, { connect: 1 })), [undefined, 'ch'], 'Großes S ist kein Paar'); // S fehlt → markiert

// Unordnung: 0 % = exakt, 100 % = in den vorgegebenen Grenzen
const calm = layout(long, p, { chaos: 0 }).pages[0].items;
assert.ok(calm.every(it => it.rot === 0 && it.s === DEFAULTS.xHeight));
const wild = layout(long, p, { chaos: 1 }).pages[0].items;
assert.ok(wild.some(it => it.rot !== 0));
const deg = 180 / Math.PI;
assert.ok(wild.every(it => Math.abs(it.rot) * deg <= 3.3), 'Drehung ≤ 3° + Schräglage');
assert.ok(wild.every(it => Math.abs(it.s / DEFAULTS.xHeight - 1) <= 0.0501), 'Größe ±5 %');
// Unordnung verschiebt die Variantenwahl nicht
assert.deepEqual(layout(long, p, { chaos: 1 }).pages[0].items.map(i => i.strokes), layout(long, p).pages[0].items.map(i => i.strokes));
// Liniertes Papier: jede Grundlinie liegt exakt auf einer Papierlinie
const ruled = { ruled: true, lineSpacing: 8.8, lineTop: 20, lineHeight: 8.8, xHeight: 3, chaos: 0 };
const onLine = y => Math.abs(((y - ruled.lineTop) / ruled.lineSpacing) - Math.round((y - ruled.lineTop) / ruled.lineSpacing)) < 1e-9;
const r4 = layout(Array(70).fill('abba ab').join('\n'), p, ruled);
assert.ok(r4.pages.length >= 2);
for (const pg of r4.pages) for (const it of pg.items) assert.ok(onLine(it.y), `y=${it.y} liegt auf einer Linie`);
// Erste Zeile hat Platz für Oberlängen unter dem Rand, Zeilenabstand wird auf ganze Linien gerundet
const lm = lineMetrics({ ...ruled, lineHeight: 15 });
assert.equal(lm.lines, 2);
assert.equal(lm.step, 17.6);
assert.ok(lm.first >= DEFAULTS.margin + 2 * ruled.xHeight);
assert.equal(lineMetrics({ ...ruled, lineTop: 50 }).first, 50, 'nie oberhalb der ersten Linie');

// Optischer Abstand: o rückt unter das Dach des T, ohne den Stamm zu berühren
const k = emptyProfile();
variantsOf(k, 'T')[0].push([[0, -1.8, .5, 0], [1.6, -1.8, .5, 9]], [[0.8, -1.8, .5, 0], [0.8, 0, .5, 9]]);
const ring = Array.from({ length: 25 }, (_, i) => [0.5 + 0.5 * Math.cos(i / 24 * 2 * Math.PI), -0.5 + 0.5 * Math.sin(i / 24 * 2 * Math.PI), .5, i]);
variantsOf(k, 'o')[0].push(ring);
variantsOf(k, 'l')[0].push([[0.5, -2, .5, 0], [0.5, 0, .5, 9]]);
variantsOf(k, "'")[0].push([[0.5, -2, .5, 0], [0.5, -1.6, .5, 9]]);
const inkX = (it, f) => f(...it.strokes.flat().map(p => it.x + p[0] * it.s));
const [T, o] = layout('To', k).pages[0].items;
const bboxGap = inkX(o, Math.min) - inkX(T, Math.max);
assert.ok(bboxGap < 0, `o steht unter dem T-Dach (${bboxGap.toFixed(2)} mm)`);
assert.ok(inkX(o, Math.min) > T.x + 0.8 * T.s + 0.2, 'o berührt den Stamm nicht');
// Gerade Striche (l l) und Zeichen ohne gemeinsame Höhe (' o) behalten den normalen Abstand
const gapOf = s => { const [a, b] = layout(s, k).pages[0].items; return inkX(b, Math.min) - inkX(a, Math.max); };
const normal = (DEFAULTS.spacing + 0.13) * DEFAULTS.xHeight; // Abstand + Strichbreite
assert.ok(Math.abs(gapOf('ll') - normal) < 1e-9, 'll unverändert');
assert.ok(Math.abs(gapOf("'o") - normal) < 1e-9, "' o unverändert");
console.log('OK – Layout');

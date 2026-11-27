// Selbsttest für das Layout: node tests/layout.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { layout, bounds, lineMetrics, DEFAULTS, misspell, rng, chaosCurve } from '../js/layout.js';

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
assert.ok(wild.every(it => Math.abs(it.rot) * deg <= 7.8 + 1e-9), 'Drehung ≤ 6° + Wort 1,5° + Schräglage');
assert.ok(wild.some(it => Math.abs(it.rot) * deg > 2), 'Drehung sichtbar');
// Ordentlich (30 %) bleibt ruhig: Wirkung unter 100 % wächst langsamer
assert.ok(chaosCurve(0.3) < 0.2 && chaosCurve(1) === 1 && chaosCurve(1.4) === 1.4);
const tidy = layout(long, p, { chaos: 0.3 }).pages[0].items;
assert.ok(tidy.every(it => Math.abs(it.rot) * deg <= 7.8 * 0.17), 'Ordentlich: höchstens ±1,3°');
// Gedrehte Buchstaben bleiben bei der Linie: Mitte (cx, −0,5) weicht < 0,5 x-Höhen ab
const mid = (it, cx) => it.y + it.s * (cx * Math.sin(it.rot) - 0.5 * Math.cos(it.rot));
const off = wild.map((it, i) => Math.abs(mid(it, 0.5) - mid(calm[i], 0.5)) / DEFAULTS.xHeight);
assert.ok(Math.max(...off) > 0.08 && Math.max(...off) < 0.5, `Höhenversatz ${Math.max(...off)}`);
assert.ok(wild.every(it => Math.abs(it.s / DEFAULTS.xHeight - 1) <= 0.0801), 'Größe ±8 %');
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

// ---------- Schreibfehler ----------
const w = emptyProfile();
const LET = [...'abcdehilnrstu'];
LET.forEach(ch => variantsOf(w, ch).forEach((v, i) => v.push(...line(0.2, 1 + i * 0.05))));
variantsOf(w, ' ')[0].push([[0, 0, 0.5, 0], [1.2, 0, 0.5, 10]]);
const words = 'dieser lesen schreiben rinde laster bilder handel stunde tisch'.split(' ');
const essay = Array.from({ length: 400 }, (_, i) => words[(i * 7) % words.length]).join(' ');
const glyphItems = r => r.pages.flatMap(pg => pg.items).filter(it => !it.strike);

// 0 % ändert nichts am bisherigen Ergebnis
assert.deepEqual(layout(essay, w, { chaos: 0.5, mistakes: 0 }, 5), layout(essay, w, { chaos: 0.5 }, 5));

const wm = layout(essay, w, { chaos: 0, mistakes: 1 }, 5);
const all = wm.pages.flatMap(pg => pg.items);
const strikes = all.filter(it => it.strike);
assert.ok(strikes.length >= 5, `${strikes.length} Verschreiber`);
assert.ok(strikes.length <= 400 / 8, 'nicht öfter als alle 8 Wörter');
assert.deepEqual(wm.missing, [], 'Verschreiber nutzen nur aufgenommene Zeichen');
for (const st of strikes) {
  const xs = st.strokes.flat().map(q => st.x + q[0] * st.s);
  assert.ok(Math.max(...xs) <= right + 1e-9 && Math.min(...xs) >= DEFAULTS.margin - 1, 'Streichstrich im Rand');
  // Der Strich liegt über Buchstaben derselben Zeile
  const under = all.filter(it => !it.strike && Math.abs(it.y - st.y) < 1 && it.x >= Math.min(...xs) && it.x <= Math.max(...xs));
  assert.ok(under.length >= 2, 'durchgestrichene Buchstaben darunter');
}
// Mehr Buchstaben als ohne Fehler (falscher Anfang kommt dazu), richtig geschriebenes Wort folgt
assert.ok(glyphItems(wm).length > glyphItems(layout(essay, w, { chaos: 0 }, 5)).length);
// Zeilen schwanken leicht, Druck wechselt in Grenzen
const offs = glyphItems(wm).map(it => Math.abs(it.y - lineMetrics(DEFAULTS).first - Math.round((it.y - lineMetrics(DEFAULTS).first) / DEFAULTS.lineHeight) * DEFAULTS.lineHeight));
assert.ok(Math.max(...offs) > 0.05 && Math.max(...offs) <= 0.1 * DEFAULTS.xHeight + 1e-9, `Welle ${Math.max(...offs).toFixed(3)} mm`);
const inks = all.map(it => it.ink);
assert.ok(Math.min(...inks) >= (1 - 0.18) * (1 - 0.12) - 1e-9 && Math.max(...inks) <= 1.18 + 1e-9);
assert.ok(new Set(inks.map(v => v.toFixed(3))).size > 10, 'Druck wechselt');
// Gleicher Startwert → gleiche Verschreiber
assert.deepEqual(layout(essay, w, { mistakes: 1 }, 9), layout(essay, w, { mistakes: 1 }, 9));

// misspell: anders als das Wort, gleich lang (Dreher) oder kürzer mit falschem letzten Buchstaben (Abbruch)
for (let sd = 1; sd < 200; sd++) {
  const r = rng(sd), out = misspell('Garten', ['a', 'x'], r);
  assert.notEqual(out, 'Garten');
  if (out.length === 6) assert.deepEqual([...out].sort(), [...'Garten'].sort(), out);
  else assert.ok(out.length < 6 && 'Garten'.startsWith(out.slice(0, -1)) && 'ax'.includes(out.at(-1)), out);
}
assert.equal(misspell('aaaa', ['a'], rng(1)), null, 'kein sinnvoller Fehler möglich');

// Getrennte Regler: nur Durchstreichen → Striche, aber keine Welle und kein Druckwechsel; nur Zeilen & Druck → keine Striche
const onlyStrike = layout(essay, w, { chaos: 0, strike: 1 }, 5).pages.flatMap(pg => pg.items);
assert.ok(onlyStrike.some(it => it.strike) && onlyStrike.every(it => it.ink === undefined));
assert.ok(onlyStrike.filter(it => !it.strike).every(it => Math.abs(((it.y - lineMetrics(DEFAULTS).first) / DEFAULTS.lineHeight) % 1) < 1e-9 || Math.abs(((it.y - lineMetrics(DEFAULTS).first) / DEFAULTS.lineHeight) % 1) > 1 - 1e-9), 'keine Welle');
const onlyWobble = layout(essay, w, { chaos: 0, wobble: 1 }, 5).pages.flatMap(pg => pg.items);
assert.ok(!onlyWobble.some(it => it.strike) && onlyWobble.some(it => it.ink !== 1));
// Mehr Durchstreichen → mehr Verschreiber
const strikeCount = v => layout(essay, w, { strike: v }, 5).pages.flatMap(pg => pg.items).filter(it => it.strike).length;
assert.ok(strikeCount(0) === 0 && strikeCount(0.3) < strikeCount(1), `${strikeCount(0.3)} < ${strikeCount(1)}`);

// Ränder: Zeilen beginnen unterschiedlich weit eingerückt (höchstens 1,2 x-Höhen), enden unterschiedlich, nie über den Rand
const edgeItems = layout(essay, w, { chaos: 0, edges: 1 }, 5).pages[0].items;
const rows = new Map();
for (const it of edgeItems) { const r = rows.get(it.y) || []; r.push(it); rows.set(it.y, r); }
const starts = [...rows.values()].map(r => Math.min(...r.map(it => it.x)));
const ends = [...rows.values()].slice(0, -1).map(r => Math.max(...r.map(it => it.x + 1.3 * it.s)));
assert.ok(new Set(starts.map(v => v.toFixed(2))).size > 5, 'Zeilenanfänge wandern');
const plain = Math.min(...layout(essay, w, { chaos: 0 }, 5).pages[0].items.map(it => it.x));
assert.ok(starts.every(v => v >= plain - 1e-9 && v <= plain + 1.2 * DEFAULTS.xHeight + 1e-9), 'Einzug in Grenzen');
assert.ok(ends.every(v => v <= right + 0.5) && Math.max(...ends) - Math.min(...ends) > 3, 'rechter Rand flattert');
assert.deepEqual(layout(essay, w, { edges: 0 }, 5), layout(essay, w, {}, 5), 'Ränder 0 % ändert nichts');

// Müdigkeit: Anfang unverändert, Ende größer und nach rechts gelehnt; 0 % ändert nichts
const tiredItems = layout(essay, w, { chaos: 0, fatigue: 1 }, 5).pages.flatMap(pg => pg.items);
const restItems = layout(essay, w, { chaos: 0 }, 5).pages.flatMap(pg => pg.items);
assert.ok(Math.abs(tiredItems[0].s - restItems[0].s) < 1e-9 && tiredItems[0].rot === 0, 'Anfang wie ausgeruht');
const avg = (arr, f) => arr.reduce((n, it) => n + f(it), 0) / arr.length;
const tail = tiredItems.slice(-50);
assert.ok(avg(tail, it => it.s) / DEFAULTS.xHeight > 1.09, `Ende größer (${avg(tail, it => it.s).toFixed(3)})`);
assert.ok(avg(tail, it => it.rot) * deg > 4 && avg(tail, it => it.rot) * deg < 5.5, `Ende gelehnt (${(avg(tail, it => it.rot) * deg).toFixed(1)}°)`);
assert.ok(tail.some(it => Math.abs(it.rot * deg - 5) > 0.5), 'Ende auch unordentlicher');
assert.ok(tiredItems.length === restItems.length, 'gleiche Buchstaben');
assert.ok(layout(essay, w, { fatigue: 1 }, 5).pages.length >= layout(essay, w, {}, 5).pages.length, 'braucht mehr Platz');
assert.deepEqual(layout(essay, w, { chaos: 0.5, fatigue: 0 }, 5), layout(essay, w, { chaos: 0.5 }, 5));

// Korrekturen: nachgezogene Buchstaben und vergessene Wörter mit ^; 0 % ändert nichts
const fixed = layout(essay, w, { chaos: 0, fix: 1 }, 5).pages.flatMap(pg => pg.items);
const carets = fixed.filter(it => it.caret), inserted = fixed.filter(it => it.inserted), retraced = fixed.filter(it => it.retrace);
assert.ok(carets.length >= 2 && retraced.length >= 5, `${carets.length} ^, ${retraced.length} nachgezogen`);
assert.ok(carets.length <= 400 / 12 + 1, 'nicht öfter als alle 12 Wörter');
for (const c of carets) {
  const above = inserted.filter(it => Math.abs(it.y - (c.y - 2.1 * DEFAULTS.xHeight)) < 0.5);
  assert.ok(above.length >= 3, 'eingefügtes Wort steht über dem ^');
  assert.ok(above.every(it => it.s < DEFAULTS.xHeight * 0.8), 'und ist kleiner');
}
// Kein Buchstabe geht verloren: normale + eingefügte = Buchstaben ohne Korrekturen
const plainCount = restItems.length;
assert.equal(fixed.filter(it => !it.caret && !it.retrace).length, plainCount);
assert.deepEqual(layout(essay, w, { chaos: 0.5, fix: 0 }, 5), layout(essay, w, { chaos: 0.5 }, 5));
// Korrekturen verschieben die Verschreiber nicht
const slips = o2 => layout(essay, w, o2, 5).pages.flatMap(pg => pg.items).filter(it => it.strike).length;
assert.ok(slips({ strike: 1, fix: 1 }) > 0);

console.log('OK – Layout');

// Zeilen versetzen: jede Zeile rückt für sich, bleibt aber auf dem Blatt (mind. 4 mm Abstand zur Kante)
{
  const many = Array(200).fill('abba').join(' ');
  const shifted = layout(many, p, { lineShift: 1, margin: 6 }, 3).pages.flatMap(pg => pg.items);
  const starts = new Map();
  for (const it of shifted) {
    const b = bounds(it.strokes);
    assert.ok(it.x + b.minX * it.s >= 4 - 0.01 && it.x + b.maxX * it.s <= DEFAULTS.pageW - 4 + 0.01, 'versetzte Zeile bleibt auf dem Blatt');
    starts.set(it.y, Math.min(starts.get(it.y) ?? Infinity, it.x));
  }
  assert.ok(new Set([...starts.values()].map(x => x.toFixed(1))).size > 3, 'Zeilen beginnen an verschiedenen Stellen');
  const plain = layout(many, p, { lineShift: 0 }, 3).pages[0].items;
  assert.ok(new Set(plain.filter((it, i, a) => i === 0 || a[i - 1].y !== it.y).map(it => it.x.toFixed(2))).size === 1, 'ohne Versatz gleicher Zeilenanfang');
}

// Fehlt ß, wird „ss“ geschrieben (statt rotem Kästchen), sofern s aufgenommen ist
{
  const q = emptyProfile();
  variantsOf(q, 's').forEach(v => v.push(...line(0.3, 1.2)));
  const r = layout('ß', q);
  assert.deepEqual(r.missing, []);
  assert.equal(r.pages[0].items.length, 2);
}

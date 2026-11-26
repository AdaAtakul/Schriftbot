// Selbsttest für die GoodNotes-Papiervorlagen: node tests/paper.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { paperShapes, paperLines, PAPER_KINDS, PT } from '../js/paper.js';
import { layout, DEFAULTS } from '../js/layout.js';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { buildPdf } from '../js/export.js';

globalThis.window = { jspdf: createRequire(import.meta.url)('../vendor/jspdf.umd.min.js') };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const A4 = [210, 297];

// Liniert breit: erste Linie 49,5 pt (Oberkante), Abstand 25 pt ≈ 8,82 mm, Linien 0,5 pt, enden ≥ 13,2 pt über dem Rand
const wide = paperShapes('liniert-breit', 'weiss', ...A4);
assert.ok(near(wide.rects[0][1], 49.5 * PT) && near(wide.rects[0][3], 0.5 * PT));
assert.ok(near(wide.rects[1][1] - wide.rects[0][1], 25 * PT));
assert.ok(near(25 * PT, 8.819, 1e-3));
const lastWide = wide.rects.at(-1);
assert.ok((lastWide[1] + lastWide[3]) / PT <= 297 / PT - 13.2 + 1e-9);
assert.equal(wide.color, '#d0d2d3');
// Liniert schmal: ab 50 pt, alle 17,5 pt
const narrow = paperShapes('liniert-schmal', 'weiss', ...A4);
assert.ok(near(narrow.rects[0][1], 50 * PT) && near(narrow.rects[1][1] - narrow.rects[0][1], 17.5 * PT));
// Kariert: Linien enden auf jedem Vielfachen von 16 pt, waagerecht und senkrecht über die ganze Seite
const grid = paperShapes('kariert', 'weiss', ...A4);
const hz = grid.rects.filter(r => r[2] > r[3]), vt = grid.rects.filter(r => r[3] > r[2]);
assert.equal(hz.length, Math.ceil((297 / PT + 0.5) / 16) - 1);
assert.equal(vt.length, Math.ceil((210 / PT + 0.5) / 16) - 1);
assert.ok(hz.every((r, j) => near(r[1] + r[3], 16 * (j + 1) * PT)));
// Gepunktet: Radius 0,5 pt, alle 16 pt
const dots = paperShapes('gepunktet', 'weiss', ...A4).dots;
assert.ok(near(dots[0][0], 16 * PT) && near(dots[0][2], 0.5 * PT) && near(dots[1][0] - dots[0][0], 16 * PT));
// Blanko: nur Fläche; Farben
assert.deepEqual(paperShapes('blanko', 'gelb', ...A4).rects, []);
assert.equal(paperShapes('blanko', 'gelb', ...A4).fill, '#f8f7e9');
const dark = paperShapes('kariert', 'dunkel', ...A4);
assert.ok(dark.fill === '#333333' && dark.color === '#58595b' && dark.dark);

// Schrift steht auf jedem Papier genau auf einer Linie (Mitte des Balkens) bzw. Punktreihe
const p = emptyProfile();
variantsOf(p, 'a').forEach(v => v.push([[0.2, 0, 0.5, 0], [0.9, -1, 0.5, 10]]));
for (const kind of ['liniert-breit', 'liniert-schmal', 'kariert', 'gepunktet']) {
  const lines = paperLines(kind), shapes = paperShapes(kind, 'weiss', ...A4);
  const ys = shapes.dots.length ? shapes.dots.map(d => d[1]) : shapes.rects.filter(r => r[2] > r[3]).map(r => r[1] + r[3] / 2);
  const o = { ...DEFAULTS, ...lines, lineHeight: lines.lineSpacing, chaos: 0 };
  const items = layout(Array(400).fill('aaaa').join(' '), p, o).pages.flatMap(pg => pg.items);
  for (const it of items) assert.ok(ys.some(y => near(y, it.y, 1e-9)), `${kind}: Grundlinie ${it.y} liegt auf einer Linie`);
}

// PDF mit Papier: Seite entsteht, Punkte und Karos als Vektor
for (const kind of Object.keys(PAPER_KINDS)) {
  const o = { ...DEFAULTS, paper: kind, paperColor: 'gelb', ...paperLines(kind) };
  const pdf = Buffer.from(await buildPdf({ pages: [{ items: [] }] }, o, '#1f4fbf', true).arrayBuffer()).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'), kind);
}
console.log(`OK – Papier: ${Object.keys(PAPER_KINDS).length} Vorlagen, liniert breit ${(25 * PT).toFixed(2)} mm, kariert ${(16 * PT).toFixed(2)} mm`);

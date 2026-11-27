// Schriftzug „DeineSchrift“ aus der Beispielhandschrift als SVG-Mittellinien: node tools/logo.mjs [Text]
// Ergebnis wird als <symbol id="i-logo"> in index.html und als Logo der Themenseiten eingesetzt (einmalig erzeugt).
import { readFileSync } from 'node:fs';
import { layout } from '../js/layout.js';
import { simplify } from '../js/export.js';

const data = JSON.parse(readFileSync(new URL('../demo/demo-schrift.json', import.meta.url), 'utf8'));
const hw = data.profiles[0].handwriting;
const r = layout(process.argv[2] || 'DeineSchrift', hw, { xHeight: 10, margin: 0, pageW: 1000, pageH: 1000, chaos: 0, connect: 1, ruled: false, lineTop: 0 }, 3);
const lines = r.pages[0].items.filter(it => !it.missing).flatMap(it => {
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  return it.strokes.map(st => simplify(st.map(([px, py]) => [it.x + (px * c - py * s) * it.s, it.y + (px * s + py * c) * it.s]), 0.12));
});
const pad = 1.5, xs = lines.flat().map(p => p[0]), ys = lines.flat().map(p => p[1]);
const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
const f = n => +n.toFixed(1);
const d = lines.map(p => (p.length === 1 ? [p[0], p[0]] : p).map(([x, y], i) => `${i ? 'L' : 'M'}${f(x - x0)} ${f(y - y0)}`).join('')).join('');
console.log(JSON.stringify({ viewBox: `0 0 ${f(Math.max(...xs) - x0 + pad)} ${f(Math.max(...ys) - y0 + pad)}`, d }));

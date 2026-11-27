// Kleine Schriftprobe („Hallo“) als SVG-Pfad aus Mittellinien, für die Karten der Schrift-Auswahl.
// Mitgelieferte Schriften: einmal vorab erzeugt (tools/vorschau.mjs → js/vorschau-daten.js), eigene: live im Browser.
import { layout } from './layout.js';
import { simplify } from './export.js';

export function previewPath(handwriting, text = 'Hallo') {
  const r = layout(text, handwriting, { xHeight: 10, margin: 0, pageW: 1000, pageH: 1000, chaos: 0, connect: 1, ruled: false, lineTop: 0 }, 3);
  const lines = r.pages[0].items.filter(it => !it.missing).flatMap(it => {
    const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
    return it.strokes.map(st => simplify(st.map(([px, py]) => [it.x + (px * c - py * s) * it.s, it.y + (px * s + py * c) * it.s]), 0.15));
  });
  if (!lines.length) return null;
  const pad = 2, xs = lines.flat().map(p => p[0]), ys = lines.flat().map(p => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const f = n => +n.toFixed(1);
  const d = lines.map(p => (p.length === 1 ? [p[0], p[0]] : p).map(([x, y], i) => `${i ? 'L' : 'M'}${f(x - x0)} ${f(y - y0)}`).join('')).join('');
  return { viewBox: `0 0 ${f(Math.max(...xs) - x0 + pad)} ${f(Math.max(...ys) - y0 + pad)}`, d };
}

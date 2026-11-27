// Fehlende Zeichen der mitgelieferten Schriften aus ihren eigenen Strichen nachbilden: node tools/zeichen-nachbilden.mjs
// „ und ‚ aus dem Komma, “ und ‘ aus dem umgedrehten Komma oben, ß aus langem Stamm und der eigenen Ziffer 3.
// Anführungszeichen nur, wenn sie fehlen; ß wird immer neu gebildet. Koordinaten: Grundlinie y = 0, x-Höhe y = −1.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const r3 = n => Math.round(n * 1000) / 1000;
const bounds = v => { const xs = v.flat().map(p => p[0]), ys = v.flat().map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const map = (v, f) => v.map(st => st.map(p => { const [x, y] = f(p[0], p[1]); return [r3(x), r3(y), p[2], p[3]]; }));

// Komma an den Ursprung schieben (linke Kante x = 0, Unterkante y = 0)
const norm = v => { const b = bounds(v); return map(v, (x, y) => [x - b.x0, y - b.y1]); };
const lowSingle = c => map(norm(c), (x, y) => [x + 0.05, y + 0.15]);
const lowDouble = c => { const n = norm(c), w = bounds(n).x1 + 0.2; return [...map(n, (x, y) => [x + 0.05, y + 0.15]), ...map(n, (x, y) => [x + 0.05 + w, y + 0.15])]; };
// oben, um 180° gedreht („66“-Form): Spitze zeigt nach unten-rechts wie bei handgeschriebenen deutschen Anführungszeichen
const high = (c, twice) => {
  const n = norm(c), b = bounds(n), w = b.x1 + 0.2;
  const turned = map(n, (x, y) => [b.x1 - x, -y - 1.75]);
  return twice ? [...map(turned, (x, y) => [x + 0.05, y]), ...map(turned, (x, y) => [x + 0.05 + w, y])] : map(turned, (x, y) => [x + 0.05, y]);
};
// ß wie von Hand in einem Zug: langer Stamm aus der Unterlänge bis zur Oberlänge (Neigung wie das eigene „l“),
// oben im Bogen hinüber in die eigene Ziffer „3“, die den rechten Teil bildet.
// three: eine Variante der 3, l: eine Variante des l (für Neigung und Oberlänge)
function eszett(three, l) {
  const t = three.reduce((a, s) => (s.length > a.length ? s : a), []);
  if (t.length < 4) return [];
  const lp = l.flat(), lTop = lp.reduce((a, p) => (p[1] < a[1] ? p : a));
  // Neigung als Ausgleichsgerade über alle Punkte (Anstriche und Schleifen verzerren sie so kaum), begrenzt auf −6° … +17°
  const my = lp.reduce((n, p) => n + p[1], 0) / lp.length, mx = lp.reduce((n, p) => n + p[0], 0) / lp.length;
  const vy = lp.reduce((n, p) => n + (p[1] - my) ** 2, 0) || 1, cxy = lp.reduce((n, p) => n + (p[0] - mx) * (p[1] - my), 0);
  const lean = Math.max(-0.1, Math.min(0.3, -cxy / vy)); // > 0: nach rechts geneigt
  const top = Math.max(-2.1, Math.min(-1.5, lTop[1] + 0.1));           // Oberlänge wie beim l, etwas tiefer
  // 3 so drehen, dass sie oben beginnt, und auf Oberlänge bis Grundlinie bringen
  const pts = t[0][1] <= t[t.length - 1][1] ? t : [...t].reverse();
  const b = bounds([pts]), h = (b.y1 - b.y0) || 1, sy = (0.02 - (top + 0.12)) / h, sx = Math.min(sy, 0.62 / ((b.x1 - b.x0) || 1));
  const stemX = 0.12;
  const xAt = y => stemX - lean * y; // Stamm-x auf Höhe y (geneigt wie das l)
  const right = pts.map(p => [xAt(top) + 0.14 + (p[0] - b.x0) * sx - lean * ((p[1] - b.y1) * sy), 0.02 + (p[1] - b.y1) * sy, p[2]]);
  const pr = right.reduce((n, p) => n + p[2], 0) / right.length;
  const stem = [];
  for (let i = 0; i <= 12; i++) { const y = 0.55 + (top + 0.2 - 0.55) * i / 12; stem.push([xAt(y), y, pr]); }
  // Bogen oben vom Stamm zum Anfang der 3 (quadratische Kurve über einen Punkt oberhalb)
  const [sxTop, syTop] = stem[stem.length - 1], [ax, ay] = right[0], cx = (sxTop + ax) / 2, cy = Math.min(syTop, ay) - 0.25;
  const arc = [];
  for (let i = 1; i < 8; i++) { const u = i / 8, w = 1 - u; arc.push([w * w * sxTop + 2 * w * u * cx + u * u * ax, w * w * syTop + 2 * w * u * cy + u * u * ay, pr]); }
  return [[...stem, ...arc, ...right].map((p, i) => [r3(p[0]), r3(p[1]), r3(p[2]), i * 8])];
}

for (const f of readdirSync(new URL('../schriften/', import.meta.url)).filter(n => n.endsWith('.json'))) {
  const url = new URL('../schriften/' + f, import.meta.url);
  const data = JSON.parse(readFileSync(url, 'utf8'));
  const g = data.profiles[0].handwriting.glyphs;
  const empty = k => !g[k] || g[k].every(v => !v.length);
  const comma = (g[','] || []).filter(v => v.length), threes = (g['3'] || []).filter(v => v.length), ls = (g['l'] || []).filter(v => v.length);
  const add = (k, make, src) => { if (empty(k) && src.length) g[k] = [0, 1, 2].map(i => (src[i % src.length] ? make(src[i % src.length]) : [])); };
  add('„', lowDouble, comma);
  add('‚', lowSingle, comma);
  add('“', c => high(c, true), comma);
  add('‘', c => high(c, false), comma);
  // ß gibt es in der Sammlung nie: immer neu bilden (ersetzt auch die frühere Version aus dem B)
  if (threes.length && ls.length) g['ß'] = [0, 1, 2].map(i => eszett(threes[i % threes.length], ls[i % ls.length]));
  writeFileSync(url, JSON.stringify(data));
  console.log(f, ['„', '‚', '“', '‘', 'ß'].map(k => k + (empty(k) ? '✗' : '✓')).join(' '));
}

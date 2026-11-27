// Fehlende Zeichen der mitgelieferten Schriften aus ihren eigenen Strichen nachbilden: node tools/zeichen-nachbilden.mjs
// „ und ‚ aus dem Komma, “ und ‘ aus dem umgedrehten Komma oben, ß aus dem großen B mit Unterlänge.
// Ändert nur Zeichen, die noch fehlen; vorhandene bleiben unberührt. Koordinaten: Grundlinie y = 0, x-Höhe y = −1.
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
// ß wie oft von Hand geschrieben: ein schmales B, dessen Stamm bis in die Unterlänge reicht
function eszett(B) {
  const b = bounds(B), sx = 0.8, h = (b.y1 - b.y0) || 1;
  const v = map(B, (x, y) => [(x - b.x0) * sx + 0.08, b.y1 + (y - b.y1) * (1.75 / h)]);
  const stemIdx = v.map((st, i) => [i, st.reduce((n, p) => n + p[0], 0) / st.length]).sort((a, c) => a[1] - c[1])[0][0];
  const stem = v[stemIdx], bottom = stem.reduce((m, p, i) => (p[1] > stem[m][1] ? i : m), 0), from = stem[bottom];
  const tail = [1, 2, 3, 4].map(k => [r3(from[0] - 0.01 * k), r3(from[1] + 0.14 * k), from[2], from[3] + 12 * k]);
  v[stemIdx] = bottom === stem.length - 1 ? [...stem, ...tail] : [...tail.reverse(), ...stem.slice(bottom)];
  return v;
}

for (const f of readdirSync(new URL('../schriften/', import.meta.url)).filter(n => n.endsWith('.json'))) {
  const url = new URL('../schriften/' + f, import.meta.url);
  const data = JSON.parse(readFileSync(url, 'utf8'));
  const g = data.profiles[0].handwriting.glyphs;
  const empty = k => !g[k] || g[k].every(v => !v.length);
  const comma = (g[','] || []).filter(v => v.length), B = (g['B'] || []).filter(v => v.length);
  const add = (k, make, src) => { if (empty(k) && src.length) g[k] = [0, 1, 2].map(i => (src[i % src.length] ? make(src[i % src.length]) : [])); };
  add('„', lowDouble, comma);
  add('‚', lowSingle, comma);
  add('“', c => high(c, true), comma);
  add('‘', c => high(c, false), comma);
  add('ß', eszett, B);
  writeFileSync(url, JSON.stringify(data));
  console.log(f, ['„', '‚', '“', '‘', 'ß'].map(k => k + (empty(k) ? '✗' : '✓')).join(' '));
}

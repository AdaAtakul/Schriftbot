// Striche mit Druck darstellen (perfect-freehand). Wird später auch für Vorschau und PDF genutzt.
import { getStroke } from '../vendor/perfect-freehand.mjs';

export const PEN_SIZE = 0.13; // Strichbreite in x-Höhen
// Textmarker im Lernzettel-Modus: breiter, gleichmäßiger Strich, durchsichtig gelb (unter der Schrift)
export const MARKER = { color: '#ffd54a', rgba: [1, 0.835, 0.29, 0.5], alpha: 0.5, size: 0.75, pen: 'filz' };

const OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.35, simulatePressure: false, last: true };

// Stiftarten: Breite im Verhältnis zum Kugelschreiber, wie stark der Druck die Breite ändert, Graphit-Ton beim Bleistift
export const PENS = {
  kugel: { label: 'Kugelschreiber', size: 1, thinning: 0.6 },
  fueller: { label: 'Füller', size: 1.2, thinning: 0.9 },
  bleistift: { label: 'Bleistift', size: 0.85, thinning: 0.3, tone: 0.32 },
  filz: { label: 'Filzstift', size: 1.7, thinning: 0.05 },
};
const penOf = pen => PENS[pen] || PENS.kugel;
export const penWidth = pen => penOf(pen).size;

// Bleistift wirkt heller: Tinte Richtung Grau mischen
export function penColor(color, pen) {
  const t = penOf(pen).tone;
  if (!t || !/^#[0-9a-f]{6}$/i.test(color)) return color;
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - t) + 0xa8 * t).toString(16).padStart(2, '0')).join('');
}

// Umriss eines Strichs als Polygon [[x, y], ...] im selben Koordinatensystem wie die Punkte.
// perfect-freehand hat feste Pixel-Schwellen (z. B. 3 px), daher intern auf ~100 px je x-Höhe skalieren.
const S = 100;
export function outline(points, size = PEN_SIZE, pen) {
  const p = penOf(pen);
  return getStroke(points.map(q => [q[0] * S, q[1] * S, q[2]]), { ...OPTIONS, thinning: p.thinning, size: size * p.size * S })
    .map(([x, y]) => [x / S, y / S]);
}

export function fillStrokes(ctx, strokes, size = PEN_SIZE, pen) {
  for (const s of strokes) {
    const poly = outline(s, size, pen);
    if (!poly.length) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.fill();
  }
}

// Für die Vorschau: Umrisse je Strich zwischenspeichern (Path2D), damit Regler flüssig laufen.
// Gilt nur für fertige Striche; eine Änderung der Punkte (Länge, Anfang, Ende) macht den Eintrag ungültig.
const pathCache = new WeakMap();
const sig = st => `${st.length}|${st[0]?.[0]}|${st[0]?.[1]}|${st[st.length - 1]?.[0]}|${st[st.length - 1]?.[1]}`;
function pathOf(st, size, pen) {
  let e = pathCache.get(st);
  const k = sig(st);
  if (!e || e.k !== k) pathCache.set(st, e = { k, sizes: new Map() });
  const key = (pen || 'kugel') + Math.round(size * 1e4);
  let path = e.sizes.get(key);
  if (path === undefined) {
    const poly = outline(st, size, pen);
    path = null;
    if (poly.length) {
      path = new Path2D();
      path.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) path.lineTo(poly[i][0], poly[i][1]);
      path.closePath();
    }
    e.sizes.set(key, path);
  }
  return path;
}
export function fillStrokesCached(ctx, strokes, size = PEN_SIZE, pen) {
  if (typeof Path2D === 'undefined') return fillStrokes(ctx, strokes, size, pen);
  for (const st of strokes) {
    const path = pathOf(st, size, pen);
    if (path) ctx.fill(path);
  }
}

// Striche mit Druck darstellen (perfect-freehand). Wird später auch für Vorschau und PDF genutzt.
import { getStroke } from '../vendor/perfect-freehand.mjs';

export const PEN_SIZE = 0.13; // Strichbreite in x-Höhen

const OPTIONS = { thinning: 0.6, smoothing: 0.5, streamline: 0.35, simulatePressure: false, last: true };

// Umriss eines Strichs als Polygon [[x, y], ...] im selben Koordinatensystem wie die Punkte.
// perfect-freehand hat feste Pixel-Schwellen (z. B. 3 px), daher intern auf ~100 px je x-Höhe skalieren.
const S = 100;
export function outline(points, size = PEN_SIZE) {
  return getStroke(points.map(p => [p[0] * S, p[1] * S, p[2]]), { ...OPTIONS, size: size * S })
    .map(([x, y]) => [x / S, y / S]);
}

export function fillStrokes(ctx, strokes, size = PEN_SIZE) {
  for (const s of strokes) {
    const poly = outline(s, size);
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
function pathOf(st, size) {
  let e = pathCache.get(st);
  const k = sig(st);
  if (!e || e.k !== k) pathCache.set(st, e = { k, sizes: new Map() });
  const key = Math.round(size * 1e4);
  let path = e.sizes.get(key);
  if (path === undefined) {
    const poly = outline(st, size);
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
export function fillStrokesCached(ctx, strokes, size = PEN_SIZE) {
  if (typeof Path2D === 'undefined') return fillStrokes(ctx, strokes, size);
  for (const st of strokes) {
    const path = pathOf(st, size);
    if (path) ctx.fill(path);
  }
}

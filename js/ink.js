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

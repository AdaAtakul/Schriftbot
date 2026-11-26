// Eine Layout-Seite auf ein Canvas zeichnen. ctx muss bereits in mm skaliert sein.
import { fillStrokesCached, PEN_SIZE } from './ink.js';
import { paperShapes } from './paper.js';

export const MISSING_COLOR = '#d0021b';

// GoodNotes-Papier (Farbe, Linien, Karos, Punkte) zeichnen. ctx muss in mm skaliert sein.
export function drawPaper(ctx, o) {
  const p = paperShapes(o.paper, o.paperColor, o.pageW, o.pageH);
  ctx.fillStyle = p.fill;
  ctx.fillRect(0, 0, o.pageW, o.pageH);
  ctx.fillStyle = p.color;
  for (const [x, y, w, h] of p.rects) ctx.fillRect(x, y, w, h);
  if (p.dots.length) {
    ctx.beginPath();
    for (const [x, y, r] of p.dots) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI); }
    ctx.fill();
  }
}

export function drawPage(ctx, page, color, size = PEN_SIZE) {
  for (const it of page.items) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot || 0);
    ctx.scale(it.s, it.s);
    if (it.missing) {
      // Fehlendes Zeichen: rotes Kästchen mit dem Zeichen in Druckschrift
      const w = it.w / it.s;
      ctx.fillStyle = 'rgba(208, 2, 27, 0.12)';
      ctx.fillRect(0, -1.6, w, 2);
      ctx.strokeStyle = MISSING_COLOR;
      ctx.lineWidth = 0.08;
      ctx.strokeRect(0, -1.6, w, 2);
      ctx.fillStyle = MISSING_COLOR;
      ctx.font = 'bold 1.3px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it.missing === ' ' ? '␣' : it.missing, w / 2, 0);
    } else {
      ctx.fillStyle = color;
      fillStrokesCached(ctx, it.strokes, size * (it.ink || 1)); // ink: Druck des Wortes (Schreibfehler-Regler)
    }
    ctx.restore();
  }
}

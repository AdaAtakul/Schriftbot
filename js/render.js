// Eine Layout-Seite auf ein Canvas zeichnen. ctx muss bereits in mm skaliert sein.
import { fillStrokes } from './ink.js';

export const MISSING_COLOR = '#d0021b';

// Papier nur für die Vorschau (die Linien kommen in GoodNotes vom Hintergrund).
export function drawPaper(ctx, o) {
  if (!o.ruled) return;
  ctx.strokeStyle = '#b8c7dc';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  for (let y = o.lineTop; y <= o.pageH; y += o.lineSpacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(o.pageW, y);
  }
  if (o.grid) {
    for (let x = (o.pageW % o.lineSpacing) / 2; x <= o.pageW; x += o.lineSpacing) {
      ctx.moveTo(x, o.lineTop);
      ctx.lineTo(x, o.pageH);
    }
  }
  ctx.stroke();
}

export function drawPage(ctx, page, color) {
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
      fillStrokes(ctx, it.strokes);
    }
    ctx.restore();
  }
}

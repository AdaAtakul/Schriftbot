// Eine Layout-Seite auf ein Canvas zeichnen. ctx muss bereits in mm skaliert sein.
import { fillStrokes, fillStrokesCached, PEN_SIZE } from './ink.js';
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

export function drawPage(ctx, page, color, size = PEN_SIZE, pen) {
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
      fillStrokesCached(ctx, it.strokes, size * (it.ink || 1), pen); // ink: Druck des Wortes (Schreibfehler-Regler)
    }
    ctx.restore();
  }
}

// Seite sich selbst hinschreiben lassen: Striche in Schreibreihenfolge mit ihrer echten Aufnahmezeit,
// beschleunigt auf höchstens maxMs. ctx wie bei drawPage (Papier schon gezeichnet). Gibt eine Abbruch-Funktion zurück.
export function animatePage(ctx, page, color, size = PEN_SIZE, pen, maxMs = 4000) {
  const GAP = 70; // Stift absetzen zwischen zwei Strichen (ms)
  const steps = [];
  let total = 0;
  for (const it of page.items) {
    if (it.missing || !it.strokes) continue;
    for (const st of it.strokes) {
      if (!st.length) continue;
      const t0 = st[0][3] || 0, dur = Math.max(30, (st[st.length - 1][3] || 0) - t0);
      steps.push({ it, st, t0, start: total, dur });
      total += dur + GAP;
    }
  }
  drawPage(ctx, { items: page.items.filter(it => it.missing) }, color, size, pen); // rote Lücken stehen sofort da
  const speed = Math.max(1.5, total / maxMs);
  const place = it => { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0); ctx.scale(it.s, it.s); ctx.fillStyle = color; };
  let i = 0, raf = 0, begin = 0;
  const frame = now => {
    begin ||= now;
    const elapsed = (now - begin) * speed;
    while (i < steps.length && steps[i].start + steps[i].dur <= elapsed) {
      const { it, st } = steps[i++];
      place(it); fillStrokesCached(ctx, [st], size * (it.ink || 1), pen); ctx.restore();
    }
    // Strich in Arbeit: nur die Punkte bis jetzt (wird mit jedem Bild länger und deckt sich selbst)
    if (i < steps.length && steps[i].start < elapsed) {
      const { it, st, t0, start } = steps[i], upto = t0 + elapsed - start;
      const part = st.filter(p => (p[3] || 0) <= upto);
      if (part.length > 1) { place(it); fillStrokes(ctx, [part], size * (it.ink || 1), pen); ctx.restore(); }
    }
    if (i < steps.length) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

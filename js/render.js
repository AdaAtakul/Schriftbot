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

// Sinus-Kurve: Tempo 0 am Anfang und Ende, am höchsten in der Mitte
export const easeInOut = t => (1 - Math.cos(Math.PI * t)) / 2;

// Kleiner Pop beim Einblenden: von 95 % Größe hoch, knapp über 100 % hinaus, dann ruhig auf 100 % (Back-out)
export const popScale = u => { const c = 1.70158, v = u - 1; return 0.95 + 0.05 * (1 + (c + 1) * v ** 3 + c * v ** 2); };
const FADE = 0.3, POP = 0.45; // Anteil der Animationsdauer für Einblenden und Pop

// Seite sich selbst hinschreiben lassen: Striche in Schreibreihenfolge mit ihrer echten Aufnahmezeit,
// gerafft auf höchstens maxMs, mit Ease-in-out; die Schrift (nicht das Papier) blendet dabei ein und ploppt leicht auf.
// ctx wie bei drawPage (Papier schon gezeichnet). Gibt eine Abbruch-Funktion zurück.
export function animatePage(ctx, page, color, size = PEN_SIZE, pen, maxMs = 1000) {
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
  const duration = total / Math.max(1.5, total / maxMs);
  // Papier (und rote Lücken) einmal merken: jedes Bild zeichnet die Schrift neu darüber, mit Deckkraft und Größe
  const base = ctx.getTransform(), bg = document.createElement('canvas');
  bg.width = ctx.canvas.width;
  bg.height = ctx.canvas.height;
  bg.getContext('2d').drawImage(ctx.canvas, 0, 0);
  // Pop um die Mitte der Schrift, damit sie an ihrem Platz bleibt
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { it } of steps) { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x); y0 = Math.min(y0, it.y); y1 = Math.max(y1, it.y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const place = it => { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0); ctx.scale(it.s, it.s); ctx.fillStyle = color; };
  let raf = 0, begin = 0;
  const frame = now => {
    begin ||= now;
    const t = Math.min(1, (now - begin) / duration);
    // Ease-in-out: langsam anfangen, in der Mitte am schnellsten, sanft auslaufen (Tempo wie eine Glocke)
    const elapsed = total * easeInOut(t), k = popScale(Math.min(1, t / POP));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(base);
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = Math.min(1, t / FADE);
    for (const { it, st, t0, start, dur } of steps) {
      if (start >= elapsed) break;
      place(it);
      if (start + dur <= elapsed) fillStrokesCached(ctx, [st], size * (it.ink || 1), pen);
      else {
        // Strich in Arbeit: nur die Punkte bis jetzt
        const part = st.filter(p => (p[3] || 0) <= t0 + elapsed - start);
        if (part.length > 1) fillStrokes(ctx, [part], size * (it.ink || 1), pen);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(base);
    if (t < 1) raf = requestAnimationFrame(frame);
    else bg.width = bg.height = 0; // Speicher auf dem iPad sofort freigeben
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); bg.width = bg.height = 0; };
}

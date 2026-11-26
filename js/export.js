// Modul 3: Export als PDF (Vektor) und PNG, Weitergabe über das Teilen-Menü (z. B. an GoodNotes).
import { outline, PEN_SIZE } from './ink.js';
import { drawPage, drawPaper, MISSING_COLOR } from './render.js';

const PNG_DPI = 300;
const PAPER_LINE = '#b8c7dc';

// Umrisse eines Glyph-Items in Seitenkoordinaten (mm): Drehung und Skalierung schon angewendet.
export function itemPolygons(it, size = PEN_SIZE) {
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  return it.strokes.map(st => outline(st, size * (it.ink || 1)).map(([px, py]) => [
    it.x + (px * c - py * s) * it.s,
    it.y + (px * s + py * c) * it.s,
  ]));
}

// Douglas-Peucker: entfernt Punkte, die weniger als tol (mm) von der Linie abweichen. Hält das PDF klein.
export function simplify(pts, tol = 0.02) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = len > 1e-9
        ? Math.abs(dx * (ay - pts[i][1]) - dy * (ax - pts[i][0])) / len
        : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function buildPdf(result, o, color, withPaper) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: [o.pageW, o.pageH], compress: true });
  doc.setProperties({ title: 'Handschrift', creator: 'Handschrift-Tool' });
  result.pages.forEach((page, i) => {
    if (i) doc.addPage([o.pageW, o.pageH]);
    if (withPaper && o.ruled) {
      doc.setDrawColor(PAPER_LINE);
      doc.setLineWidth(0.2);
      for (let y = o.lineTop; y <= o.pageH; y += o.lineSpacing) doc.line(0, y, o.pageW, y);
      if (o.grid) for (let x = (o.pageW % o.lineSpacing) / 2; x <= o.pageW; x += o.lineSpacing) doc.line(x, o.lineTop, x, o.pageH);
    }
    for (const it of page.items) {
      if (it.missing) {
        // Fehlendes Zeichen rot markieren (wie in der Vorschau)
        doc.setDrawColor(MISSING_COLOR);
        doc.setFillColor('#f9dde0');
        doc.setLineWidth(0.08 * it.s);
        doc.rect(it.x, it.y - 1.6 * it.s, it.w, 2 * it.s, 'FD');
        doc.setTextColor(MISSING_COLOR);
        doc.setFontSize(1.3 * it.s * 72 / 25.4);
        doc.text(it.missing === ' ' ? '_' : it.missing, it.x + it.w / 2, it.y, { align: 'center' });
        continue;
      }
      doc.setFillColor(color);
      for (const poly of itemPolygons(it, o.penSize).map(pts => simplify(pts))) {
        if (poly.length < 3) continue;
        doc.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k++) doc.lineTo(poly[k][0], poly[k][1]);
        doc.close();
        doc.fill(); // Nonzero wie im Canvas, damit sich überlappende Strichteile nicht ausstanzen
      }
    }
  });
  return doc.output('blob');
}

// Eine Seite als PNG (300 dpi). Ohne Linien mit transparentem Hintergrund zum Einfügen auf eine GoodNotes-Seite.
export function buildPng(page, o, color, withPaper) {
  const pxPerMm = PNG_DPI / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(o.pageW * pxPerMm);
  canvas.height = Math.round(o.pageH * pxPerMm);
  const ctx = canvas.getContext('2d');
  if (withPaper) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);
  if (withPaper) drawPaper(ctx, o);
  drawPage(ctx, page, color, o.penSize);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    canvas.width = canvas.height = 0; // Speicher auf dem iPad sofort freigeben
    blob ? resolve(blob) : reject(new Error('PNG konnte nicht erzeugt werden.'));
  }, 'image/png'));
}

// Über das Teilen-Menü weitergeben; ohne Teilen-Funktion (z. B. am PC) herunterladen.
// Gibt false zurück, wenn Safari einen erneuten Tipp verlangt (Erzeugen hat zu lange gedauert).
export async function shareFiles(files) {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return true; // Nutzer hat das Menü geschlossen
      if (err.name === 'NotAllowedError') return false;
      throw err;
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return true;
}

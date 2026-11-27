// Modul 3: Export als PDF (Vektor) und PNG, Weitergabe über das Teilen-Menü (z. B. an GoodNotes).
import { outline, PEN_SIZE, MARKER } from './ink.js';
import { drawPage, drawPaper, MISSING_COLOR } from './render.js';
import { paperShapes } from './paper.js';

const PNG_DPI = 300;

// Umrisse eines Glyph-Items in Seitenkoordinaten (mm): Drehung und Skalierung schon angewendet.
export function itemPolygons(it, size = PEN_SIZE, pen) {
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  return it.strokes.map(st => outline(st, size * (it.ink || 1), pen).map(([px, py]) => [
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

// Seitengröße in mm: eigene Größe (Arbeitsblatt) oder die des Layouts.
export const pageSize = (page, o) => page.size || [o.pageW, o.pageH];

// page.background: JPEG (Uint8Array oder Data-URL) als Seitenhintergrund, z. B. ein Arbeitsblatt.
export function buildPdf(result, o, color, withPaper) {
  const { jsPDF } = window.jspdf;
  const [w0, h0] = pageSize(result.pages[0] || {}, o);
  const doc = new jsPDF({ unit: 'mm', format: [w0, h0], orientation: w0 > h0 ? 'l' : 'p', compress: true });
  doc.setProperties({ title: 'Handschrift', creator: 'Handschrift-Tool' });
  result.pages.forEach((page, i) => {
    const [w, h] = pageSize(page, o);
    if (i) doc.addPage([w, h], w > h ? 'l' : 'p');
    if (page.background) doc.addImage(page.background, 'JPEG', 0, 0, w, h, undefined, 'FAST');
    else if (withPaper) {
      // GoodNotes-Papier als Vektor: Farbe, Linien/Karos als 0,5-pt-Balken, Punkte
      const p = paperShapes(o.paper, o.paperColor, w, h);
      if (p.fill.toLowerCase() !== '#ffffff') { doc.setFillColor(p.fill); doc.rect(0, 0, w, h, 'F'); }
      doc.setFillColor(p.color);
      for (const [x, y, rw, rh] of p.rects) doc.rect(x, y, rw, rh, 'F');
      for (const [x, y, r] of p.dots) doc.circle(x, y, r, 'F');
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
      // Textmarker durchsichtig (liegt im Layout schon unter der Schrift)
      if (it.marker) { doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: MARKER.alpha })); }
      doc.setFillColor(it.marker ? MARKER.color : color);
      const polys = it.marker ? itemPolygons({ ...it, ink: 1 }, MARKER.size, MARKER.pen) : itemPolygons(it, o.penSize, o.pen);
      for (const poly of polys.map(pts => simplify(pts))) {
        if (poly.length < 3) continue;
        doc.moveTo(poly[0][0], poly[0][1]);
        for (let k = 1; k < poly.length; k++) doc.lineTo(poly[k][0], poly[k][1]);
        doc.close();
        doc.fill(); // Nonzero wie im Canvas, damit sich überlappende Strichteile nicht ausstanzen
      }
      if (it.marker) doc.restoreGraphicsState();
    }
  });
  return doc.output('blob');
}

// Eine Seite als PNG (300 dpi). Ohne Linien mit transparentem Hintergrund zum Einfügen auf eine GoodNotes-Seite.
// page.backgroundImage: Bild/Canvas des Arbeitsblatts, wird über die ganze Seite gezogen.
export function buildPng(page, o, color, withPaper) {
  const pxPerMm = PNG_DPI / 25.4;
  const [w, h] = pageSize(page, o);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * pxPerMm);
  canvas.height = Math.round(h * pxPerMm);
  const ctx = canvas.getContext('2d');
  if (page.backgroundImage) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (page.backgroundImage) ctx.drawImage(page.backgroundImage, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, 0, 0);
  if (withPaper && !page.backgroundImage) drawPaper(ctx, { ...o, pageW: w, pageH: h });
  drawPage(ctx, page, color, o.penSize, o.pen);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    canvas.width = canvas.height = 0; // Speicher auf dem iPad sofort freigeben
    blob ? resolve(blob) : reject(new Error('PNG konnte nicht erzeugt werden.'));
  }, 'image/png'));
}

// Über das Teilen-Menü weitergeben; ohne Teilen-Funktion (z. B. am PC) herunterladen.
// Gibt false zurück, wenn Safari einen erneuten Tipp verlangt (Erzeugen hat zu lange gedauert).
export async function shareFiles(files) {
  // In der iPad-App (Handschrift mit Claude): Dateien an das native Teilen-Menü geben
  const native = window.webkit?.messageHandlers?.schriftbot;
  if (native && window.schriftbotNative) {
    const toBase64 = async file => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    native.postMessage({ action: 'share', files: await Promise.all(files.map(async f => ({ name: f.name, data: await toBase64(f) }))) });
    return true;
  }
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

// Arbeitsblatt einlesen: PDF (über pdf.js, erst bei Bedarf geladen) oder Foto/Bild.
// Jede Seite wird mit 200 dpi gerastert; aus dem PDF kommt zusätzlich der Text mit Position.
export const DPI = 200;
const MAX_PAGES = 20;
const MAX_IMAGE_W = Math.round(210 / 25.4 * DPI); // Fotos auf A4-Breite bei 200 dpi verkleinern

let lib;
async function pdfjs() {
  if (!lib) {
    lib = await import('../vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return lib;
}

export const isPdf = file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

// onPage({ canvas, w, h (mm), dpmm, items, index, count }) wird je Seite aufgerufen.
export async function importFile(file, onPage) {
  if (isPdf(file)) return importPdf(file, onPage);
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_W / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height); // transparente PNGs
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const dpmm = canvas.width / 210; // Bild gilt als A4-breit
  await onPage({ canvas, w: 210, h: canvas.height / dpmm, dpmm, items: [], index: 0, count: 1 });
  return 1;
}

async function importPdf(file, onPage) {
  const { getDocument, Util } = await pdfjs();
  const doc = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
  }).promise;
  const count = Math.min(doc.numPages, MAX_PAGES);
  try {
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: DPI / 72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const text = await page.getTextContent();
      const items = text.items.filter(it => it.str).map(it => {
        const t = Util.transform(vp.transform, it.transform);
        return { str: it.str, x: t[4], y: t[5], w: it.width * vp.scale, h: Math.hypot(t[2], t[3]) };
      });
      const dpmm = DPI / 25.4;
      await onPage({ canvas, w: canvas.width / dpmm, h: canvas.height / dpmm, dpmm, items, index: n - 1, count });
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return doc.numPages;
}

// Inhalt eines PDFs für den KI-Tab: Text aller Seiten (bis 40). Hat es keinen Text (Scan),
// werden die ersten Seiten als JPEG-Fotos zurückgegeben (höchstens maxImages).
export async function pdfContent(file, maxImages = 0) {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    isEvalSupported: false,
  }).promise;
  try {
    const pages = Math.min(doc.numPages, 40), texts = [];
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      texts.push(tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('').replace(/[ \t]+\n/g, '\n').trim());
      page.cleanup();
    }
    const text = texts.filter(Boolean).map((t, i) => (pages > 1 ? `[Seite ${i + 1}]\n` : '') + t).join('\n\n');
    if (text.replace(/\s/g, '').length > 20 || !maxImages) return { text, pages: doc.numPages, images: [] };
    const images = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxImages); n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      images.push(await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85)));
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
    return { text: '', pages: doc.numPages, images };
  } finally {
    doc.destroy();
  }
}

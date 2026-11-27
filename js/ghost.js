// Blasse Vorlage im Aufnahme-Kästchen, passend zu den Hilfslinien.
// Schriften haben andere Proportionen als die Lineatur (x-Höhe 1, Oberlänge 2, Unterlänge 1).
// Deshalb wird jedes Zeichen in drei Zonen zerlegt und jede Zone einzeln auf ihre Hilfslinie gestreckt:
// Mittelband (Grundlinie bis x-Höhe), Oberlänge (nur b d f h k l), Unterlänge (nur g j p q y).
// Großbuchstaben, Ziffern und Satzzeichen werden gleichmäßig auf Großbuchstabenhöhe skaliert.

const FONT = '-apple-system, "Helvetica Neue", Arial, sans-serif';
const F = 300;          // Rendergröße der Vorlage in px (scharf genug für große Kästchen)
const CAP = 1.8;        // Großbuchstabenhöhe in x-Höhen (knapp unter der Oberlänge)
const ALPHA = 0.15;
const UP = 'bdfhkl', DOWN = 'gjpqy';

let metrics;
const cache = new Map();

function measure() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${F}px ${FONT}`;
  const m = t => ctx.measureText(t);
  return { xh: m('x').actualBoundingBoxAscent, asc: m('l').actualBoundingBoxAscent,
    desc: m('p').actualBoundingBoxDescent, cap: m('H').actualBoundingBoxAscent };
}

// Ein Zeichen vorrendern und die Maßstäbe der drei Zonen bestimmen (Einheit: x-Höhen je px).
function prepare(ch) {
  metrics ||= measure();
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${F}px ${FONT}`;
  const m = ctx.measureText(ch);
  const pad = 4;
  const c = ctx.canvas;
  c.width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 2 * pad;
  c.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 2 * pad;
  const base = Math.ceil(m.actualBoundingBoxAscent) + pad;
  ctx.font = `${F}px ${FONT}`;
  ctx.fillStyle = '#1d1d1f';
  ctx.fillText(ch, m.actualBoundingBoxLeft + pad, base);

  // ß hat kein Mittelband: gleichmäßig bis zur Oberlänge skalieren, sonst verzerrt der Bogen.
  if (ch === 'ß') {
    const k = 2 / m.actualBoundingBoxAscent;
    return { c, base, k, kTop: k, kBot: k, split: 0, left: m.actualBoundingBoxLeft + pad, adv: m.width };
  }
  const lower = /[a-zäöü]/.test(ch);
  const k = lower ? 1 / metrics.xh : CAP / metrics.cap;
  return {
    c, base, k,
    kTop: lower && UP.includes(ch) ? 1 / (metrics.asc - metrics.xh) : k,
    kBot: lower && DOWN.includes(ch) ? 1 / metrics.desc : k,
    split: lower ? metrics.xh : 0, // Höhe des Mittelbands über der Grundlinie in px
    left: m.actualBoundingBoxLeft + pad,
    adv: m.width,
  };
}

const partsOf = text => [...text].map(ch => cache.get(ch) || cache.set(ch, prepare(ch)).get(ch));

// Breite der Vorlage in x-Höhen.
export const ghostWidth = text => partsOf(text).reduce((n, p) => n + p.adv * p.k, 0);

// ctx ist in x-Höhen skaliert, Ursprung (0, 0) liegt am linken Rand auf der Grundlinie.
export function drawGhost(ctx, text, boxW, alpha = ALPHA) {
  if (!text.trim()) return;
  const parts = partsOf(text);
  const total = ghostWidth(text);
  let x = (boxW - total) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingQuality = 'high';
  for (const p of parts) {
    const { c, base, k } = p;
    const dx = x - p.left * k, dw = c.width * k;
    const mid = Math.min(p.split, base);       // Mittelband (px über der Grundlinie)
    const top = base - mid;                     // alles darüber
    const bot = c.height - base;                // alles unter der Grundlinie
    if (top > 0) ctx.drawImage(c, 0, 0, c.width, top, dx, -mid * k - top * p.kTop, dw, top * p.kTop);
    if (mid > 0) ctx.drawImage(c, 0, top, c.width, mid, dx, -mid * k, dw, mid * k);
    if (bot > 0) ctx.drawImage(c, 0, base, c.width, bot, dx, 0, dw, bot * p.kBot);
    x += p.adv * k;
  }
  ctx.restore();
}

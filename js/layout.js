// Text → platzierte Glyphen auf A4-Seiten (ohne DOM, in Node testbar).
// Alle Maße in mm; y ist die Grundlinie der Zeile. Ein Glyph-Item wird mit s (mm je x-Höhe) skaliert
// und um rot (Bogenmaß) um seinen Ursprung auf der Grundlinie gedreht.
import { PEN_SIZE } from './ink.js';
import { recordedCount, groupsFor } from './profile.js';

export const DEFAULTS = {
  pageW: 210, pageH: 297,
  margin: 20,       // Rand in mm
  xHeight: 3,       // Schriftgröße: x-Höhe in mm
  lineHeight: 8.5,  // Zeilenabstand in mm
  spacing: 0.15,    // Abstand zwischen Buchstaben in x-Höhen
  connect: 0,       // Verbindungen 0..1: Anteil der Stellen, an denen ein Paar genutzt wird
  chaos: 0,         // Unordnung 0..1
  ruled: false,     // true: Grundlinien rasten auf Papierlinien ein
  lineSpacing: 8.8, // Abstand der Papierlinien in mm
  lineTop: 20,      // Lage der ersten Papierlinie in mm von oben
};

// Erste Grundlinie und Zeilenschritt. Auf liniertem/kariertem Papier sitzt jede Zeile auf einer Linie,
// der Zeilenabstand wird dafür auf ein Vielfaches des Linienabstands gerundet.
export function lineMetrics(options) {
  const o = { ...DEFAULTS, ...options };
  const minFirst = o.margin + 2 * o.xHeight; // Platz für Oberlängen unter dem Rand
  if (!o.ruled) return { first: minFirst, step: o.lineHeight, lines: 0 };
  const lines = Math.max(1, Math.round(o.lineHeight / o.lineSpacing));
  const k = Math.max(0, Math.ceil((minFirst - o.lineTop) / o.lineSpacing - 1e-9));
  return { first: o.lineTop + k * o.lineSpacing, step: lines * o.lineSpacing, lines };
}

// Stärke der Unordnung bei 100 %.
const CHAOS = {
  rotate: 3 * Math.PI / 180, // Drehung je Zeichen ±3°
  size: 0.05,                // Größe ±5 %
  shift: 0.06,               // vertikaler Versatz ±0,06 x-Höhen
  gap: 0.12,                 // Buchstabenabstand ±0,12 x-Höhen (≈ ±1–2 px auf dem Bildschirm)
  slant: 0.3 * Math.PI / 180 // Schräglage je Zeile ±0,3° (mehr würde auf liniertem Papier von der Linie laufen)
};

// Ersatzzeichen, falls ein Zeichen nicht aufgenommen ist (z. B. typografische Zeichen der iPad-Tastatur).
const ALIASES = {
  '’': ["'", '‘'], '‘': ["'"], '‚': [','], '”': ['“', '"'], '“': ['"'], '„': ['"'],
  '–': ['-'], '—': ['–', '-'], '…': ['...'], '\t': [' '], ' ': [' '],
};

const MISSING_W = 1; // Breite einer Fehlmarkierung in x-Höhen
const SPACE_W = 1;   // Wortabstand, falls kein Leerzeichen aufgenommen wurde

// Kleiner Zufallsgenerator mit Startwert, damit die Vorschau beim Tippen nicht springt.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bounds(strokes) {
  let minX = Infinity, maxX = -Infinity;
  for (const s of strokes) for (const p of s) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
  return { minX, maxX };
}

export function layout(text, profile, options = {}, seed = 1) {
  const o = { ...DEFAULTS, ...options };
  // Getrennte Zufallsquellen: Regler verschieben so nicht die Variantenwahl.
  const random = rng(seed), pairRandom = rng(seed + 1), jitterRandom = rng(seed + 2);
  const jitter = amount => (jitterRandom() * 2 - 1) * amount * o.chaos;
  const unit = o.xHeight;
  const left = o.margin, right = o.pageW - o.margin, bottom = o.pageH - o.margin;
  const has = key => recordedCount(profile, key) > 0;
  // Aufgenommene Paare, längste zuerst (aus „sch“ wird nicht „s“ + „ch“).
  const pairs = groupsFor(profile).find(g => g.pairs).chars
    .filter(has).map(p => [...p]).sort((a, b) => b.length - a.length);
  const lastVariant = {};
  const missing = new Set();
  const pages = [];
  let page, x, baseline, lineAngle;

  // Zufällige Variante, nie dieselbe wie beim letzten Auftreten dieses Zeichens.
  function pick(key) {
    const options = profile.glyphs[key].map((v, i) => i).filter(i => profile.glyphs[key][i].length);
    const choices = options.length > 1 ? options.filter(i => i !== lastVariant[key]) : options;
    const i = choices[Math.floor(random() * choices.length)];
    lastVariant[key] = i;
    return profile.glyphs[key][i];
  }

  // Zeichen → Liste aufgenommener Schlüssel, oder null wenn nichts passt.
  function resolve(ch) {
    for (const cand of [ch, ...(ALIASES[ch] || [])]) {
      if ([...cand].every(has)) return [...cand];
    }
    return null;
  }

  function glyph(key) {
    const strokes = pick(key);
    const b = bounds(strokes);
    const pad = PEN_SIZE / 2;
    const sc = 1 + jitter(CHAOS.size);
    return {
      strokes, sc,
      dx: (pad - b.minX) * unit * sc,
      w: (b.maxX - b.minX + 2 * pad) * unit * sc,
      gap: (o.spacing + jitter(CHAOS.gap)) * unit,
      dy: jitter(CHAOS.shift) * unit,
      rot: jitter(CHAOS.rotate),
    };
  }

  function word(text) {
    const chars = [...text], glyphs = [];
    for (let i = 0; i < chars.length;) {
      if (pairRandom() < o.connect) {
        const pair = pairs.find(p => p.every((c, k) => chars[i + k] === c));
        if (pair) {
          glyphs.push(glyph(pair.join('')));
          i += pair.length;
          continue;
        }
      }
      const keys = resolve(chars[i]);
      if (keys) glyphs.push(...keys.map(glyph));
      else {
        missing.add(chars[i]);
        glyphs.push({ missing: chars[i], w: MISSING_W * unit, gap: o.spacing * unit });
      }
      i++;
    }
    return glyphs;
  }

  function spaceWidth() {
    if (!has(' ')) return SPACE_W * unit;
    const b = bounds(pick(' '));
    return (b.maxX - b.minX) * unit;
  }

  const lm = lineMetrics(o);
  const startLine = () => { x = left; lineAngle = jitter(CHAOS.slant); };
  const newPage = () => {
    page = { items: [] };
    pages.push(page);
    baseline = lm.first;
    startLine();
  };
  const newLine = () => {
    baseline += lm.step;
    startLine();
    if (baseline > bottom) newPage();
  };

  newPage();
  text.split('\n').forEach((para, pi) => {
    if (pi > 0) newLine();
    para.split(' ').forEach((w, wi) => {
      const sp = wi > 0 && x > left ? spaceWidth() : 0;
      if (!w) { x += sp; return; }
      const glyphs = word(w);
      const width = glyphs.reduce((n, g, i) => n + g.w + (i ? g.gap : 0), 0);
      if (x > left && x + sp + width > right) newLine();
      else x += sp;
      glyphs.forEach((g, i) => {
        if (i) x += g.gap;
        if (x > left && x + g.w > right) newLine(); // Wort länger als eine Zeile
        const y = baseline + (x - left) * Math.tan(lineAngle);
        page.items.push(g.missing
          ? { missing: g.missing, x, y, w: g.w, s: unit, rot: lineAngle }
          : { strokes: g.strokes, x: x + g.dx, y: y + g.dy, s: unit * g.sc, rot: g.rot + lineAngle });
        x += g.w;
      });
    });
  });

  return { pages, missing: [...missing], spaceMissing: !has(' ') };
}

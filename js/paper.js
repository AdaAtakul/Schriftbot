// GoodNotes-Papiervorlagen, nachgebaut nach den Messungen von goodnotes-codec
// (github.com/Taylor-Nilsen/goodnotes-codec, goodnotes/paper.py und docs/FORMAT.md, MIT).
// GoodNotes legt die Vorlagen in festen Abständen ab der linken oberen Ecke an (nicht skaliert):
// Maße in PDF-Punkten, jede Linie ist ein 0,5 pt hoher Balken.
export const PT = 25.4 / 72; // mm je Punkt

const LINE = 0.5;     // Linienstärke (pt)
const BOTTOM = 13.2;  // Linierte Vorlagen enden mindestens so weit über dem unteren Rand (pt)
const DOT_R = 0.5;    // Punktradius (pt)

export const PAPER_KINDS = {
  'blanko':         { label: 'Blanko' },
  'liniert-breit':  { label: 'Liniert breit', ruled: { first: 49.5, step: 25 } },   // 8,82 mm
  'liniert-schmal': { label: 'Liniert schmal', ruled: { first: 50, step: 17.5 } },  // 6,17 mm
  'kariert':        { label: 'Kariert', grid: 16 },                                 // 5,64 mm
  'gepunktet':      { label: 'Gepunktet', dots: 16 },                               // 5,64 mm
};

const hex = (...c) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const LIGHT_INK = hex(0.8156863, 0.8235294, 0.827451);   // #d0d2d3
const DARK_INK = hex(0.34509805, 0.34901962, 0.35686275); // #58595b
export const PAPER_COLORS = {
  weiss:  { label: 'Weiß', paper: '#ffffff', line: LIGHT_INK },
  gelb:   { label: 'Gelb', paper: hex(0.972549, 0.96862745, 0.9137255), line: LIGHT_INK }, // #f8f7e9
  dunkel: { label: 'Dunkel', paper: hex(0.2, 0.2, 0.2), line: DARK_INK, dark: true },      // #333333
};

// Wo die Schrift steht: erste Grundlinie und Abstand in mm (Mitte der Linie bzw. Punktreihe).
// ruled: false bei Blanko (dann bestimmen Rand und Zeilenabstand die Lage).
export function paperLines(kind) {
  const k = PAPER_KINDS[kind] || PAPER_KINDS.blanko;
  if (k.ruled) return { ruled: true, lineTop: (k.ruled.first + LINE / 2) * PT, lineSpacing: k.ruled.step * PT };
  if (k.grid) return { ruled: true, lineTop: (k.grid - LINE / 2) * PT, lineSpacing: k.grid * PT };
  if (k.dots) return { ruled: true, lineTop: k.dots * PT, lineSpacing: k.dots * PT };
  return { ruled: false };
}

// Alles, was auf das Papier gezeichnet wird, in mm: { fill, color, rects: [[x, y, w, h]], dots: [[x, y, r]] }.
export function paperShapes(kind, color, w, h) {
  const k = PAPER_KINDS[kind] || PAPER_KINDS.blanko, c = PAPER_COLORS[color] || PAPER_COLORS.weiss;
  const W = w / PT, H = h / PT, rects = [], dots = [];
  if (k.ruled) {
    for (let top = k.ruled.first; top + LINE <= H - BOTTOM; top += k.ruled.step) rects.push([0, top, W, LINE]);
  }
  if (k.grid) {
    for (let j = 1; k.grid * j - LINE < H; j++) rects.push([0, k.grid * j - LINE, W, LINE]);
    for (let i = 1; k.grid * i - LINE < W; i++) rects.push([k.grid * i - LINE, 0, LINE, H]);
  }
  if (k.dots) {
    for (let j = 1; k.dots * j < H; j++) for (let i = 1; k.dots * i < W; i++) dots.push([k.dots * i, k.dots * j, DOT_R]);
  }
  const mm = a => a.map(v => v * PT);
  return { fill: c.paper, color: c.line, dark: !!c.dark, rects: rects.map(mm), dots: dots.map(mm) };
}

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
  edges: 0,         // Ränder 0..1: Zeilenanfänge und -enden wandern links und rechts
  lineShift: 0,     // Zeilen versetzen 0..1: jede Zeile als Ganzes etwas nach links oder rechts (bis LINE_SHIFT mm)
  fatigue: 0,       // Müdigkeit 0..1: zum Textende hin größer, schräger, weiter und unordentlicher
  fix: 0,           // Korrekturen 0..1: nachgezogene Buchstaben, vergessene Wörter mit ^ eingefügt
  // strike 0..1: Durchstreichen – wie oft ein Wort erst falsch geschrieben und durchgestrichen wird
  // wobble 0..1: Zeilen & Druck – schwankende Zeilen, Druck je Wort, nachlassend zum Zeilenende
  // (alt: mistakes 0..1 setzt beide zugleich; ohne Angabe 0)
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
// Unter 100 % wächst die Wirkung langsamer (Ordentlich bei 30 % bleibt ruhig), darüber gleichmäßig.
const CHAOS = {
  rotate: 6 * Math.PI / 180,     // Drehung je Zeichen ±6° (um die Buchstabenmitte)
  size: 0.08,                    // Größe ±8 %
  shift: 0.15,                   // Höhenversatz je Zeichen ±0,15 x-Höhen
  gap: 0.15,                     // Buchstabenabstand ±0,15 x-Höhen
  wordShift: 0.1,                // ganzes Wort höher/tiefer ±0,1 x-Höhen
  wordTilt: 1.5 * Math.PI / 180, // ganzes Wort leicht schräg ±1,5°
  slant: 0.3 * Math.PI / 180     // Schräglage je Zeile ±0,3° (mehr würde auf liniertem Papier von der Linie laufen)
};
export const chaosCurve = c => (c <= 1 ? c ** 1.5 : c);

// Durchstreichen, Zeilen & Druck bei 100 %.
const MISTAKES = {
  rate: 0.15,  // Anteil der geeigneten Wörter, die erst falsch geschrieben werden
  gap: [10, 3], // mindestens so viele Wörter zwischen zwei Verschreibern (bei wenig … bei 100 %)
  minLen: 4,   // nur Wörter ab 4 Buchstaben
  wave: 0.1,   // Zeile schwankt um bis zu ±0,1 x-Höhen (bleibt auf liniertem Papier auf der Linie)
  flow: 0.18,  // Druck je Wort ±18 %
  fade: 0.12,  // bis zu 12 % dünner am Zeilenende
};
const LETTERS = [...'abcdefghijklmnopqrstuvwxyzäöüß'];
// Müdigkeit bei 100 %, am Textende erreicht (wächst gleichmäßig vom Anfang an).
const FATIGUE = {
  size: 0.12,                // 12 % größer
  lean: 5 * Math.PI / 180,   // 5° nach rechts gelehnt
  gap: 0.15,                 // Buchstaben 0,15 x-Höhen weiter auseinander
  chaos: 0.7,                // Unordnung +70 Prozentpunkte
};
// Korrekturen bei 100 %.
const FIX = {
  retrace: 0.03, // Anteil nachgezogener Buchstaben
  forget: 0.05,  // Anteil geeigneter Wörter, die erst vergessen und dann mit ^ eingefügt werden
  gap: 12,       // mindestens so viele Wörter zwischen zwei vergessenen
  scale: 0.72,   // eingefügtes Wort ist kleiner
  lift: 2.1,     // und steht so viele x-Höhen über der Zeile
};

// Einfügezeichen ^ in x-Höhen um die Einfügestelle auf der Grundlinie.
export function caretStrokes(r, pressure = 0.5) {
  const w = 0.25 + r() * 0.1, h = 0.75 + r() * 0.15, tilt = (r() - 0.5) * 0.1;
  const pts = [[-w, 0.3], [tilt, 0.3 - h], [w, 0.3]];
  const out = [];
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, [ax, ay] = pts[k], [bx, by] = pts[k + 1];
      if (k && !i) continue;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t, pressure, out.length * 8]);
    }
  }
  return [out];
}

// Ränder bei 100 % (in x-Höhen): Zeilenanfang rückt bis zu so weit ein, Zeile bricht bis zu so viel früher um.
const EDGES = { left: 1.2, right: 4 };
const LINE_SHIFT = 8; // mm bei 100 %: so weit wandert eine Zeile höchstens nach links oder rechts
const PAGE_EDGE = 4;  // mm: näher an die Blattkante rückt keine Zeile

// Ersatzzeichen, falls ein Zeichen nicht aufgenommen ist (z. B. typografische Zeichen der iPad-Tastatur).
const ALIASES = {
  '’': ["'", '‘'], '‘': ["'"], '‚': [','], '”': ['“', '"'], '“': ['"'], '„': ['"'],
  '–': ['-'], '—': ['–', '-'], '…': ['...'], '\t': [' '], ' ': [' '],
  'ß': ['ss'], // fehlt das ß (z. B. in mitgelieferten Schriften), dann „ss“
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

// Verschreiber für ein Wort: Buchstabendreher („Hasue“) oder abgebrochener Anfang mit falschem
// Buchstaben („Hauf“ statt „Haus“). letters: Buchstaben, die als Ersatz in Frage kommen. null, wenn nichts passt.
export function misspell(core, letters, r) {
  const chars = [...core];
  if (chars.length < 3) return null;
  const swaps = chars.map((_, i) => i).filter(i => i >= 1 && i < chars.length - 1 && chars[i] !== chars[i + 1]);
  const swap = () => {
    const i = swaps[Math.floor(r() * swaps.length)];
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    return chars.join('');
  };
  if (swaps.length && r() < 0.5) return swap();
  const k = 1 + Math.floor(r() * (chars.length - 2)); // 1 bis n−2 richtige Buchstaben, dann ein falscher
  const wrong = letters.filter(c => c !== chars[k].toLowerCase());
  if (!wrong.length) return swaps.length ? swap() : null;
  return chars.slice(0, k).join('') + wrong[Math.floor(r() * wrong.length)];
}

// Durchstreichen: Striche in x-Höhen ab dem Wortanfang auf der Grundlinie. len: Wortlänge, max: bis zum Rand.
// Meist ein Strich, manchmal zwei (der zweite zurück) oder ein Gekritzel in einem Zug.
export function strikeStrokes(len, max, r, pressure = 0.5) {
  const t0 = { ms: 0 };
  const line = (from, y0, to, y1) => {
    const n = Math.max(2, Math.ceil(Math.abs(to - from) / 0.2));
    const amp = 0.02 + r() * 0.03, ph = r() * 2 * Math.PI;
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, taper = Math.min(1, t * 6, (1 - t) * 6); // Anfang und Ende dünner
      return [from + (to - from) * t, y0 + (y1 - y0) * t + amp * Math.sin(ph + t * 7), pressure * (0.55 + 0.45 * taper), t0.ms += 6];
    });
  };
  const over = () => 0.1 + r() * 0.2;                       // Überstand links und rechts
  const L = () => -over(), R = () => Math.min(len + over(), max);
  const style = r(), y = -0.45 + (r() * 2 - 1) * 0.1, tilt = (r() * 2 - 1) * 0.1;
  if (style < 0.6) return [line(L(), y + tilt, R(), y - tilt)];
  if (style < 0.9) return [line(L(), y - 0.12 + tilt, R(), y - 0.12 - tilt), line(R(), y + 0.12 - tilt, L(), y + 0.12 + tilt)];
  const a = L(), b = R();
  return [[...line(a, -0.25, b, -0.3), ...line(b, -0.35, a, -0.55).slice(1), ...line(a, -0.6, b, -0.75).slice(1)]];
}

// Typischer Druck der eigenen Schrift, damit der Streichstrich so kräftig wirkt wie die Buchstaben.
const pressures = new WeakMap();
function typicalPressure(glyphs) {
  if (pressures.has(glyphs)) return pressures.get(glyphs);
  const all = [];
  for (const variants of Object.values(glyphs)) for (const v of variants) for (const s of v) for (const p of s) {
    if (Number.isFinite(p[2])) all.push(p[2]);
  }
  all.sort((a, b) => a - b);
  const med = all.length ? all[all.length >> 1] : 0.5;
  pressures.set(glyphs, med);
  return med;
}

export function bounds(strokes) {
  let minX = Infinity, maxX = -Infinity;
  for (const s of strokes) for (const p of s) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
  return { minX, maxX };
}

// Optischer Abstand: Für jedes Höhenband merken, wo die Tinte links und rechts endet.
// So rückt z. B. ein o unter das Dach eines T, und schräge Schrift wird nicht zu breit.
const BAND = 0.25, B0 = -3, NB = 20; // Bänder von 3 x-Höhen über bis 2 unter der Grundlinie
const KERN = 0.8;                    // Anteil der Lücke, der geschlossen wird
const MAX_KERN = 0.6;                // höchstens so viel näher (x-Höhen)
const profiles = new WeakMap();      // je Variante nur einmal berechnen

function profileOf(strokes) {
  if (profiles.has(strokes)) return profiles.get(strokes);
  const lo = Array(NB).fill(Infinity), hi = Array(NB).fill(-Infinity);
  const add = (x, y) => {
    const b = Math.floor((y - B0) / BAND);
    if (b < 0 || b >= NB) return;
    if (x < lo[b]) lo[b] = x;
    if (x > hi[b]) hi[b] = x;
  };
  for (const s of strokes) {
    s.forEach(([x, y], i) => {
      if (i) { // Zwischenpunkte, damit schnelle Striche kein Band überspringen
        const [px, py] = s[i - 1];
        const n = Math.ceil(Math.hypot(x - px, y - py) / 0.1);
        for (let k = 1; k < n; k++) add(px + (x - px) * k / n, py + (y - py) * k / n);
      }
      add(x, y);
    });
  }
  const prof = { lo, hi };
  profiles.set(strokes, prof);
  return prof;
}

// Wie viel näher (in x-Höhen) darf R an L rücken? Kleinste Lücke über alle Bänder (±1 Band Toleranz).
function kerning(L, R) {
  const a = profileOf(L.strokes), b = profileOf(R.strokes);
  let free = Infinity;
  for (let i = 0; i < NB; i++) {
    if (a.hi[i] === -Infinity) continue;
    for (let j = Math.max(0, i - 1); j <= Math.min(NB - 1, i + 1); j++) {
      if (b.lo[j] === Infinity) continue;
      free = Math.min(free, (L.maxX - a.hi[i]) * L.sc + (b.lo[j] - R.minX) * R.sc);
    }
  }
  return free === Infinity ? 0 : Math.min(free * KERN, MAX_KERN); // keine gemeinsame Höhe (z. B. ' und s) → normaler Abstand
}

export function layout(text, profile, options = {}, seed = 1) {
  const o = { ...DEFAULTS, ...options };
  // Getrennte Zufallsquellen: Regler verschieben so nicht die Variantenwahl.
  const random = rng(seed), pairRandom = rng(seed + 1), jitterRandom = rng(seed + 2);
  const lineRandom = rng(seed + 3);
  // Glockenförmig (Summe zweier Zufallszahlen): meist kleine, selten große Abweichungen wie bei echter Schrift.
  const jitter = (amount, r = jitterRandom) => (r() + r() - 1) * amount * chaosCurve(o.chaos + tired * FATIGUE.chaos);
  const strike = o.strike ?? o.mistakes ?? 0, wobble = o.wobble ?? o.mistakes ?? 0, edges = o.edges || 0;
  const slipGap = Math.round(MISTAKES.gap[0] + (MISTAKES.gap[1] - MISTAKES.gap[0]) * strike);
  const edgeRandom = rng(seed + 5), shiftRandom = rng(seed + 7);
  const fatigue = o.fatigue || 0, fix = o.fix || 0;
  const totalChars = Math.max(1, text.replace(/\s/g, '').length);
  let tired = 0, done = 0; // Müdigkeit an der aktuellen Stelle: 0 am Anfang, fatigue am Ende
  const unit = o.xHeight;
  const left = o.margin, right = o.pageW - o.margin, bottom = o.pageH - o.margin;
  const has = key => recordedCount(profile, key) > 0;
  // Aufgenommene Paare, längste zuerst (aus „sch“ wird nicht „s“ + „ch“).
  const pairs = groupsFor(profile).find(g => g.pairs).chars
    .filter(has).map(p => [...p]).sort((a, b) => b.length - a.length);
  const lastVariant = {};
  const missing = new Set();
  const pages = [];
  const letters = LETTERS.filter(has);
  let page, x, baseline, lineAngle, wave, lineStart, lineRight, indent = 0;

  // Zufällige Variante, nie dieselbe wie beim letzten Auftreten dieses Zeichens.
  // r: eigene Zufallsquelle (für Verschreiber), sonst die gemeinsame.
  function pick(key, r = random) {
    const options = profile.glyphs[key].map((v, i) => i).filter(i => profile.glyphs[key][i].length);
    const choices = options.length > 1 ? options.filter(i => i !== lastVariant[key]) : options;
    const i = choices[Math.floor(r() * choices.length)];
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

  function glyph(key, r) {
    const strokes = pick(key, r);
    const b = bounds(strokes);
    const pad = PEN_SIZE / 2;
    const sc = (1 + jitter(CHAOS.size, r)) * (1 + FATIGUE.size * tired);
    const gap = (o.spacing + jitter(CHAOS.gap, r) + FATIGUE.gap * tired) * unit, shift = jitter(CHAOS.shift, r);
    const rot = jitter(CHAOS.rotate, r) + FATIGUE.lean * tired;
    // Um die Buchstabenmitte drehen statt um den linken Fußpunkt, sonst hebt die rechte Seite von der Linie ab.
    const cx = (b.minX + b.maxX) / 2, cy = -0.5, cos = Math.cos(rot), sin = Math.sin(rot);
    return {
      strokes, sc, minX: b.minX, maxX: b.maxX, gap, rot,
      dx: (pad - b.minX + cx - (cx * cos - cy * sin)) * unit * sc,
      w: (b.maxX - b.minX + 2 * pad) * unit * sc,
      dy: (shift + (cy - (cx * sin + cy * cos)) * sc) * unit,
    };
  }

  function word(text, r) {
    const chars = [...text], glyphs = [];
    for (let i = 0; i < chars.length;) {
      if ((r || pairRandom)() < o.connect) {
        const pair = pairs.find(p => p.every((c, k) => chars[i + k] === c));
        if (pair) {
          glyphs.push(glyph(pair.join(''), r));
          i += pair.length;
          continue;
        }
      }
      const keys = resolve(chars[i]);
      if (keys) glyphs.push(...keys.map(k => glyph(k, r)));
      else {
        missing.add(chars[i]);
        glyphs.push({ missing: chars[i], w: MISSING_W * unit, gap: o.spacing * unit });
      }
      i++;
    }
    // Abstand zum Vorgänger um die optische Lücke verkleinern
    for (let k = 1; k < glyphs.length; k++) {
      if (!glyphs[k].missing && !glyphs[k - 1].missing) glyphs[k].gap -= kerning(glyphs[k - 1], glyphs[k]) * unit;
    }
    return glyphs;
  }

  function spaceWidth(r) {
    if (!has(' ')) return SPACE_W * unit;
    const b = bounds(pick(' ', r));
    return (b.maxX - b.minX) * unit;
  }

  const lm = lineMetrics(o);
  const startLine = () => {
    // Ränder: Einzug wandert langsam (halb alter, halb neuer Wert), rechts bricht die Zeile mal früher um
    indent = (indent + edgeRandom()) / 2;
    lineStart = left + indent * EDGES.left * edges * unit;
    lineRight = right - edgeRandom() * EDGES.right * edges * unit;
    // Zeilen versetzen: die ganze Zeile rückt um einen eigenen Betrag nach links oder rechts (Breite bleibt)
    const shift = (shiftRandom() * 2 - 1) * LINE_SHIFT * (o.lineShift || 0);
    const room = Math.max(0, Math.min(shift < 0 ? lineStart - PAGE_EDGE : o.pageW - PAGE_EDGE - lineRight, Math.abs(shift)));
    lineStart += Math.sign(shift) * room;
    lineRight += Math.sign(shift) * room;
    x = lineStart;
    lineAngle = jitter(CHAOS.slant);
    // Sanfte Welle: Wellenlänge 60–140 mm, Höhe bis ±MISTAKES.wave x-Höhen
    wave = { amp: (0.5 + 0.5 * lineRandom()) * MISTAKES.wave * wobble * unit, len: 60 + 80 * lineRandom(), ph: lineRandom() * 2 * Math.PI };
  };
  const yAt = px => baseline + (px - left) * Math.tan(lineAngle)
    + (wave.amp && wave.amp * Math.sin(wave.ph + 2 * Math.PI * (px - left) / wave.len));
  // Druck: je Wort etwas anders, zum Zeilenende hin nachlassend
  const inkAt = (px, flow) => flow * (1 - MISTAKES.fade * wobble * (px - left) / (right - left));
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

  const widthOf = glyphs => glyphs.reduce((n, g, i) => n + g.w + (i ? g.gap : 0), 0);
  // Wort setzen; gibt die x-Position des Wortanfangs zurück.
  function place(glyphs, sp, flow, rc) {
    if (x > lineStart && x + sp + widthOf(glyphs) > lineRight) newLine();
    else x += sp;
    const start = x;
    // Ganzes Wort etwas höher oder tiefer und leicht schräg
    const wordDy = jitter(CHAOS.wordShift) * unit, tilt = jitter(CHAOS.wordTilt);
    let from = x;
    glyphs.forEach((g, i) => {
      if (i) x += g.gap;
      if (x > lineStart && x + g.w > right) { newLine(); from = x; } // Wort länger als eine Zeile
      const y = yAt(x) + wordDy + (x - from) * Math.tan(tilt);
      if (g.missing) page.items.push({ missing: g.missing, x, y, w: g.w, s: unit, rot: lineAngle });
      else {
        const item = { strokes: g.strokes, x: x + g.dx, y: y + g.dy, s: unit * g.sc, rot: g.rot + tilt + lineAngle };
        if (wobble) item.ink = inkAt(x, flow);
        page.items.push(item);
        // Korrektur: Buchstabe nachgezogen – leicht versetzt ein zweites Mal geschrieben
        if (rc && rc() < FIX.retrace * fix) {
          page.items.push({ ...item, retrace: true, x: item.x + (rc() - 0.5) * 0.08 * unit,
            y: item.y + (rc() - 0.5) * 0.06 * unit, rot: item.rot + (rc() - 0.5) * 0.04 });
        }
      }
      x += g.w;
    });
    return start;
  }

  // Verschreiber: falscher Anfang als Glyphen, oder null. Nutzt die Zufallsquelle des Wortes,
  // damit der Rest des Textes dieselben Varianten behält.
  let wordIndex = 0, sinceSlip = Infinity;
  function slipFor(w, r, chance) {
    if (!(chance < MISTAKES.rate * strike) || sinceSlip < slipGap) return null;
    const core = w.match(/^\p{L}+/u)?.[0];
    if (!core || [...core].length < MISTAKES.minLen || ![...core].every(has)) return null;
    const wrong = misspell(core, letters, r);
    if (!wrong) return null;
    const glyphs = word(wrong, r);
    return widthOf(glyphs) <= right - left - EDGES.left * unit ? glyphs : null; // nie über zwei Zeilen
  }

  // Vergessenes Wort: ^ in die Lücke, das Wort klein darüber. Gibt true zurück, wenn es so gesetzt wurde.
  let sinceForget = Infinity;
  function forget(w, sp, words, wi, rc) {
    sinceForget++;
    if (!fix || !(rc() < FIX.forget * fix) || sinceForget < FIX.gap) return false;
    const chars = [...w];
    if (wi === 0 || wi >= words.length - 1 || !words[wi + 1] || x <= lineStart) return false; // braucht Nachbarn links und rechts
    if (chars.length < 2 || chars.length > 10 || !chars.every(c => resolve(c))) return false;
    sinceForget = 0;
    const cx = x + sp / 2, base = yAt(cx);
    page.items.push({ strokes: caretStrokes(rc, typicalPressure(profile.glyphs)), x: cx, y: base, s: unit, rot: lineAngle, caret: true });
    const glyphs = word(w, rc), k = FIX.scale, width = widthOf(glyphs) * k;
    let xx = Math.min(Math.max(cx - width / 2, left), right - width);
    const y0 = base - FIX.lift * unit;
    glyphs.forEach((g, i) => {
      if (i) xx += g.gap * k;
      page.items.push({ strokes: g.strokes, x: xx + g.dx * k, y: y0 + g.dy * k, s: unit * g.sc * k, rot: g.rot + lineAngle, inserted: true });
      xx += g.w * k;
    });
    return true;
  }

  newPage();
  text.split('\n').forEach((para, pi) => {
    if (pi > 0) newLine();
    const words = para.split(' ');
    words.forEach((w, wi) => {
      const sp = wi > 0 && x > lineStart ? spaceWidth() : 0;
      if (!w) { x += sp; return; }
      tired = fatigue * done / totalChars;
      done += [...w].length;
      // Eigene Zufallsquelle für Korrekturen, damit sie die übrigen Entscheidungen nicht verschieben
      const rc = fix ? rng((Math.imul(seed ^ 0x5bd1e995, 0x27d4eb2d) + wordIndex * 0x165667b1) >>> 0) : null;
      if (rc && forget(w, sp, words, wi, rc)) { wordIndex++; sinceSlip++; return; }
      let flow = 1, slip = null, r;
      if (strike || wobble) {
        r = rng((Math.imul(seed, 0x9e3779b1) + wordIndex * 0x85ebca6b) >>> 0);
        const chance = r();
        flow = 1 + (r() * 2 - 1) * MISTAKES.flow * wobble;
        slip = slipFor(w, r, chance);
      }
      wordIndex++;
      sinceSlip++;
      if (!slip) { place(word(w), sp, flow, rc); return; }
      // Erst falsch, durchstreichen, dann richtig daneben
      sinceSlip = 0;
      const start = place(slip, sp, flow, rc), len = (x - start) / unit;
      page.items.push({
        strokes: strikeStrokes(len, (right - start) / unit, r, typicalPressure(profile.glyphs)),
        x: start, y: yAt(start), s: unit, rot: lineAngle, strike: true, ...(wobble ? { ink: inkAt(start, flow) } : {}),
      });
      place(word(w), spaceWidth(r), flow, rc);
    });
  });

  return { pages, missing: [...missing], spaceMissing: !has(' ') };
}

// Zeichensatz und Profil-Datenmodell (ohne DOM, damit es auch in Node testbar ist).
//
// Profil-Format:
// { format: 'handschrift-profil', version: 1, customPairs: ['xy'], glyphs: { 'a': [v1, v2, v3] } }
// Variante = Liste von Strichen, Strich = Liste von Punkten [x, y, druck, ms].
// x/y sind in x-Höhen gemessen: y = 0 ist die Grundlinie, y = -1 die x-Höhe (y wächst nach unten),
// x = 0 ist der linke Kästchenrand. ms = Zeit seit Beginn des Strichs.

export const VARIANTS = 3;

const range = (from, to) => Array.from({ length: to.charCodeAt(0) - from.charCodeAt(0) + 1 },
  (_, i) => String.fromCharCode(from.charCodeAt(0) + i));

export const GROUPS = [
  { name: 'Kleinbuchstaben', chars: range('a', 'z') },
  { name: 'Großbuchstaben', chars: range('A', 'Z') },
  { name: 'Ziffern', chars: range('0', '9') },
  { name: 'Umlaute', chars: ['ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'ß'] },
  { name: 'Satzzeichen', chars: ['.', ',', '!', '?', ':', ';', '-', '(', ')', '"', "'", '/', '+', '=', '%', '„', '“', '‚', '‘', ' '] },
  { name: 'Verbundene Paare', pairs: true, chars: ['ch', 'ck', 'sch', 'st', 'ei', 'ie', 'en', 'er', 'in', 'an', 'un', 'te', 'de', 'ge', 'be', 'll', 'tt', 'nn', 'ss', 'mm', 'it', 'li', 'au', 'eu', 'nd', 'ng'] },
  { name: 'Extra (optional)', optional: true, chars: ['–', '…', '&', '@', '€', '*', '#', '§'] },
];

export const label = ch => (ch === ' ' ? 'Leerzeichen' : ch);

// Breite des Aufnahme-Kästchens in x-Höhen.
export const boxWidth = ch => ch === ' ' ? 4 : [...ch].length === 1 ? 3 : 1.2 + 1.8 * [...ch].length;

// Zeichen, deren Unterkante auf der Grundlinie steht (ohne Unterlänge, nicht schwebend wie - + = ").
const ON_BASELINE = new Set('abcdehiklmnorstuvwxzäöüßABCDEFGHIKLMNOPRSTUVWXYZÄÖÜ0123456789.!?:;%');
const SNAP = 0.35; // größere Abweichung ist gewollt (z. B. ein f mit Unterlänge) und bleibt stehen

// Variante ausrichten: waagerecht mittig ins Kästchen (unter die Vorlage) und – wenn das Zeichen
// auf der Grundlinie steht und nur knapp daneben liegt – mit der Unterkante genau auf die Grundlinie.
// Verschiebt die Punkte an Ort und Stelle; gibt zurück, ob sich etwas geändert hat.
export function align(ch, strokes) {
  if (ch === ' ' || !strokes.length) return false;
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  let dx = Math.round((boxWidth(ch) / 2 - (minX + maxX) / 2) * 1000) / 1000;
  if (Math.abs(dx) < 0.01) dx = 0; // Rundungsrest, sonst wandert die Variante bei jedem Laden minimal
  const dy = [...ch].every(c => ON_BASELINE.has(c)) && Math.abs(maxY) <= SNAP ? -maxY : 0;
  if (!dx && !dy) return false;
  for (const s of strokes) for (const p of s) {
    p[0] = Math.round((p[0] + dx) * 1000) / 1000;
    p[1] = Math.round((p[1] + dy) * 1000) / 1000;
  }
  return true;
}

// Größen angleichen: Jede Variante wird mit der typischen Höhe ihrer Zeichengruppe in DEINER Schrift verglichen
// (Median, Höhe über der Grundlinie). Weicht sie um mehr als 15 % ab, wird sie um Grundlinie und Mitte skaliert.
// So bleiben die eigenen Proportionen (z. B. kurze Oberlängen) erhalten, nur Ausreißer werden korrigiert.
const SIZE_CLASS = {};
for (const c of 'acemnorsuvwxzgpqy') SIZE_CLASS[c] = 'x';   // x-Höhe (Unterlängen zählen nicht, gemessen wird nach oben)
for (const c of 'bdfhklß') SIZE_CLASS[c] = 'asc';           // Oberlänge
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') SIZE_CLASS[c] = 'cap';
for (const c of '0123456789') SIZE_CLASS[c] = 'digit';
// i, j, t, Umlaute und Satzzeichen bleiben unberührt: Punkte und Querstriche machen ihre Höhe unzuverlässig.
const TOLERANCE = 1.15, MIN_K = 0.5, MAX_K = 2.5;

function sizeClass(ch) {
  const cls = [...ch].map(c => SIZE_CLASS[c]);
  if (cls.length === 1) return cls[0] || null;
  if (!cls.every(c => c === 'x' || c === 'asc')) return null; // Paar mit i, t …
  return cls.includes('asc') ? 'asc' : 'x';
}
const topOf = strokes => -Math.min(...strokes.flat().map(p => p[1]));

// Gibt die geänderten Zeichen zurück (verändert das Profil an Ort und Stelle).
export function equalize(profile) {
  const tops = {};
  for (const [ch, variants] of Object.entries(profile.glyphs)) {
    const c = sizeClass(ch);
    if (c) for (const v of variants) if (v.length && topOf(v) > 0.1) (tops[c] ||= []).push(topOf(v));
  }
  const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const changed = new Set();
  for (const [ch, variants] of Object.entries(profile.glyphs)) {
    const c = sizeClass(ch);
    if (!c || (tops[c] || []).length < 4) continue; // zu wenig Vergleich
    const target = median(tops[c]);
    for (const v of variants) {
      if (!v.length) continue;
      const top = topOf(v);
      if (top <= 0.1) continue;
      const k = Math.min(MAX_K, Math.max(MIN_K, target / top));
      if (k < TOLERANCE && k > 1 / TOLERANCE) continue;
      const xs = v.flat().map(p => p[0]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      for (const s of v) for (const p of s) {
        p[0] = Math.round((cx + (p[0] - cx) * k) * 1000) / 1000;
        p[1] = Math.round(p[1] * k * 1000) / 1000;
      }
      changed.add(ch);
    }
  }
  return [...changed];
}

// Alle Aufnahmen ausrichten (für Aufnahmen von vor dieser Funktion). Gibt zurück, ob sich etwas geändert hat.
export function alignAll(profile) {
  let changed = false;
  for (const [ch, variants] of Object.entries(profile.glyphs)) for (const v of variants) changed = align(ch, v) || changed;
  return changed;
}

export function emptyProfile() {
  return { format: 'handschrift-profil', version: 1, customPairs: [], glyphs: {} };
}

// Alle Gruppen inkl. eigener Paare.
export function groupsFor(profile) {
  return GROUPS.map(g => g.pairs ? { ...g, chars: [...g.chars, ...profile.customPairs] } : g);
}

export function variantsOf(profile, ch) {
  return profile.glyphs[ch] || (profile.glyphs[ch] = Array.from({ length: VARIANTS }, () => []));
}

export const recordedCount = (profile, ch) => (profile.glyphs[ch] || []).filter(v => v.length).length;

// Ein Zeichen gilt als fertig, sobald es mindestens eine Variante hat. Extras zählen nicht.
export function progress(profile) {
  const chars = groupsFor(profile).filter(g => !g.optional).flatMap(g => g.chars);
  return { done: chars.filter(ch => recordedCount(profile, ch) > 0).length, total: chars.length };
}

// Eigenes Paar prüfen: 2–4 Zeichen, keine Leerzeichen, noch nicht vorhanden.
export function checkPair(profile, text) {
  const t = text.trim();
  if ([...t].length < 2 || [...t].length > 4) return 'Ein Paar muss 2 bis 4 Zeichen lang sein.';
  if (/\s/.test(t)) return 'Bitte ohne Leerzeichen.';
  if (groupsFor(profile).some(g => g.chars.includes(t))) return `„${t}“ gibt es schon.`;
  return null;
}

// Importierte Datei prüfen und sauber neu aufbauen (Datei kommt von außen, nichts blind übernehmen).
export function parseProfile(json) {
  let data;
  try { data = JSON.parse(json); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (!data || data.format !== 'handschrift-profil' || data.version !== 1) {
    throw new Error('Die Datei ist kein Handschrift-Profil.');
  }
  if (typeof data.glyphs !== 'object' || data.glyphs === null || Array.isArray(data.glyphs)) {
    throw new Error('Das Profil enthält keine Zeichen.');
  }
  const profile = emptyProfile();
  const num = n => typeof n === 'number' && Number.isFinite(n);
  for (const [ch, variants] of Object.entries(data.glyphs)) {
    if ([...ch].length < 1 || [...ch].length > 4 || !Array.isArray(variants)) throw new Error(`Ungültiger Eintrag für „${ch}“.`);
    profile.glyphs[ch] = Array.from({ length: VARIANTS }, (_, i) => {
      const strokes = variants[i] || [];
      if (!Array.isArray(strokes) || !strokes.every(s => Array.isArray(s) &&
          s.every(p => Array.isArray(p) && p.length === 4 && p.every(num)))) {
        throw new Error(`Ungültige Striche bei „${ch}“.`);
      }
      return strokes.map(s => s.map(p => [...p]));
    });
  }
  if (Array.isArray(data.customPairs)) {
    for (const p of data.customPairs) {
      if (typeof p === 'string' && !checkPair(profile, p)) profile.customPairs.push(p.trim());
    }
  }
  return profile;
}

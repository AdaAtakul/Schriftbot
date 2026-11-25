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

// Sammlung: mehrere Profile (Name, Stil-Einstellungen, Schrift) in einer Datei.
// Für das Backup aller Profile und zum Teilen eines Profils mit anderen (ohne DOM, in Node testbar).
// { format: 'handschrift-sammlung', version: 1, created, profiles: [{ name, from, settings, handwriting }] }
// from: Index des Profils, dessen Schrift benutzt wird (dann handwriting = null), sonst null.
import { parseProfile } from './profile.js';
import { STYLE_KEYS } from './stil.js';

export const FORMAT = 'handschrift-sammlung';

// Nur diese Einstellungen wandern mit (keine Texte, Geräte-Werte oder Schlüssel). boxScale gehört zur Schrift.
const PROFILE_KEYS = ['style', 'styles', 'ink', 'inkHue', 'pen', 'paper', 'paperColor', 'xHeight', 'lineHeight', 'margin'];
const HANDWRITING_KEYS = ['boxScale'];
const isText = v => typeof v === 'string' && v.length <= 40;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Einstellungen auf erlaubte Schlüssel und Typen beschränken
export function cleanSettings(s, withHandwriting) {
  const out = {};
  for (const k of [...PROFILE_KEYS, ...(withHandwriting ? HANDWRITING_KEYS : [])]) {
    const v = s?.[k];
    if (k === 'styles') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      out.styles = {};
      for (const [name, vals] of Object.entries(v)) {
        if (!isText(name) || !vals || typeof vals !== 'object') continue;
        out.styles[name] = Object.fromEntries(STYLE_KEYS.filter(key => isNum(vals[key])).map(key => [key, vals[key]]));
      }
    } else if (isText(v) || isNum(v)) out[k] = v;
  }
  return out;
}

export function buildCollection(entries) {
  return {
    format: FORMAT, version: 1, created: new Date().toISOString(),
    profiles: entries.map(e => ({
      name: String(e.name).slice(0, 60),
      from: e.from ?? null,
      settings: cleanSettings(e.settings, e.from == null),
      handwriting: e.from == null ? e.handwriting : null,
    })),
  };
}

export function isCollection(text) {
  try { return JSON.parse(text)?.format === FORMAT; } catch { return false; }
}

// Prüft die Datei vollständig; jede Schrift läuft durch dieselbe Prüfung wie ein einzelnes Profil.
export function parseCollection(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT || data.version !== 1) throw new Error('Die Datei ist keine Handschrift-Sammlung.');
  if (!Array.isArray(data.profiles) || !data.profiles.length || data.profiles.length > 50) throw new Error('Die Sammlung enthält keine Schriften.');
  return data.profiles.map((p, i) => {
    const name = typeof p?.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 60) : `Schrift ${i + 1}`;
    const from = p?.from ?? null;
    if (from !== null) {
      const owner = data.profiles[from];
      if (!Number.isInteger(from) || from === i || !owner || owner.from != null) throw new Error(`„${name}“ verweist auf eine Schrift, die fehlt.`);
      return { name, from, settings: cleanSettings(p.settings, false), handwriting: null };
    }
    let handwriting;
    try { handwriting = parseProfile(JSON.stringify(p.handwriting)); } catch (err) { throw new Error(`Schrift von „${name}“: ${err.message}`); }
    return { name, from: null, settings: cleanSettings(p.settings, true), handwriting };
  });
}

// „Name“, sonst „Name (2)“, „Name (3)“ … – damit Importiertes nichts überschreibt
export function uniqueName(name, taken) {
  if (!taken.includes(name)) return name;
  for (let n = 2; ; n++) if (!taken.includes(`${name} (${n})`)) return `${name} (${n})`;
}

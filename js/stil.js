// Stil-Vorlagen für die eigene Handschrift (ohne DOM, in Node testbar).
// Eine Vorlage legt die Stil-Werte fest; jede lässt sich mit den Reglern anpassen. Die Anpassungen
// werden je Vorlage gemerkt (settings.styles[vorlage]) und lassen sich zurücksetzen.
// Werte in Prozent wie die Regler: Verbindungen, Unordnung, Durchstreichen, Korrekturen, Müdigkeit, Zeilen & Druck, Ränder, Strichdicke.
export const STYLE_KEYS = ['connect', 'chaos', 'strike', 'fix', 'fatigue', 'wobble', 'edges', 'weight'];

export const PRESETS = {
  'sehr-ordentlich':   { label: 'Sehr ordentlich',   desc: 'Wie in Schönschrift: gleichmäßig, gerade Zeilen, keine Fehler.', connect: 40,  chaos: 10,  strike: 0, fix: 0, fatigue: 0,  wobble: 0,   edges: 0,   weight: 95 },
  'ordentlich':        { label: 'Ordentlich',        desc: 'Sauber, mit leichten natürlichen Schwankungen.', connect: 60,  chaos: 30,  strike: 0, fix: 0, fatigue: 10,  wobble: 15,  edges: 10,  weight: 100 },
  'normal':            { label: 'Normal',            desc: 'Wie man im Alltag schreibt.', connect: 70,  chaos: 50,  strike: 0, fix: 0, fatigue: 15,  wobble: 35,  edges: 30,  weight: 100 },
  'locker':            { label: 'Locker',            desc: 'Zügig geschrieben, hier und da durchgestrichen oder verbessert.', connect: 80,  chaos: 70,  strike: 20, fix: 15, fatigue: 35, wobble: 55,  edges: 50,  weight: 110 },
  'unordentlich':      { label: 'Unordentlich',      desc: 'Eilig mitgeschrieben: schiefe Zeilen, Korrekturen, wird zum Ende hin krakeliger.', connect: 90,  chaos: 100, strike: 40, fix: 35, fatigue: 60, wobble: 80,  edges: 75,  weight: 120 },
  'sehr-unordentlich': { label: 'Sehr unordentlich', desc: 'Schnell hingekritzelt.', connect: 100, chaos: 140, strike: 70, fix: 60, fatigue: 85, wobble: 100, edges: 100, weight: 135 },
};
export const DEFAULT_STYLE = 'ordentlich'; // neue Profile: ordentlich, wenig Unordnung
const LEGACY_STYLE = 'normal'; // alte Regler-Werte wurden als „Normal“ übernommen

const styleKey = s => (PRESETS[s.style] ? s.style : DEFAULT_STYLE);
const pick = obj => Object.fromEntries(STYLE_KEYS.filter(k => k in obj).map(k => [k, obj[k]]));

// Wirksame Stil-Werte: Vorlage, darüber die eigenen Anpassungen dieser Vorlage.
export function styleValues(s) {
  const key = styleKey(s);
  return { ...pick(PRESETS[key]), ...pick(s.styles?.[key] || {}) };
}

// Wurde die gewählte Vorlage angepasst?
export const isModified = s => Object.keys(pick(s.styles?.[styleKey(s)] || {})).length > 0;

// Einen Stil-Wert ändern: wird als Anpassung der gewählten Vorlage gemerkt. Gibt das neue styles-Objekt zurück.
export function withStyleValue(s, key, value) {
  const k = styleKey(s), styles = { ...(s.styles || {}) };
  const own = { ...(styles[k] || {}), [key]: value };
  if (PRESETS[k][key] === value) delete own[key]; // wieder wie die Vorlage
  styles[k] = own;
  return styles;
}

// Einstellungen von vor den Vorlagen: Wer schon Regler hatte, behält genau sein Aussehen
// (als angepasste Vorlage „Normal“, ohne Ränder). Gibt { style, styles } zurück oder null, wenn nichts zu tun ist.
export function migrateStyle(raw) {
  if (raw.style) return null;
  if (!['connect', 'chaos', 'weight', 'mistakes'].some(k => k in raw)) return { style: DEFAULT_STYLE, styles: {} }; // neu: Vorlage „Ordentlich“
  const m = raw.mistakes ?? 0;
  const own = { connect: raw.connect ?? 70, chaos: raw.chaos ?? 50, weight: raw.weight ?? 100, strike: m, wobble: m, edges: 0 };
  for (const k of STYLE_KEYS) if (own[k] === PRESETS[LEGACY_STYLE][k]) delete own[k];
  return { style: LEGACY_STYLE, styles: { [LEGACY_STYLE]: own } };
}

// Tinte aus dem Farbton-Regler: kräftig und dunkel genug für Papier (wie echte Tinte).
export function hueColor(h) {
  const s = 0.72, l = 0.36;
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

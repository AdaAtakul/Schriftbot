// Demo-Schrift: Beim allerersten Öffnen (noch keine eigene Schrift) wird eine mitgelieferte Schrift als Profil
// „Marie · natürlich“ angelegt und aktiviert, damit man DeineSchrift sofort ausprobieren kann.
// Die Datei ist ein normales geteiltes Profil (Profil → „Profil teilen“) unter demo/demo-schrift.json.
// Fehlt sie, passiert nichts.
import { parseCollection } from './sammlung.js';
import { progress } from './profile.js';
import { DEFAULT_STYLE } from './stil.js';
import {
  profilesMeta, activeProfile, createProfile, setActiveProfile, saveGlyphs, loadGlyphs, seedSettings, renameProfile,
} from './storage.js';

export const DEMO_URL = 'demo/demo-schrift.json';
const DONE_KEY = 'demo-angelegt';
export const DEMO_NAME = 'Marie · natürlich';
// Früher hieß die Demo „Beispielschrift“: einmalig umbenennen (selbst vergebene Namen bleiben)
export function renameDemo() {
  for (const p of profilesMeta().list) if (p.demo && !p.builtin && p.name === 'Beispielschrift') renameProfile(p.id, DEMO_NAME);
}

export const isDemo = (p = activeProfile()) => !!p?.demo;

// Vor dem Laden des Profils aufrufen. Gibt true zurück, wenn die Demo gerade angelegt wurde.
export async function setupDemo() {
  try {
    if (localStorage.getItem(DONE_KEY)) return false;
    const m = profilesMeta();
    if (m.list.length !== 1 || m.list[0].from) return false;
    if (progress(await loadGlyphs(m.list[0].id)).done > 0) { localStorage.setItem(DONE_KEY, 'eigene'); return false; }
    const res = await fetch(DEMO_URL, { cache: 'no-cache' });
    if (!res.ok) return false;
    const [entry] = parseCollection(await res.text());
    if (!entry?.handwriting) return false;
    const id = createProfile({ name: DEMO_NAME, from: null, demo: true });
    await saveGlyphs(id, entry.handwriting);
    // Standard für den ersten Eindruck: ordentlich, schwarze Tinte, liniertes weißes Papier
    seedSettings(id, { ...entry.settings, style: DEFAULT_STYLE, styles: {}, ink: 'schwarz' });
    setActiveProfile(id);
    localStorage.setItem(DONE_KEY, '1');
    return true;
  } catch {
    return false; // offline oder kaputte Datei: ohne Demo weiter
  }
}

// Erstes eigenes Profil (nicht die Demo, keine geliehene Schrift)
export const ownProfile = (m = profilesMeta()) => m.list.find(p => !p.demo && !p.from) || null;

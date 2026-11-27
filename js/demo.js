// Erster Besuch (noch keine eigene Schrift): eine mitgelieferte Schrift wählen und das Start-Aussehen setzen,
// damit man DeineSchrift sofort ausprobieren kann. Offline oder bei Fehlern passiert nichts.
import { progress } from './profile.js';
import { START_FONT, START_LOOK } from './stil.js';
import { useBuiltin } from './schriften.js';
import {
  profilesMeta, activeProfile, setActiveProfile, loadGlyphs, seedSettings, renameProfile,
} from './storage.js';

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
    if (m.list.length !== 1) return false;
    if (progress(await loadGlyphs(m.list[0].id)).done > 0) { localStorage.setItem(DONE_KEY, 'eigene'); return false; }
    const id = await useBuiltin(START_FONT);
    seedSettings('p1', START_LOOK); // Aussehen für alle Schriften
    setActiveProfile(id);
    localStorage.setItem(DONE_KEY, '1');
    return true;
  } catch {
    return false; // offline oder kaputte Datei: ohne Demo weiter
  }
}


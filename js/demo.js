// Demo-Schrift: Beim allerersten Öffnen (noch keine eigene Schrift) wird eine mitgelieferte Schrift als Profil
// „Beispielschrift“ angelegt und aktiviert, damit man DeineSchrift sofort ausprobieren kann.
// Die Datei ist ein normales geteiltes Profil (Profil → „Profil teilen“) unter demo/demo-schrift.json.
// Fehlt sie, passiert nichts.
import { parseCollection } from './sammlung.js';
import { progress } from './profile.js';
import {
  profilesMeta, activeProfile, createProfile, setActiveProfile, saveGlyphs, loadGlyphs, seedSettings,
} from './storage.js';

export const DEMO_URL = 'demo/demo-schrift.json';
const DONE_KEY = 'demo-angelegt';
// Eine Seite Beispieltext beim ersten Öffnen, damit die Vorschau sofort etwas zeigt.
// Nur gängige Zeichen (keine Anführungszeichen, Gedankenstriche o. Ä.), damit nichts rot markiert wird.
export const SAMPLE_TEXT = [
  'Liebe Leserin, lieber Leser,',
  'das hier ist ein Beispieltext, damit du sofort siehst, wie DeineSchrift arbeitet. Jedes Wort wird aus echten Buchstaben einer Handschrift zusammengesetzt. Kein Buchstabe sieht zweimal genau gleich aus, die Zeilen schwanken ein wenig, und manchmal werden Buchstaben miteinander verbunden, so wie beim Schreiben mit einem Stift.',
  'Probier es aus: Lösche diesen Text und tippe deinen eigenen ein. Daneben siehst du sofort die Vorschau. Unter Stil und Papier wählst du, ob die Schrift ordentlich oder eher schnell hingeschrieben wirken soll, welches Papier du möchtest und welche Tintenfarbe dir gefällt.',
  'Gefällt dir das Ergebnis, exportierst du die Seite als PDF, als Bild oder direkt für GoodNotes. Noch persönlicher wird es mit deiner eigenen Schrift: Im Bereich Aufnehmen schreibst du jeden Buchstaben ein paar Mal, danach schreibt DeineSchrift jeden Text in deiner Handschrift.',
  'Viel Spaß beim Ausprobieren!',
].join('\n\n');
const SAMPLE_KEY = 'beispieltext-gesetzt';

// Beim allerersten Öffnen den Beispieltext einsetzen (nur wenn noch nie Text da war; gelöschter Text kommt nicht wieder).
export function seedSampleText(currentText) {
  try {
    if (localStorage.getItem(SAMPLE_KEY)) return false;
    localStorage.setItem(SAMPLE_KEY, '1');
    if (currentText && currentText.trim()) return false;
    seedSettings('p1', { text: SAMPLE_TEXT });
    return true;
  } catch { return false; }
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
    const id = createProfile({ name: 'Beispielschrift', from: null, demo: true });
    await saveGlyphs(id, entry.handwriting);
    seedSettings(id, { style: 'normal', styles: {}, ...entry.settings });
    setActiveProfile(id);
    localStorage.setItem(DONE_KEY, '1');
    return true;
  } catch {
    return false; // offline oder kaputte Datei: ohne Demo weiter
  }
}

// Erstes eigenes Profil (nicht die Demo, keine geliehene Schrift)
export const ownProfile = (m = profilesMeta()) => m.list.find(p => !p.demo && !p.from) || null;

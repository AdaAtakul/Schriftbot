// Mitgelieferte Handschriften echter Menschen: einzelne Buchstaben aus der Sammlung UJIpenchars2
// (F. Prat, M. Castro, D. Llorens, A. Marzal, J. Vilar; CC BY 4.0, doi:10.24432/C5FG8S),
// für DeineSchrift umgerechnet (Grundlinie, x-Höhe, Umlaute aus den Punkten des ü). Werkzeug: tools/uji-schriften.py
// Eine Schrift wird erst geladen, wenn man sie wählt; danach ist sie ein normales Profil.
import { parseCollection } from './sammlung.js';
import { profilesMeta, createProfile, setActiveProfile, saveGlyphs, seedSettings, renameProfile } from './storage.js';

export const BUILTIN = [
  { id: 'uji-w18', name: 'Saubere Schulschrift', file: 'schriften/schrift-a.json' },
  { id: 'uji-w07', name: 'Runde Schrift', file: 'schriften/schrift-b.json' },
  { id: 'uji-w33', name: 'Klare Druckschrift', file: 'schriften/schrift-c.json' },
  { id: 'uji-w11', name: 'Schwungvolle Schrift', file: 'schriften/schrift-d.json' },
  { id: 'uji-w44', name: 'Schnell notiert', file: 'schriften/schrift-e.json' },
  { id: 'uji-w42', name: 'Krakelig', file: 'schriften/schrift-f.json' },
];

// Frühere, technische Namen („Schrift A · ordentlich“) einmalig umbenennen; eigene Namen bleiben
export function renameOldBuiltins() {
  for (const p of profilesMeta().list) {
    const spec = p.builtin && BUILTIN.find(b => b.id === p.builtin);
    if (spec && /^Schrift [A-F] · /.test(p.name)) renameProfile(p.id, spec.name);
  }
}

// Schon angelegt? Dann nur wechseln, sonst laden und als Profil anlegen. Gibt die Profil-Id zurück.
export async function useBuiltin(id) {
  const spec = BUILTIN.find(b => b.id === id);
  if (!spec) throw new Error('Unbekannte Schrift');
  const have = profilesMeta().list.find(p => p.builtin === id);
  if (have) { setActiveProfile(have.id); return have.id; }
  const res = await fetch(spec.file);
  if (!res.ok) throw new Error('Die Schrift konnte nicht geladen werden (Internet nötig beim ersten Mal).');
  const [entry] = parseCollection(await res.text());
  if (!entry?.handwriting) throw new Error('Die Schriftdatei ist beschädigt.');
  const pid = createProfile({ name: spec.name, from: null, demo: true, builtin: id });
  await saveGlyphs(pid, entry.handwriting);
  seedSettings(pid, { ...entry.settings, styles: {} });
  setActiveProfile(pid);
  return pid;
}

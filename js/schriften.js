// Mitgelieferte Handschriften echter Menschen: einzelne Buchstaben aus der Sammlung UJIpenchars2
// (F. Prat, M. Castro, D. Llorens, A. Marzal, J. Vilar; CC BY 4.0, doi:10.24432/C5FG8S),
// für DeineSchrift umgerechnet (Grundlinie, x-Höhe, Umlaute aus den Punkten des ü). Werkzeug: tools/uji-schriften.py
// Eine Schrift wird erst geladen, wenn man sie wählt; danach liegt sie wie eine eigene im Speicher (demo: true).
import { parseCollection } from './sammlung.js';
import { profilesMeta, createProfile, saveGlyphs, renameProfile } from './storage.js';

export const BUILTIN = [
  { id: 'uji-w18', name: 'Lena · sauber', old: 'Saubere Schulschrift', file: 'schriften/schrift-a.json' },
  { id: 'uji-w07', name: 'Mia · rund', old: 'Runde Schrift', file: 'schriften/schrift-b.json' },
  { id: 'uji-w33', name: 'Jonas · klar', old: 'Klare Druckschrift', file: 'schriften/schrift-c.json' },
  { id: 'uji-w11', name: 'Sophie · schwungvoll', old: 'Schwungvolle Schrift', file: 'schriften/schrift-d.json' },
  { id: 'uji-w44', name: 'Paul · schnell notiert', old: 'Schnell notiert', file: 'schriften/schrift-e.json' },
  { id: 'uji-w42', name: 'Ben · krakelig', old: 'Krakelig', file: 'schriften/schrift-f.json' },
  { id: 'uji-w02', name: 'Emma · gerade', file: 'schriften/schrift-g.json' },
  { id: 'uji-w06', name: 'Leon · schräg', file: 'schriften/schrift-h.json' },
  { id: 'uji-w46', name: 'Hanna · schmal', file: 'schriften/schrift-i.json' },
  { id: 'uji-w58', name: 'Noah · breit', file: 'schriften/schrift-j.json' },
  { id: 'uji-w15', name: 'Clara · klein', file: 'schriften/schrift-k.json' },
  { id: 'uji-w05', name: 'Felix · luftig', file: 'schriften/schrift-l.json' },
];

// Frühere Namen („Schrift A · ordentlich“, „Saubere Schulschrift“) einmalig umbenennen; selbst vergebene Namen bleiben
export function renameOldBuiltins() {
  for (const p of profilesMeta().list) {
    const spec = p.builtin && BUILTIN.find(b => b.id === p.builtin);
    if (spec && (/^Schrift [A-F] · /.test(p.name) || p.name === spec.old)) renameProfile(p.id, spec.name);
  }
}

// Schon geladen? Dann nur die Id, sonst einmal laden und merken. Gibt die Id der Handschrift zurück (Wählen macht der Aufrufer).
export async function useBuiltin(id) {
  const spec = BUILTIN.find(b => b.id === id);
  if (!spec) throw new Error('Unbekannte Schrift');
  const have = profilesMeta().list.find(p => p.builtin === id);
  if (have) return have.id;
  const res = await fetch(spec.file);
  if (!res.ok) throw new Error('Die Schrift konnte nicht geladen werden (Internet nötig beim ersten Mal).');
  const [entry] = parseCollection(await res.text());
  if (!entry?.handwriting) throw new Error('Die Schriftdatei ist beschädigt.');
  const pid = createProfile({ name: spec.name, demo: true, builtin: id });
  await saveGlyphs(pid, entry.handwriting);
  return pid;
}

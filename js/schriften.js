// Mitgelieferte Handschriften echter Menschen: einzelne Buchstaben aus der Sammlung UJIpenchars2
// (F. Prat, M. Castro, D. Llorens, A. Marzal, J. Vilar; CC BY 4.0, doi:10.24432/C5FG8S),
// für DeineSchrift umgerechnet (Grundlinie, x-Höhe, Umlaute aus den Punkten des ü). Werkzeug: tools/uji-schriften.py
// Eine Schrift wird erst geladen, wenn man sie wählt; danach liegt sie wie eine eigene im Speicher (demo: true).
import { parseCollection } from './sammlung.js';
import { profilesMeta, createProfile, saveGlyphs, renameProfile } from './storage.js';

// group: ordentlich, normal, unordentlich – nach der gemessenen Streuung der Grundlinie (tools/uji-schriften.py)
export const BUILTIN = [
  { id: 'marie', name: 'Marie · natürlich', file: 'demo/demo-schrift.json', group: 'ordentlich' },
  { id: 'uji-w18', name: 'Lena · sauber', old: 'Saubere Schulschrift', file: 'schriften/schrift-a.json', group: 'ordentlich' },
  { id: 'uji-w07', name: 'Mia · rund', old: 'Runde Schrift', file: 'schriften/schrift-b.json', group: 'ordentlich' },
  { id: 'uji-w15', name: 'Clara · klein', file: 'schriften/schrift-k.json', group: 'ordentlich' },
  { id: 'uji-w11', name: 'Sophie · schwungvoll', old: 'Schwungvolle Schrift', file: 'schriften/schrift-d.json', group: 'ordentlich' },
  { id: 'uji-w58', name: 'Noah · breit', file: 'schriften/schrift-j.json', group: 'ordentlich' },
  { id: 'uji-w02', name: 'Emma · gerade', file: 'schriften/schrift-g.json', group: 'normal' },
  { id: 'uji-w06', name: 'Leon · schräg', file: 'schriften/schrift-h.json', group: 'normal' },
  { id: 'uji-w33', name: 'Jonas · klar', old: 'Klare Druckschrift', file: 'schriften/schrift-c.json', group: 'normal' },
  { id: 'uji-w05', name: 'Felix · luftig', file: 'schriften/schrift-l.json', group: 'normal' },
  { id: 'uji-w46', name: 'Hanna · schmal', file: 'schriften/schrift-i.json', group: 'normal' },
  { id: 'uji-w44', name: 'Paul · schnell notiert', old: 'Schnell notiert', file: 'schriften/schrift-e.json', group: 'unordentlich' },
  { id: 'uji-w42', name: 'Ben · krakelig', old: 'Krakelig', file: 'schriften/schrift-f.json', group: 'unordentlich' },
];
export const GROUPS = { ordentlich: 'Ordentlich', normal: 'Normal', unordentlich: 'Unordentlich' };
// Früher angelegte Beispiel-Schrift (ohne builtin-Kennung) gilt als „marie“
export const builtinOf = (b, list) => list.find(p => p.builtin === b.id) || (b.id === 'marie' ? list.find(p => p.demo && !p.builtin) : null);

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
  const have = builtinOf(spec, profilesMeta().list);
  if (have) return have.id;
  const res = await fetch(spec.file);
  if (!res.ok) throw new Error('Die Schrift konnte nicht geladen werden (Internet nötig beim ersten Mal).');
  const [entry] = parseCollection(await res.text());
  if (!entry?.handwriting) throw new Error('Die Schriftdatei ist beschädigt.');
  const pid = createProfile({ name: spec.name, demo: true, builtin: id });
  await saveGlyphs(pid, entry.handwriting);
  return pid;
}

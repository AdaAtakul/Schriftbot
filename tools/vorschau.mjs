// Schriftproben der mitgelieferten Schriften für die Schrift-Auswahl erzeugen: node tools/vorschau.mjs
// Schreibt js/vorschau-daten.js (Schlüssel: Kennung aus BUILTIN, „demo“ für die Beispiel-Schrift). Nach neuen Schriften neu ausführen.
import { readFileSync, writeFileSync } from 'node:fs';
import { previewPath } from '../js/vorschau.js';
import { BUILTIN } from '../js/schriften.js';

const hw = file => JSON.parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8')).profiles[0].handwriting;
const out = { demo: previewPath(hw('demo/demo-schrift.json')) };
for (const b of BUILTIN) out[b.id] = previewPath(hw(b.file));
writeFileSync(new URL('../js/vorschau-daten.js', import.meta.url),
  '// Erzeugt mit tools/vorschau.mjs – nicht von Hand ändern.\nexport default ' + JSON.stringify(out) + ';\n');
console.log(Object.keys(out).length, 'Schriftproben');

// Selbsttest für Stil-Vorlagen und Farbton: node tests/stil.test.mjs
import assert from 'node:assert/strict';
import { PRESETS, STYLE_KEYS, styleValues, isModified, withStyleValue, migrateStyle, hueColor } from '../js/stil.js';

// Jede Vorlage legt alle Stil-Werte fest; von ordentlich nach unordentlich wird alles mehr (außer Dicke egal)
const order = Object.keys(PRESETS);
for (const k of order) for (const key of STYLE_KEYS) assert.equal(typeof PRESETS[k][key], 'number', `${k}.${key}`);
for (const key of ['chaos', 'strike', 'fix', 'fatigue', 'wobble', 'edges']) {
  for (let i = 1; i < order.length; i++) assert.ok(PRESETS[order[i]][key] >= PRESETS[order[i - 1]][key], `${key} steigt`);
}
assert.equal(PRESETS['sehr-ordentlich'].strike, 0, 'sehr ordentlich streicht nichts durch');

// Anpassen: nur die gewählte Vorlage ändert sich, andere bleiben; zurück auf den Vorlagenwert = nicht angepasst
let s = { style: 'unordentlich' };
assert.deepEqual(styleValues(s), Object.fromEntries(STYLE_KEYS.map(k => [k, PRESETS.unordentlich[k]])));
s = { ...s, styles: withStyleValue(s, 'weight', 180) };
assert.equal(styleValues(s).weight, 180);
assert.ok(isModified(s));
assert.equal(styleValues({ ...s, style: 'ordentlich' }).weight, PRESETS.ordentlich.weight, 'andere Vorlage unberührt');
assert.equal(styleValues({ ...s, style: 'ordentlich', styles: s.styles }).weight, 100);
s = { ...s, styles: withStyleValue(s, 'weight', PRESETS.unordentlich.weight) };
assert.ok(!isModified(s), 'Vorlagenwert = keine Anpassung');
// Unbekannte Vorlage → Standard (Ordentlich)
assert.equal(styleValues({ style: 'gibtsnicht' }).chaos, PRESETS.ordentlich.chaos);

// Alte Einstellungen bleiben optisch gleich: Regler-Werte als Anpassung von „Normal“, Schreibfehler → beide neuen Regler, keine Ränder
const mig = migrateStyle({ connect: 30, chaos: 50, weight: 140, mistakes: 40, text: 'x' });
const v = styleValues(mig);
assert.deepEqual([v.connect, v.chaos, v.weight, v.strike, v.wobble, v.edges], [30, 50, 140, 40, 40, 0]);
assert.equal(migrateStyle({ style: 'locker' }), null, 'schon umgestellt');
assert.deepEqual(migrateStyle({ text: 'nur Geräte-Werte' }), { style: 'ordentlich', styles: {} }, 'neues Profil startet mit Ordentlich');

// Farbton → kräftige, dunkle Tinte
assert.equal(hueColor(0), '#9e1a1a');
assert.match(hueColor(220), /^#[0-9a-f]{6}$/);
const lum = h => { const c = hueColor(h); return [1, 3, 5].reduce((n, i) => n + parseInt(c.slice(i, i + 2), 16), 0) / 3; };
for (let h = 0; h < 360; h += 30) assert.ok(lum(h) < 130, `Farbton ${h}° dunkel genug`);
console.log(`OK – Stil: ${order.length} Vorlagen, Farbton 220° = ${hueColor(220)}`);

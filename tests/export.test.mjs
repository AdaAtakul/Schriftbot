// Selbsttest für den PDF-Export: node tests/export.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { layout, DEFAULTS } from '../js/layout.js';
import { itemPolygons, buildPdf, simplify } from '../js/export.js';

globalThis.window = { jspdf: createRequire(import.meta.url)('../vendor/jspdf.umd.min.js') };

// Drehung und Skalierung: Punkt (1, 0) eines um 90° gedrehten, doppelt großen Items landet bei (x, y + 2)
const it = { strokes: [[[0.9, 0, 0.5, 0], [1.1, 0, 0.5, 10]]], x: 10, y: 20, s: 2, rot: Math.PI / 2 };
const poly = itemPolygons(it)[0];
const cx = poly.reduce((n, p) => n + p[0], 0) / poly.length, cy = poly.reduce((n, p) => n + p[1], 0) / poly.length;
assert.ok(Math.abs(cx - 10) < 0.01 && Math.abs(cy - 22) < 0.1, `Mittelpunkt ${cx}, ${cy}`);

// Mehrseitiges PDF, reine Vektorpfade, keine eingebetteten Bilder
const p = emptyProfile();
variantsOf(p, 'a').forEach((v, i) => v.push([[0.2, -0.5, 0.5, 0], [0.8 + i * 0.1, -0.9, 0.7, 10], [0.9, 0, 0.4, 20]]));
const o = { ...DEFAULTS, ruled: true, lineSpacing: 8.8, lineTop: 20, chaos: 0.5 };
const result = layout(Array(60).fill('aaaa aaxa').join('\n'), p, o);
const blob = buildPdf(result, o, '#1f4fbf', true);
const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
assert.ok(text.startsWith('%PDF-'));
assert.equal((text.match(/\/Type \/Page\b/g) || []).length, result.pages.length, 'Seitenzahl');
assert.ok(result.pages.length >= 2);
assert.ok(!/\/Subtype \/Image/.test(text), 'keine Pixelbilder');
// Vereinfachen: gerade Linie schrumpft auf 2 Punkte, Ecke bleibt erhalten, Abweichung ≤ Toleranz
const straight = Array.from({ length: 50 }, (_, i) => [i / 10, 0.001 * Math.sin(i)]);
assert.equal(simplify(straight).length, 2);
const corner = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]];
assert.deepEqual(simplify(corner, 0.01), [[0, 0], [2, 0], [2, 2]]);
const wave = Array.from({ length: 200 }, (_, i) => [i / 20, Math.sin(i / 10)]);
const w2 = simplify(wave, 0.02);
assert.ok(w2.length < wave.length / 2, `${w2.length} von ${wave.length} Punkten`);
console.log(`OK – Export: ${result.pages.length} Seiten, ${Math.round(blob.size / 1024)} KB`);

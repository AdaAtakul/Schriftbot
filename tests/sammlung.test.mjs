// Selbsttest für Sammlungen (Backup aller Profile, Profil teilen): node tests/sammlung.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { buildCollection, parseCollection, isCollection, uniqueName, cleanSettings } from '../js/sammlung.js';

const hw = emptyProfile();
variantsOf(hw, 'a')[0].push([[0, 0, 0.5, 0], [1, -1, 0.5, 9]]);
const coll = buildCollection([
  { name: 'Meine Schrift', from: null, handwriting: hw,
    settings: { style: 'ordentlich', styles: { ordentlich: { weight: 120, evil: 'x' } }, ink: 'eigen', inkHue: 140, boxScale: 0.8,
      text: 'privat', apiKey: 'geheim', lastBackup: 5 } },
  { name: 'Schnell', from: 0, handwriting: hw, settings: { style: 'unordentlich', boxScale: 0.5 } },
]);
const text = JSON.stringify(coll);
assert.ok(isCollection(text) && !isCollection(JSON.stringify(hw)));
// Keine Texte, Schlüssel oder Geräte-Werte in der Datei; boxScale nur bei eigener Schrift
assert.ok(!/privat|geheim|lastBackup|evil/.test(text));
assert.equal(coll.profiles[0].settings.boxScale, 0.8);
assert.equal(coll.profiles[1].settings.boxScale, undefined);
assert.equal(coll.profiles[1].handwriting, null, 'mitbenutzte Schrift nur einmal in der Datei');

// Rücklesen
const back = parseCollection(text);
assert.equal(back.length, 2);
assert.deepEqual(back[0].handwriting.glyphs.a[0], hw.glyphs.a[0]);
assert.deepEqual(back[0].settings.styles, { ordentlich: { weight: 120 } });
assert.equal(back[1].from, 0);

// Kaputte oder bösartige Dateien werden abgelehnt
const bad = mut => { const c = structuredClone(coll); mut(c); return () => parseCollection(JSON.stringify(c)); };
assert.throws(bad(c => { c.profiles[1].from = 1; }), /verweist/);
assert.throws(bad(c => { c.profiles[1].from = 5; }), /verweist/);
assert.throws(bad(c => { c.profiles[0].handwriting.glyphs.a[0] = [['x']]; }), /Schrift von „Meine Schrift“/);
assert.throws(bad(c => { c.profiles = []; }), /keine Profile/);
assert.throws(() => parseCollection('{'), /JSON/);
assert.throws(bad(c => { c.format = 'anders'; }), /keine Handschrift-Sammlung/);
// Verkettung (A benutzt B, B benutzt C) gibt es nicht
assert.throws(bad(c => { c.profiles.push({ name: 'X', from: 1, settings: {}, handwriting: null }); }), /verweist/);

// Namen werden durchnummeriert statt überschrieben
assert.equal(uniqueName('Oma', ['Oma', 'Oma (2)']), 'Oma (3)');
assert.equal(uniqueName('Neu', ['Oma']), 'Neu');
assert.deepEqual(cleanSettings({ xHeight: 3, styles: 'kaputt' }, false), { xHeight: 3 });
console.log('OK – Sammlung: Backup und Teilen');

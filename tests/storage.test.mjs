// Selbsttest für Profile und Einstellungen: node tests/storage.test.mjs
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k),
};
// Kleiner IndexedDB-Ersatz (nur get/put/delete im Speicher)
const idb = new Map();
const op = (t, fn) => { const req = {}; queueMicrotask(() => { req.result = fn(); t.oncomplete?.(); }); return req; };
const db = { transaction() {
  const t = {};
  const store = { get: k => op(t, () => idb.get(k)), put: (v, k) => op(t, () => idb.set(k, v)), delete: k => op(t, () => idb.delete(k)) };
  t.objectStore = () => store;
  return t;
} };
globalThis.indexedDB = { open() { const req = {}; queueMicrotask(() => { req.result = db; req.onsuccess?.(); }); return req; } };
idb.set('profile', { format: 'handschrift-profil', version: 1, customPairs: [], glyphs: { a: [[], [], []] } });

// Bestehende Daten von vor den Profilen
mem.set('settings', JSON.stringify({ text: 'Hallo', chaos: 30, boxScale: 0.8, lastBackup: 5, ink: 'rot' }));
const S = await import('../js/storage.js');

// Ohne Profil-Liste: ein Profil „Meine Schrift“ mit den alten Einstellungen
assert.equal(S.activeProfile().name, 'Meine Schrift');
assert.equal(S.getSettings().chaos, 30);

// Zweites Profil mit der Schrift von p1: eigene Stil-Werte, gemeinsamer Text, Schrift-Werte vom Besitzer
const p2 = S.createProfile({ name: 'Schnell', from: 'p1' });
S.seedSettings(p2, { style: 'unordentlich' });
S.setActiveProfile(p2);
assert.equal(S.glyphOwner().id, 'p1');
let s = S.getSettings();
assert.equal(s.text, 'Hallo', 'Text gilt für alle Profile');
assert.equal(s.boxScale, 0.8, 'Kästchengröße gehört zur Schrift');
assert.equal(s.style, 'unordentlich');
assert.equal(s.chaos, undefined, 'Stil-Werte von p1 gelten nicht');
assert.equal(s.ink, undefined);
S.setSetting('ink', 'schwarz');
S.setSetting('text', 'Neu');
S.setSetting('lastBackup', 9);
S.setActiveProfile('p1');
s = S.getSettings();
assert.equal(s.ink, 'rot', 'Tinte je Profil');
assert.equal(s.text, 'Neu', 'Text gemeinsam');
assert.equal(s.lastBackup, 9, 'Backup-Datum gehört zur Schrift');

// Profil mit eigener Schrift ist sein eigener Besitzer, hat eigene Schrift-Werte
const p3 = S.createProfile({ name: 'Oma', from: null });
S.setActiveProfile(p3);
assert.equal(S.glyphOwner().id, p3);
assert.equal(S.getSettings().boxScale, undefined);

// Umbenennen; p1 kann nicht gelöscht werden, solange „Schnell“ seine Schrift benutzt; das letzte nie
S.renameProfile(p2, 'Schnell mitgeschrieben');
assert.ok(S.profilesMeta().list.some(p => p.name === 'Schnell mitgeschrieben'));
assert.match(await S.deleteProfile('p1'), /noch von „Schnell mitgeschrieben“ benutzt/);
S.setActiveProfile(p2);
assert.equal(await S.deleteProfile(p2), null, 'verknüpftes Profil löschen (ohne eigene Schrift)');
assert.equal(S.activeProfile().id, 'p1', 'nach dem Löschen des aktiven Profils ist das erste aktiv');
assert.equal(mem.has('settings:' + p2), false, 'Einstellungen mit gelöscht');
// Erstes Profil löschen: seine Stil-Werte gehen, die Geräte-Werte (Text) bleiben
S.setActiveProfile(p3);
assert.equal(await S.deleteProfile('p1'), null);
assert.equal(S.getSettings().text, 'Neu', 'Text überlebt');
assert.equal(JSON.parse(mem.get('settings')).ink, undefined, 'Stil von p1 weg');
assert.equal(idb.has('profile'), false, 'Schrift von p1 gelöscht');
assert.ok((await S.loadGlyphs(p3)).glyphs, 'leeres Profil für neue Schrift');
console.log(`OK – Profile: ${S.profilesMeta().list.map(p => p.name).join(', ')}`);

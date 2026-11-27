// Selbsttest für Handschriften und Einstellungen: node tests/storage.test.mjs
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
const glyphs = ch => ({ format: 'handschrift-profil', version: 1, customPairs: [], glyphs: { [ch]: [[[[0, 0, 0.5, 0]]]] } });
idb.set('profile', glyphs('a'));

// Alte Daten (v1): p1 mit eigenem Aussehen, „Schnell“ benutzt die Schrift von p1, „Lena“ ist mitgeliefert und gerade gewählt
mem.set('settings', JSON.stringify({ text: 'Hallo', ink: 'rot', boxScale: 0.8, lastBackup: 5 }));
mem.set('settings:px', JSON.stringify({ style: 'unordentlich' }));
mem.set('settings:pl', JSON.stringify({ ink: 'blau', paper: 'kariert', lastBackup: 9 }));
mem.set('profiles', JSON.stringify({ active: 'pl', list: [
  { id: 'p1', name: 'Meine Schrift', from: null },
  { id: 'px', name: 'Schnell', from: 'p1' },
  { id: 'pl', name: 'Lena · sauber', from: null, demo: true, builtin: 'uji-w18' },
] }));
const S = await import('../js/storage.js');

// Umzug: verknüpfte Profile entfallen, Aussehen der gewählten Schrift gilt für alle, eigene Handschrift wird aufgenommen
let m = S.profilesMeta();
assert.equal(m.v, 2);
assert.deepEqual(m.list.map(p => p.name), ['Meine Schrift', 'Lena · sauber']);
assert.equal(S.activeProfile().id, 'pl');
assert.equal(S.recProfile().id, 'p1', 'mitgelieferte Schrift wird nie aufgenommen');
assert.equal(mem.has('settings:px'), false, 'Einstellungen des verknüpften Profils entfernt');
let s = S.getSettings();
assert.equal(s.ink, 'blau', 'Aussehen der zuletzt gewählten Schrift');
assert.equal(s.paper, 'kariert');
assert.equal(s.text, 'Hallo', 'Text bleibt');
assert.equal(s.boxScale, 0.8, 'Kästchengröße der aufgenommenen Handschrift');
assert.equal(s.lastBackup, 9, 'jüngstes Sicherungsdatum');

// Aussehen gilt für alle Schriften, Aufnahme-Werte gehören zur aufgenommenen Handschrift
const oma = S.createProfile({ name: 'Oma' });
assert.equal(S.recProfile().id, 'p1', 'neue Handschrift ändert die Aufnahme nicht von selbst');
S.setRecProfile(oma);
S.setActiveProfile('p1');
s = S.getSettings();
assert.equal(s.ink, 'blau', 'Wechsel der Schrift lässt das Aussehen gleich');
assert.equal(s.boxScale, undefined, 'Oma hat noch keine eigene Kästchengröße');
S.setSetting('boxScale', 1.2);
S.setSetting('ink', 'schwarz');
S.setRecProfile('p1');
assert.equal(S.getSettings().boxScale, 0.8);
assert.equal(S.getSettings().ink, 'schwarz');
S.setRecProfile('pl');
assert.equal(S.recProfile().id, 'p1', 'mitgelieferte Schrift lässt sich nicht als Aufnahme wählen');

// Geladene Objekte speichern in ihre eigene Handschrift, auch wenn eine andere gewählt ist
const a = await S.loadInto({}, 'p1'), b = await S.loadInto({ alt: 1 }, oma);
assert.ok(a.glyphs.a && !b.alt && !b.glyphs.a, 'neu befüllt');
b.glyphs.o = glyphs('o').glyphs.o;
await S.saveProfile(b);
assert.ok(idb.get('profile:' + oma).glyphs.o, 'in Omas Handschrift gespeichert');
const shared = S.shareInto({}, a);
assert.equal(shared.glyphs, a.glyphs, 'gemeinsame Buchstaben');
await S.saveProfile(shared);
assert.ok(idb.get('profile').glyphs.a);

// Löschen: nie die letzte eigene; gelöschte aktive/aufgenommene Handschrift wird ersetzt
S.setActiveProfile(oma);
S.setRecProfile(oma);
assert.equal(await S.deleteProfile(oma), null);
assert.equal(S.activeProfile().id, 'p1');
assert.equal(S.recProfile().id, 'p1');
assert.match(await S.deleteProfile('p1'), /letzte eigene Handschrift/);
assert.equal(await S.deleteProfile('pl'), null, 'mitgelieferte Schrift darf weg');
assert.equal(S.getSettings().ink, 'schwarz', 'Aussehen bleibt');
S.renameProfile('p1', 'Anna');
m = S.profilesMeta();
assert.deepEqual(m.list, [{ id: 'p1', name: 'Anna' }]);

// Neues Gerät ohne Daten: eine leere eigene Handschrift
mem.clear();
assert.deepEqual(S.profilesMeta(), { v: 2, active: 'p1', rec: 'p1', list: [{ id: 'p1', name: 'Meine Schrift' }] });
console.log('OK – Handschriften, Umzug, Aussehen und Aufnahme-Werte');

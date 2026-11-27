// Handschriften in IndexedDB, kleine Einstellungen in localStorage.
import { emptyProfile } from './profile.js';
import { info } from './dialog.js';

let dbPromise;
function db() {
  return dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('handschrift', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction('kv', mode);
    const req = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(req.result);
    t.onerror = t.onabort = () => reject(t.error);
  }));
}

/// ---------- Handschriften ----------
// Liste aller Handschriften: eigene (aufgenommen oder importiert) und mitgelieferte (demo, beim ersten Wählen geladen).
// active: die Schrift zum Schreiben; rec: die eigene Handschrift, die unter „Eigene Schrift“ aufgenommen wird.
// Die erste Handschrift „p1“ nutzt die alten Schlüssel ('profile', 'settings'), damit bestehende Daten bleiben.
const META_KEY = 'profiles';
const DEFAULT_META = () => ({ v: 2, active: 'p1', rec: 'p1', list: [{ id: 'p1', name: 'Meine Schrift' }] });
const dataKey = id => (id === 'p1' ? 'profile' : 'profile:' + id);
const settingsKey = id => (id === 'p1' ? 'settings' : 'settings:' + id);

export function profilesMeta() {
  let m;
  try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch {}
  if (!m?.list?.length) return DEFAULT_META();
  if (m.v !== 2) { m = migrate(m); saveMeta(m); }
  return m;
}
function saveMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}

// Früher (v1) hatte jedes Profil sein eigenes Aussehen, und Profile konnten die Schrift eines anderen benutzen (from).
// Jetzt: das Aussehen der zuletzt gewählten Schrift gilt für alle, Profile ohne eigene Schrift entfallen.
function migrate(m) {
  const active = m.list.find(p => p.id === m.active) || m.list[0];
  if (active.id !== 'p1') {
    const look = Object.entries(read(settingsKey(active.id))).filter(([k]) => !HANDWRITING.has(k));
    if (look.length) write('settings', { ...read('settings'), ...Object.fromEntries(look) });
  }
  const backups = m.list.map(p => read(settingsKey(p.id)).lastBackup).filter(Number.isFinite);
  if (backups.length) write('settings', { ...read('settings'), lastBackup: Math.max(...backups) });
  for (const p of m.list) if (p.from) try { localStorage.removeItem(settingsKey(p.id)); } catch {}
  const list = m.list.filter(p => !p.from).map(({ from, ...p }) => p);
  const has = id => list.some(p => p.id === id);
  const ownId = list.find(p => !p.demo)?.id || null;
  const nextActive = active.from && has(active.from) ? active.from : has(active.id) ? active.id : list[0]?.id;
  return { v: 2, active: nextActive, rec: ownId, list };
}

export const activeProfile = (m = profilesMeta()) => m.list.find(p => p.id === m.active) || m.list[0];
// Die eigene Handschrift, die gerade aufgenommen wird (nie eine mitgelieferte)
export const recProfile = (m = profilesMeta()) => m.list.find(p => p.id === m.rec && !p.demo) || m.list.find(p => !p.demo) || null;
export const ownProfiles = (m = profilesMeta()) => m.list.filter(p => !p.demo);

export function createProfile({ name, demo = false, builtin = null }) {
  const m = profilesMeta();
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // demo: mitgelieferte Schrift; builtin: Kennung der mitgelieferten Datei
  m.list.push(demo ? { id, name, demo: true, ...(builtin ? { builtin } : {}) } : { id, name });
  if (!demo && !recProfile(m)) m.rec = id;
  saveMeta(m);
  return id;
}
export function renameProfile(id, name) {
  const m = profilesMeta();
  const p = m.list.find(q => q.id === id);
  if (p) { p.name = name; saveMeta(m); }
}
export function setActiveProfile(id) {
  const m = profilesMeta();
  if (m.list.some(p => p.id === id)) { m.active = id; saveMeta(m); }
}
export function setRecProfile(id) {
  const m = profilesMeta();
  if (m.list.some(p => p.id === id && !p.demo)) { m.rec = id; saveMeta(m); }
}
// Handschrift löschen, aber nie die letzte eigene (Fehlertext oder null)
export async function deleteProfile(id) {
  const m = profilesMeta();
  const p = m.list.find(q => q.id === id);
  if (!p) return null;
  if (!p.demo && ownProfiles(m).length < 2) return 'Die letzte eigene Handschrift kann nicht gelöscht werden.';
  await tx('readwrite', s => s.delete(dataKey(id)));
  try {
    // Unter 'settings' liegt auch das Aussehen für alle Schriften: dort nur die Aufnahme-Werte von p1 entfernen
    if (id === 'p1') write('settings', Object.fromEntries(Object.entries(read('settings')).filter(([k]) => !HANDWRITING.has(k))));
    else localStorage.removeItem(settingsKey(id));
  } catch {}
  m.list = m.list.filter(q => q.id !== id);
  if (m.rec === id) m.rec = ownProfiles(m)[0]?.id || null;
  if (m.active === id) m.active = m.rec || m.list[0].id;
  saveMeta(m);
  return null;
}

// Geladene Schrift-Objekte merken sich, zu welcher Handschrift sie gehören (für saveProfile).
// Die Bereiche behalten ihr Objekt; beim Wechsel wird es nur neu befüllt.
const owners = new WeakMap();
const refill = (target, data) => { for (const k of Object.keys(target)) delete target[k]; return Object.assign(target, data); };
export async function loadInto(target, id) {
  refill(target, (await tx('readonly', s => s.get(dataKey(id)))) || emptyProfile());
  owners.set(target, id);
  return target;
}
// Dieselbe Handschrift in zwei Bereichen (Schreiben und Aufnahme): gemeinsame Buchstaben, Änderungen sofort sichtbar
export function shareInto(target, source) {
  refill(target, source);
  owners.set(target, owners.get(source));
  return target;
}

// Fehler beim Speichern sichtbar machen, sonst geht Aufgenommenes unbemerkt verloren.
export function saveProfile(profile) {
  const id = owners.get(profile) || recProfile()?.id || 'p1';
  return tx('readwrite', s => s.put(profile, dataKey(id))).catch(err => {
    info('Speichern fehlgeschlagen: ' + err.message + '\nBitte ein Backup exportieren.');
    throw err;
  });
}

// ---------- Einstellungen ----------
// Aussehen (Stil, Tinte, Papier, Stift …) und Geräte-Werte (Text …) gelten für alle Schriften und liegen unter 'settings'.
// Was zur Aufnahme einer Handschrift gehört, liegt bei der aufgenommenen Handschrift.
const HANDWRITING = new Set(['boxScale', 'aufnahmeChar', 'textPage']);
const read = key => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const targetKey = key => (HANDWRITING.has(key) ? settingsKey(recProfile()?.id || 'p1') : 'settings');

export function getSettings() {
  const out = read('settings'), own = read(settingsKey(recProfile()?.id || 'p1'));
  for (const k of HANDWRITING) if (k in own) out[k] = own[k]; else delete out[k];
  return out;
}
export function setSetting(key, value) {
  const k = targetKey(key), s = read(k);
  s[key] = value;
  write(k, s);
}
// Werte einer bestimmten Handschrift vorbelegen (z. B. Kästchengröße beim Import); 'p1' = auch das gemeinsame Aussehen
export function seedSettings(id, values) {
  write(settingsKey(id), { ...read(settingsKey(id)), ...values });
}

// Beliebige Werte (z. B. das Arbeitsblatt mit seinen Bildern) in IndexedDB.
export const loadKey = key => tx('readonly', s => s.get(key));
export const saveKey = (key, value) => tx('readwrite', s => s.put(value, key));
export const deleteKey = key => tx('readwrite', s => s.delete(key));

// Gespeicherte Werte einer Handschrift (z. B. Kästchengröße fürs Teilen)
export const profileSettings = id => read(settingsKey(id));

// Schrift einer bestimmten Handschrift lesen/schreiben (Sicherung, Teilen, Import, Vorschau in der Auswahl)
export const loadGlyphs = async id => (await tx('readonly', s => s.get(dataKey(id)))) || emptyProfile();
export const saveGlyphs = (id, data) => tx('readwrite', s => s.put(data, dataKey(id)));

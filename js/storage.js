// Profil in IndexedDB, kleine Einstellungen in localStorage.
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

// ---------- Profile ----------
// Mehrere benannte Profile. Jedes hat eigene Einstellungen (Stil, Tinte, Papier …) und entweder eine eigene
// Handschrift oder benutzt die Handschrift eines anderen Profils (from), z. B. um sie unordentlicher zu setzen.
// Das erste Profil „p1“ nutzt die alten Schlüssel ('profile', 'settings'), damit bestehende Daten bleiben.
const META_KEY = 'profiles';
const DEFAULT_META = () => ({ active: 'p1', list: [{ id: 'p1', name: 'Meine Schrift', from: null }] });

export function profilesMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY));
    if (m?.list?.length) return m;
  } catch {}
  return DEFAULT_META();
}
function saveMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}
export const activeProfile = (m = profilesMeta()) => m.list.find(p => p.id === m.active) || m.list[0];
// Profil, dessen Handschrift benutzt wird
export const glyphOwner = (p = activeProfile(), m = profilesMeta()) => (p.from && m.list.find(q => q.id === p.from)) || p;
const dataKey = id => (id === 'p1' ? 'profile' : 'profile:' + id);
const settingsKey = id => (id === 'p1' ? 'settings' : 'settings:' + id);

export function createProfile({ name, from = null }) {
  const m = profilesMeta();
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  m.list.push({ id, name, from });
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
// Löschen: nicht das letzte Profil und keins, dessen Schrift noch ein anderes benutzt (Fehlertext oder null).
export async function deleteProfile(id) {
  const m = profilesMeta();
  if (m.list.length < 2) return 'Das letzte Profil kann nicht gelöscht werden.';
  const users = m.list.filter(p => p.from === id);
  if (users.length) return `Die Schrift dieses Profils wird noch von „${users.map(p => p.name).join('“, „')}“ benutzt.`;
  const p = m.list.find(q => q.id === id);
  if (!p) return null;
  if (!p.from) await tx('readwrite', s => s.delete(dataKey(id)));
  try {
    // Der Speicher von p1 enthält auch die Geräte-Werte (Text, Testmodus …): die bleiben
    if (id === 'p1') {
      const s = read(settingsKey('p1'));
      localStorage.setItem(settingsKey('p1'), JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => DEVICE.has(k)))));
    } else localStorage.removeItem(settingsKey(id));
  } catch {}
  m.list = m.list.filter(q => q.id !== id);
  if (m.active === id) m.active = m.list[0].id;
  saveMeta(m);
  return null;
}

export async function loadProfile() {
  return (await tx('readonly', s => s.get(dataKey(glyphOwner().id)))) || emptyProfile();
}

// Fehler beim Speichern sichtbar machen, sonst geht Aufgenommenes unbemerkt verloren.
export function saveProfile(profile) {
  return tx('readwrite', s => s.put(profile, dataKey(glyphOwner().id))).catch(err => {
    info('Speichern fehlgeschlagen: ' + err.message + '\nBitte ein Backup exportieren.');
    throw err;
  });
}

// ---------- Einstellungen ----------
// Gerät: gelten für alle Profile. Schrift: gehören zur Handschrift (beim Profil, dem sie gehört). Sonst: je Profil.
const DEVICE = new Set(['text', 'seed', 'exportPaper', 'allowNonPen', 'aufnahmeMode']);
const HANDWRITING = new Set(['lastBackup', 'boxScale', 'aufnahmeChar', 'textPage']);
const read = key => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };
const targetKey = key => settingsKey(DEVICE.has(key) ? 'p1' : HANDWRITING.has(key) ? glyphOwner().id : activeProfile().id);

export function getSettings() {
  const out = read(settingsKey(activeProfile().id));
  const device = read(settingsKey('p1')), own = read(settingsKey(glyphOwner().id));
  for (const k of DEVICE) if (k in device) out[k] = device[k]; else delete out[k];
  for (const k of HANDWRITING) if (k in own) out[k] = own[k]; else delete out[k];
  return out;
}
export function setSetting(key, value) {
  const k = targetKey(key), s = read(k);
  s[key] = value;
  try { localStorage.setItem(k, JSON.stringify(s)); } catch {}
}
// Einstellungen eines anderen Profils vorbelegen (beim Anlegen)
export function seedSettings(id, values) {
  try { localStorage.setItem(settingsKey(id), JSON.stringify({ ...read(settingsKey(id)), ...values })); } catch {}
}

// Beliebige Werte (z. B. das Arbeitsblatt mit seinen Bildern) in IndexedDB.
export const loadKey = key => tx('readonly', s => s.get(key));
export const saveKey = (key, value) => tx('readwrite', s => s.put(value, key));
export const deleteKey = key => tx('readwrite', s => s.delete(key));

// Eigene Einstellungen eines (nicht unbedingt aktiven) Profils, z. B. um seine Stil-Vorlage anzuzeigen
export const profileSettings = id => read(settingsKey(id));

// Schrift eines bestimmten Profils lesen/schreiben (für Sammlungen: Backup aller Profile, Teilen, Import)
export const loadGlyphs = async id => (await tx('readonly', s => s.get(dataKey(id)))) || emptyProfile();
export const saveGlyphs = (id, data) => tx('readwrite', s => s.put(data, dataKey(id)));

// Profil in IndexedDB, kleine Einstellungen in localStorage.
import { emptyProfile } from './profile.js';

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

export async function loadProfile() {
  return (await tx('readonly', s => s.get('profile'))) || emptyProfile();
}

// Fehler beim Speichern sichtbar machen, sonst geht Aufgenommenes unbemerkt verloren.
export function saveProfile(profile) {
  return tx('readwrite', s => s.put(profile, 'profile')).catch(err => {
    alert('Speichern fehlgeschlagen: ' + err.message + '\nBitte ein Backup exportieren.');
    throw err;
  });
}

const SETTINGS_KEY = 'settings';
export function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
export function setSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// Beliebige Werte (z. B. das Arbeitsblatt mit seinen Bildern) in IndexedDB.
export const loadKey = key => tx('readonly', s => s.get(key));
export const saveKey = (key, value) => tx('readwrite', s => s.put(value, key));
export const deleteKey = key => tx('readwrite', s => s.delete(key));

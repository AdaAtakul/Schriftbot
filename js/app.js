import { loadProfile } from './storage.js';
import { initAufnahme } from './aufnahme.js';
import { initTextAufnahme } from './textaufnahme.js';
import { initProfil } from './profil.js';
import { initSchreiben } from './schreiben.js';

// Navigation zwischen den Modulen; letzter Tab wird gemerkt.
const tabs = document.querySelectorAll('.tabs [data-view]');

function showView(name) {
  for (const tab of tabs) {
    const active = tab.dataset.view === name;
    tab.setAttribute('aria-selected', active);
    document.getElementById('view-' + tab.dataset.view).hidden = !active;
  }
  try { localStorage.setItem('lastView', name); } catch {}
}

for (const tab of tabs) tab.addEventListener('click', () => showView(tab.dataset.view));

let last = null;
try { last = localStorage.getItem('lastView'); } catch {}
if (last && document.getElementById('view-' + last)) showView(last);

let profile;
try {
  profile = await loadProfile();
} catch (err) {
  alert('Das Handschrift-Profil konnte nicht geladen werden: ' + err.message +
    '\n\nTipp: App schließen und neu öffnen. Falls das nicht hilft, im Profil-Tab ein Backup importieren.');
  throw err;
}
const aufnahme = initAufnahme(profile);
initTextAufnahme(profile, aufnahme.refresh);
initSchreiben(profile); // rendert neu, sobald der Tab sichtbar wird
initProfil(profile);

// PWA: Service Worker für Offline-Betrieb.
const offlineStatus = document.getElementById('status-offline');
if ('serviceWorker' in navigator) {
  // Neue Version installiert → Hinweis statt automatischem Neuladen (könnte mitten im Schreiben stören).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) document.getElementById('update-banner').hidden = false;
  });
  document.getElementById('update-reload').addEventListener('click', () => location.reload());

  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { offlineStatus.textContent = '✅ Offline-Modus bereit'; })
    .catch(err => { offlineStatus.textContent = '⚠️ Offline-Modus nicht verfügbar: ' + err.message; });
} else {
  offlineStatus.textContent = '⚠️ Dieser Browser unterstützt keinen Offline-Modus.';
}

// Safari darf Website-Daten sonst nach längerer Nichtnutzung löschen.
const storageStatus = document.getElementById('status-storage');
if (navigator.storage?.persist) {
  navigator.storage.persist().then(ok => {
    storageStatus.textContent = ok
      ? '✅ Dauerhafter Speicher aktiv'
      : 'ℹ️ Dauerhafter Speicher nicht gewährt – bitte regelmäßig ein Backup exportieren.';
  });
}

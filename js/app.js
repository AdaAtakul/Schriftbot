import { loadProfile, saveProfile } from './storage.js';
import { alignAll } from './profile.js';
import { initAufnahme } from './aufnahme.js';
import { initTextAufnahme } from './textaufnahme.js';
import { initProfil } from './profil.js';
import { initSchreiben } from './schreiben.js';
import { initBlatt } from './blattui.js';
import { initProfilwahl } from './profilwahl.js';
import { info } from './dialog.js';
import { initKiTab } from './kiui.js';

// Läuft die App als Artifact auf claude.ai? Dort gibt es Claude (KI-Tab), aber keinen Service Worker.
const inClaude = typeof window.claude?.use === 'function';

// Navigation zwischen den Modulen; letzter Tab wird gemerkt.
const tabs = document.querySelectorAll('.tabs [data-view]');

let profile;

function showView(name) {
  // Beim Tabwechsel frisch geschriebene Zeichen ausrichten, damit „Schreiben“ sie schon gerade sieht.
  if (profile && alignAll(profile)) saveProfile(profile);
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

try {
  profile = await loadProfile();
  if (alignAll(profile)) saveProfile(profile); // ältere Aufnahmen nachträglich ausrichten
} catch (err) {
  info('Das Handschrift-Profil konnte nicht geladen werden: ' + err.message +
    '\n\nTipp: App schließen und neu öffnen. Falls das nicht hilft, im Profil-Tab ein Backup importieren.');
  throw err;
}
let schreiben;
const aufnahme = initAufnahme(profile, () => schreiben.sync()); // Schriftgröße im Schreiben-Tab nachziehen
initTextAufnahme(profile, aufnahme.refresh);
schreiben = initSchreiben(profile, aufnahme.refresh); // rendert neu, sobald der Tab sichtbar wird
initProfil(profile);
// Früher gab es eine KI mit API-Schlüssel: einen gespeicherten Schlüssel vom Gerät löschen.
try { localStorage.removeItem('ki'); } catch {}
const blatt = initBlatt(profile);
initProfilwahl();
initKiTab(profile, { schreiben, blatt, goTo: showView });

// PWA: Service Worker für Offline-Betrieb.
const offlineStatus = document.getElementById('status-offline');
if (inClaude) {
  offlineStatus.textContent = '✨ Läuft auf claude.ai: KI-Tab aktiv, braucht Internet. Daten liegen getrennt von der GitHub-Version.';
} else if ('serviceWorker' in navigator) {
  // Neue Version installiert → Hinweis statt automatischem Neuladen (könnte mitten im Schreiben stören).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) document.getElementById('update-banner').hidden = false;
  });
  document.getElementById('update-reload').addEventListener('click', () => location.reload());

  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => caches.keys())
    .then(keys => {
      // Version anzeigen, damit man nach einem Update prüfen kann, ob es angekommen ist.
      const v = Math.max(...keys.map(k => +(k.match(/^handschrift-v(\d+)$/)?.[1] || 0)));
      offlineStatus.textContent = `✅ Offline-Modus bereit · Version v${v}`;
    })
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

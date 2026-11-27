// Profile: benennen, anlegen (eigene Schrift oder die eines anderen Profils), wechseln, löschen.
// Wechseln lädt die App neu, damit alle Tabs sauber mit der neuen Schrift starten.
import {
  profilesMeta, activeProfile, createProfile, renameProfile, setActiveProfile, deleteProfile, seedSettings, profileSettings,
} from './storage.js';
import { PRESETS, DEFAULT_STYLE } from './stil.js';
import { ask, info as showInfo, askText } from './dialog.js';
import { BUILTIN, useBuiltin, renameOldBuiltins } from './schriften.js';

export function initProfilwahl(onSwitch = null) {
  const $ = id => document.getElementById(id);
  const list = $('profile-list'), switcher = $('profile-switch');
  const fromSel = $('profile-from'), styleSel = $('profile-style'), nameInput = $('profile-name');

  // Wechseln ohne Neuladen (schnell); nur ohne Rückruf wird die Seite neu geladen
  const switchTo = async id => {
    if (!onSwitch) { setActiveProfile(id); location.reload(); return; }
    await onSwitch(id);
    render();
  };
  const styleLabel = id => PRESETS[profileSettings(id).style]?.label || PRESETS[DEFAULT_STYLE].label;

  renameOldBuiltins();
  function render() {
    const m = profilesMeta(), active = activeProfile(m);
    const nameOf = id => m.list.find(p => p.id === id)?.name || '?';

    switcher.replaceChildren(...m.list.map(p => new Option(p.name, p.id, false, p.id === active.id)));
    // Mitgelieferte Handschriften, die noch nicht als Profil angelegt sind
    const fresh = BUILTIN.filter(b => !m.list.some(p => p.builtin === b.id));
    if (fresh.length) {
      const g = document.createElement('optgroup');
      g.label = 'Mitgelieferte Schriften';
      g.append(...fresh.map(b => new Option(b.name, '__builtin:' + b.id)));
      switcher.append(g);
    }
    switcher.add(new Option('Schriften verwalten …', '__manage'));

    list.replaceChildren(...m.list.map(p => {
      const li = document.createElement('li');
      li.className = 'profile-item' + (p.id === active.id ? ' active' : '');
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = p.name;
      const meta = document.createElement('span');
      meta.className = 'hint small';
      meta.textContent = `${p.from ? `Schrift von „${nameOf(p.from)}“` : 'Eigene Schrift'} · Stil: ${styleLabel(p.id)}`;
      info.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'profile-actions';
      const button = (text, fn, cls) => {
        const b = document.createElement('button');
        b.textContent = text;
        if (cls) b.className = cls;
        b.addEventListener('click', fn);
        actions.append(b);
      };
      if (p.id === active.id) {
        const badge = document.createElement('span');
        badge.className = 'badge-active';
        badge.textContent = 'Aktiv';
        actions.append(badge);
      } else button('Wechseln', () => switchTo(p.id), 'primary');
      button('Umbenennen', async () => {
        const n = (await askText('Neuer Name für die Schrift', p.name))?.trim();
        if (n) { renameProfile(p.id, n); render(); }
      });
      button('Löschen', async () => {
        if (!await ask(`Schrift „${p.name}“ löschen?` + (p.from ? '' : '\nIhre aufgenommenen Buchstaben werden dabei gelöscht – vorher sichern!'), { ok: 'Löschen', danger: true })) return;
        const err = await deleteProfile(p.id);
        if (err) return showInfo(err);
        if (p.id === active.id) location.reload(); else render();
      }, 'danger');
      li.append(info, actions);
      return li;
    }));

    fromSel.replaceChildren(
      new Option('Neue eigene Schrift (neu aufnehmen)', ''),
      ...m.list.filter(p => !p.from).map(p => new Option(`Schrift von „${p.name}“ benutzen`, p.id)),
    );
    fromSel.value = active.from || active.id; // naheliegend: die aktuelle Schrift mit anderem Stil
  }

  for (const [key, p] of Object.entries(PRESETS)) styleSel.add(new Option(p.label, key));
  styleSel.value = 'unordentlich';

  $('profile-new').addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    const id = createProfile({ name, from: fromSel.value || null });
    // Papier, Tinte und Größe vom aktuellen Profil übernehmen, Stil aus der Auswahl
    const cur = profileSettings(activeProfile().id), keep = {};
    // Schriftgröße nur bei gleicher Schrift (sie ist an die Kästchengröße der Aufnahme gekoppelt)
    const keys = ['paper', 'paperColor', 'ink', 'inkHue', 'lineHeight', 'margin', ...(fromSel.value ? ['xHeight'] : [])];
    for (const k of keys) if (k in cur) keep[k] = cur[k];
    seedSettings(id, { ...keep, style: styleSel.value, styles: {} });
    if (!fromSel.value) await showInfo(`„${name}“ ist angelegt. Nimm sie jetzt unter „Aufnehmen“ auf – nach etwa drei Minuten ist sie nutzbar.`);
    switchTo(id);
  });

  switcher.addEventListener('change', async () => {
    if (switcher.value.startsWith('__builtin:')) {
      const id = switcher.value.slice(10);
      switcher.disabled = true;
      try { await switchTo(await useBuiltin(id)); switcher.disabled = false; } catch (err) {
        switcher.disabled = false;
        switcher.value = activeProfile().id;
        showInfo(err.message);
      }
      return;
    }
    if (switcher.value === '__manage') {
      switcher.value = activeProfile().id;
      document.querySelector('.tabs [data-view="profil"]').click();
      $('profiles-card').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    switchTo(switcher.value);
  });

  render();
}

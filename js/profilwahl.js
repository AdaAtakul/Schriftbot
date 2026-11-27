// Schrift-Auswahl: Galerie in der Leiste (eigene und mitgelieferte Handschriften mit Schriftprobe)
// und unter „Eigene Schrift“ die Wahl, welche eigene Handschrift aufgenommen wird (umbenennen, löschen, neu).
import { profilesMeta, activeProfile, recProfile, ownProfiles, createProfile, renameProfile, deleteProfile, loadGlyphs } from './storage.js';
import { progress } from './profile.js';
import { ask, info, askText } from './dialog.js';
import { BUILTIN, useBuiltin, renameOldBuiltins } from './schriften.js';
import { previewPath } from './vorschau.js';
import PREVIEWS from './vorschau-daten.js';

const SVG = 'http://www.w3.org/2000/svg';
function sample(prev) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'font-sample');
  svg.setAttribute('aria-hidden', 'true');
  if (prev) {
    svg.setAttribute('viewBox', prev.viewBox);
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', prev.d);
    svg.append(path);
  }
  return svg;
}
const percent = pr => (pr.done >= pr.total ? 'fertig' : `${Math.round(pr.done / pr.total * 100)} %`);

// chooseFont(id): mit dieser Schrift schreiben. chooseRec(id): diese eigene Handschrift aufnehmen (öffnet „Eigene Schrift“).
export function initProfilwahl({ chooseFont, chooseRec }) {
  const $ = id => document.getElementById(id);
  renameOldBuiltins();
  const pop = $('pop-font'), btn = $('font-btn');
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

  function card({ name, meta, prev, current, add, onPick }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-card' + (add ? ' add' : '');
    if (current) b.setAttribute('aria-current', 'true');
    if (add) {
      b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>';
    } else b.append(sample(prev));
    const n = document.createElement('span');
    n.className = 'font-card-name';
    n.textContent = name;
    b.append(n);
    if (meta) {
      const m = document.createElement('span');
      m.className = 'font-card-meta';
      m.textContent = meta;
      b.append(m);
    }
    b.addEventListener('click', () => onPick(b));
    return b;
  }

  async function newHandwriting() {
    const name = (await askText('Wie soll die neue Handschrift heißen?', '', { ok: 'Anlegen', placeholder: 'z. B. Papa' }))?.trim();
    if (name) chooseRec(createProfile({ name }));
  }

  // Galerie: erst beim Öffnen aufbauen (eigene Schriftproben werden live berechnet)
  async function renderGallery() {
    const m = profilesMeta(), active = activeProfile(m);
    const own = await Promise.all(ownProfiles(m).map(async p => ({ p, hw: await loadGlyphs(p.id) })));
    $('font-own').replaceChildren(...own.map(({ p, hw }) => {
      const pr = progress(hw), empty = pr.done === 0;
      return card({
        name: p.name, meta: empty ? 'Noch leer – aufnehmen' : percent(pr), prev: empty ? null : previewPath(hw), current: p.id === active.id,
        onPick: () => { close(); if (empty) chooseRec(p.id); else chooseFont(p.id); },
      });
    }), card({ name: 'Weitere aufnehmen', add: true, onPick: () => { close(); newHandwriting(); } }));

    const demo = m.list.find(p => p.demo && !p.builtin);
    const fonts = [
      ...(demo ? [{ name: demo.name, prev: PREVIEWS.demo, have: demo.id }] : []),
      ...BUILTIN.map(b => {
        const have = m.list.find(p => p.builtin === b.id);
        return { name: have?.name || b.name, prev: PREVIEWS[b.id], have: have?.id, builtin: b.id };
      }),
    ];
    $('font-builtin').replaceChildren(...fonts.map(f => card({
      name: f.name, prev: f.prev, current: f.have && f.have === active.id,
      onPick: async el => {
        el.disabled = true;
        el.classList.add('loading');
        try {
          await chooseFont(f.have || await useBuiltin(f.builtin));
          close();
        } catch (err) {
          info(err.message);
        } finally {
          el.disabled = false;
          el.classList.remove('loading');
        }
      },
    })));
  }
  // Nach dem Auf-/Zuklappen durch die Leiste (schreiben.js) aufbauen
  btn.addEventListener('click', () => setTimeout(() => { if (!pop.hidden) renderGallery(); }));

  // ---------- Eigene Schrift: welche Handschrift aufgenommen wird ----------
  const menu = $('rec-menu'), more = $('rec-more');
  const setMenu = open => { menu.hidden = !open; more.setAttribute('aria-expanded', String(open)); };
  document.addEventListener('click', e => {
    if (e.target.closest('#rec-more')) setMenu(menu.hidden);
    else if (!e.target.closest('#rec-menu') || e.target.closest('.menu-item')) setMenu(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); more.focus(); } });

  async function renderRec() {
    const m = profilesMeta(), rec = recProfile(m);
    const chips = await Promise.all(ownProfiles(m).map(async p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rec-chip';
      b.setAttribute('aria-pressed', String(p.id === rec?.id));
      b.textContent = p.name;
      const s = document.createElement('span');
      s.textContent = percent(progress(await loadGlyphs(p.id)));
      b.append(s);
      b.addEventListener('click', () => { if (p.id !== rec?.id) chooseRec(p.id); });
      return b;
    }));
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'rec-chip add';
    add.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>Neue Handschrift';
    add.addEventListener('click', newHandwriting);
    $('rec-list').replaceChildren(...chips, add);
  }

  $('rec-rename').addEventListener('click', async () => {
    const rec = recProfile();
    const name = (await askText('Neuer Name für die Handschrift', rec.name))?.trim();
    if (!name) return;
    renameProfile(rec.id, name);
    render();
  });
  $('rec-delete').addEventListener('click', async () => {
    const rec = recProfile();
    if (!await ask(`Handschrift „${rec.name}“ löschen?\nIhre aufgenommenen Buchstaben werden dabei gelöscht – vorher sichern!`, { ok: 'Löschen', danger: true })) return;
    const err = await deleteProfile(rec.id);
    if (err) return info(err);
    chooseRec(recProfile().id, { force: true });
  });

  function render() {
    $('font-name').textContent = activeProfile().name;
    renderRec();
  }
  // Fortschritt frisch zeigen, sobald man zur Aufnahme wechselt
  $('tab-aufnahme').addEventListener('click', renderRec);
  render();
  return { render };
}

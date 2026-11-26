// Export als GoodNotes-Notizbuch (.goodnotes): jeder Strich wird ein echter Kugelschreiber-Strich,
// den man in GoodNotes radieren, mit dem Lasso auswählen, verschieben oder löschen kann.
// Das Format ist nicht offiziell dokumentiert. Nachgebaut nach goodnotes-codec (MIT,
// github.com/Taylor-Nilsen/goodnotes-codec, docs/FORMAT.md und Document.new), dessen Dateien GoodNotes importiert.
// shortcut: inoffizielles Format (Schema 24), ein GoodNotes-Update kann den Import brechen → dann PDF nehmen.
import { simplify } from './export.js';
import { PAPER_COLORS } from './paper.js';

const SCHEMA = 24, DJB2_EMPTY = 5381;
const UNITS_PER_MM = 72 / 25.4 * 11 / 6; // GoodNotes-Seiteneinheiten: PDF-Punkte × 11/6
const te = new TextEncoder();

// ---------- Protobuf: eine Nachricht ist eine Liste von [Feld, Drahttyp, Wert] ----------
const v = (n, x) => [n, 0, x], s = (n, x) => [n, 2, x], f = (n, x) => [n, 5, x], d = (n, x) => [n, 1, x];

function varint(n) {
  let x = BigInt(n);
  const out = [];
  do { const b = Number(x & 0x7fn); x >>= 7n; out.push(x ? b | 0x80 : b); } while (x);
  return out;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function encode(msg) {
  const parts = [];
  for (const [num, wt, val] of msg) {
    parts.push(Uint8Array.from(varint(num * 8 + wt)));
    if (wt === 0) parts.push(Uint8Array.from(varint(val)));
    else if (wt === 2) {
      const b = typeof val === 'string' ? te.encode(val) : val instanceof Uint8Array ? val : encode(val);
      parts.push(Uint8Array.from(varint(b.length)), b);
    } else {
      const b = new DataView(new ArrayBuffer(wt === 5 ? 4 : 8));
      wt === 5 ? b.setFloat32(0, val, true) : b.setFloat64(0, val, true);
      parts.push(new Uint8Array(b.buffer));
    }
  }
  return concat(parts);
}

const delimited = msgs => concat(msgs.flatMap(m => { const b = encode(m); return [Uint8Array.from(varint(b.length)), b]; }));

// ---------- Hilfswerte wie GoodNotes sie schreibt ----------
// randomUUID gibt es nur auf HTTPS-Seiten; sonst aus Zufallsbytes bauen (Version 4)
const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID().toUpperCase();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
const rand63 = () => { const [a, b] = crypto.getRandomValues(new Uint32Array(2)); return ((BigInt(a & 0x7fffffff) << 32n) | BigInt(b)) || 1n; };

// Die Striche einer Seite liegen unter notes/<Seiten-ID + 1>.
export function uuidPlus(u) {
  const hex = ((BigInt('0x' + u.replace(/-/g, '')) + 1n) % (1n << 128n)).toString(16).padStart(32, '0').toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Seitenreihenfolge: Schlüssel, die als ASCII sortiert werden ("40", "41", …).
const KEYS = '!-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~';
export function nextKey(a) {
  if (!a) return '40';
  const dg = [...a].map(c => Math.max(0, KEYS.indexOf(c)));
  for (let i = dg.length - 1; i >= 0; i--) {
    if (dg[i] < KEYS.length - 1) return dg.slice(0, i).map(k => KEYS[k]).join('') + KEYS[dg[i] + 1] + KEYS[1].repeat(dg.length - i - 1);
  }
  return a + KEYS[KEYS.length >> 1];
}

const stamp = (counter = 1) => [...(counter ? [v(1, counter)] : []), v(2, rand32())];
const lww = (value, counter = 0) => [
  ...(typeof value === 'string' ? [s(1, value)] : value ? [v(1, +value)] : []),
  s(2, stamp(counter)),
];
const point = (x, y) => [...(x ? [f(1, x)] : []), ...(y ? [f(2, y)] : [])];
const rgba = c => c.map((x, i) => [i + 1, 5, x]).filter(([, , x]) => x);
const hexColor = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);

// ---------- Strichgeometrie: komprimierter Blob ("bv41") mit Vorlage "tpl" ----------
const PSTROKE = 'vuA(v)A(S(uu))A(S(uuuu))vA(f)'; // Kugelschreiber: konstante Breite, Pfad aus move/quad

function strokeBlob(cmds, thickness) {
  const moves = cmds.filter(c => c.length === 2), quads = cmds.filter(c => c.length === 4);
  const schema = te.encode(PSTROKE + '\0');
  const size = 8 + schema.length + 2 + 4 + 4 + cmds.length * 2 + 4 + moves.length * 8 + 4 + quads.length * 16 + 2 + 4;
  const body = new DataView(new ArrayBuffer(size));
  let o = 0;
  const u8 = b => { new Uint8Array(body.buffer).set(b, o); o += b.length; };
  const u16 = x => { body.setUint16(o, x, true); o += 2; };
  const u32 = x => { body.setUint32(o, x, true); o += 4; };
  const f32 = x => { body.setFloat32(o, x, true); o += 4; };
  u8(te.encode('tpl\0')); u32(size); u8(schema);
  u16(2); f32(thickness);
  u32(cmds.length); for (const c of cmds) u16(c.length === 2 ? 0 : 1);
  u32(moves.length); for (const c of moves) c.forEach(f32);
  u32(quads.length); for (const c of quads) c.forEach(f32);
  u16(1); u32(0); // keine Breitenproben
  return bv41(new Uint8Array(body.buffer));
}

// LZ4-Blöcke nur aus Literalen: gültig und ohne Kompressor.
function bv41(raw) {
  const parts = [];
  for (let i = 0; i < Math.max(raw.length, 1); i += 32768) {
    const chunk = raw.subarray(i, i + 32768), n = chunk.length;
    const head = n < 15 ? [n << 4] : [0xf0, ...Array((n - 15) / 255 | 0).fill(0xff), (n - 15) % 255];
    const hdr = new DataView(new ArrayBuffer(12));
    new Uint8Array(hdr.buffer).set(te.encode('bv41'));
    hdr.setUint32(4, n, true);
    hdr.setUint32(8, head.length + n, true);
    parts.push(new Uint8Array(hdr.buffer), Uint8Array.from(head), chunk);
  }
  parts.push(te.encode('bv4$'));
  return concat(parts);
}

// Mittellinie eines Strichs (Glyph-Einheiten) → Pfad in Seiteneinheiten; glatt über Kurven durch die Mittelpunkte.
function strokePath(it, st) {
  const c = Math.cos(it.rot || 0), sn = Math.sin(it.rot || 0);
  let pts = simplify(st.map(([px, py]) => [it.x + (px * c - py * sn) * it.s, it.y + (px * sn + py * c) * it.s]))
    .map(([x, y]) => [x * UNITS_PER_MM, y * UNITS_PER_MM]);
  if (pts.length === 1) pts = [pts[0], [pts[0][0] + 0.2, pts[0][1]]]; // Punkt (i, ä) sichtbar halten
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const cmds = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) cmds.push([...pts[i], ...mid(pts[i], pts[i + 1])]);
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  cmds.push([...mid(prev, last), ...last]);
  return cmds;
}

// ---------- ZIP (unkomprimiert) ----------
const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = b => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };

export function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nm = te.encode(name), crc = crc32(data);
    const head = (sig, extra) => {
      const h = new DataView(new ArrayBuffer(extra ? 46 : 30));
      h.setUint32(0, sig, true);
      let o = 4;
      if (extra) { h.setUint16(o, 20, true); o += 2; }
      h.setUint16(o, 20, true); h.setUint16(o + 2, 0, true); h.setUint16(o + 4, 0, true); // Version, Flags, gespeichert
      h.setUint16(o + 6, 0, true); h.setUint16(o + 8, 0x21, true); // Zeit, Datum 1980-01-01
      h.setUint32(o + 10, crc, true); h.setUint32(o + 14, data.length, true); h.setUint32(o + 18, data.length, true);
      h.setUint16(o + 22, nm.length, true);
      if (extra) h.setUint32(42, offset, true);
      return new Uint8Array(h.buffer);
    };
    const local = head(0x04034b50, false);
    parts.push(local, nm, data);
    central.push(head(0x02014b50, true), nm);
    offset += local.length + nm.length + data.length;
  }
  const cd = concat(central), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cd.length, true); end.setUint32(16, offset, true);
  return concat([...parts, cd, new Uint8Array(end.buffer)]);
}

// ---------- Dokument ----------
// result: Layout-Ergebnis, o: Layout-Optionen (mm), color: '#rrggbb'.
// paperPdf: einseitiges PDF als Hintergrund aller Seiten, oder eine Liste mit einem PDF je Seite (Arbeitsblatt).
// Jede Seite zeigt Seite 1 ihres Anhangs (Ebenen-Feld 5), so wie goodnotes-codec Hintergründe ablegt.
export function buildGoodnotes(result, o, color, paperPdf, title) {
  const now = Date.now(), device = rand63();
  const did = uuid(), folder = uuid();
  const sizeOf = page => (page?.size || [o.pageW, o.pageH]).map(v => v * UNITS_PER_MM);
  const size = sizeOf(result.pages[0]);
  const ink = hexColor(color);
  const events = [];
  const tail = (body, versionField = 15) => [...body, d(10, now), s(11, uuid()), v(13, device), v(14, now), v(versionField, SCHEMA)];
  // Ereignis mit Zeitstempel, wie GoodNotes' eigenes Protokoll (Ziel-ID in Feld 1, Inhalt im Feld der Art)
  const event = (kind, target, body) => events.push([s(1, target), s(kind, [...body,
    d(10, now), s(11, uuid()), v(13, device), v(14, now + (rand32() & 255)), v(15, SCHEMA)])]);
  const notesEvents = (nid, version) => {
    event(105, nid, [v(1, 1), s(2, did), s(4, nid), ...(version ? [v(5, version)] : []), s(6, 'auto')]);
    events.push([s(1, nid), s(104, [s(1, did), s(2, nid), d(10, now), s(11, uuid()), ...(version ? [v(12, version)] : []),
      s(13, 'auto'), v(14, 1), s(15, uuid()), v(17, device), v(18, now), v(19, SCHEMA)])]);
    const upd = [s(1, nid), d(10, now), s(11, uuid()), v(13, device), v(14, now + (rand32() & 255)), v(15, SCHEMA), s(16, did)];
    events.push([s(1, nid), s(102, upd)]);
  };

  // Dokument
  events.push([s(1, did), s(30, [s(1, did), s(2, lww(title, 1)), s(3, lww(folder, 1)), s(6, lww(size[0] <= size[1] ? 'P' : 'L', 1)),
    s(7, lww(folder, 1)), s(9, 'auto'), d(10, now), s(11, uuid()), v(13, device), v(14, now), s(17, ''), s(18, ''),
    s(19, [s(2, stamp(1))]), v(20, SCHEMA)])]);
  // Papier als PDF-Anhang plus Papierebene; gibt die Ebenen-ID zurück
  const attachments = [];
  const addPaper = (pdf, size) => {
    const tid = uuid(), aid = uuid();
    attachments.push([aid, pdf]);
    events.push([s(1, aid), s(6, [s(1, aid), s(2, aid), v(5, pdf.length), s(6, did), d(10, now), s(11, uuid()),
      s(12, [v(1, 1), v(2, 1)]), v(14, device), v(15, now), v(16, SCHEMA)])]);
    event(105, aid, [s(2, did), s(3, aid)]);
    const mx = 44 * size[0] / 834.24, my = 58.6667 * size[1] / 1078.825;
    events.push([s(1, tid), s(2, [s(1, did), s(2, tid), s(4, aid), v(5, 1), v(6, 1), d(7, 29.33333396911621), s(8, point(...size)),
      d(10, now), s(11, uuid()), s(12, [d(1, 29.33333396911621), s(2, stamp(1))]), s(13, lww(true, 1)), v(15, device), v(16, now),
      s(17, lww(1, 1)), s(18, [s(1, [s(1, point(mx, my)), s(2, point(size[0] - 2 * mx, size[1] - 2 * my))]), f(2, 28.416668), f(3, 0.9166667), v(5, PAPER_COLORS[o.paperColor]?.dark ? 2 : 1)]),
      s(19, [s(2, stamp(1))]), v(21, SCHEMA)])]);
    return tid;
  };
  const papers = Array.isArray(paperPdf) ? paperPdf : null;
  const shared = papers ? null : addPaper(paperPdf, size); // eine Ebene für alle Seiten

  // Seiten
  let key = null, seq = 0, firstPage = null;
  const notes = [];
  for (const [pi, page] of result.pages.entries()) {
    const tid = shared || addPaper(papers[pi], sizeOf(page));
    const pid = uuid(), nid = uuidPlus(pid);
    key = nextKey(key);
    firstPage ??= pid;
    const canvas = [s(2, [s(1, rgba([0.8667, 0.8667, 0.8667, 1])), s(2, rgba([1, 1, 1, 1]))])];
    events.push([s(1, pid), s(54, [...tail([s(1, did), s(2, pid), s(3, lww(tid, 1)), s(4, lww(key, 1))]), s(17, [s(1, canvas), s(2, stamp(1))])])]);
    notesEvents(nid);
    const records = [];
    for (const it of page.items) {
      if (it.missing) continue; // fehlende Zeichen bleiben weg (beim Export schon gewarnt)
      for (const st of it.strokes) {
        if (!st.length) continue;
        const sid = uuid(), st0 = stamp();
        records.push(
          [s(1, sid), s(2, st0), v(8, device), v(9, ++seq), v(14, DJB2_EMPTY), v(16, SCHEMA)],
          [s(7, [s(1, sid), s(2, strokeBlob(strokePath(it, st), o.penSize * (it.ink || 1) * it.s * UNITS_PER_MM)), s(4, rgba(ink)), s(6, ''),
            s(7, [s(1, stamp())]), s(9, ''), s(15, st0), s(20, ''), v(21, SCHEMA)])],
        );
      }
    }
    notes.push([nid, records]);
  }
  events.push([s(1, did), s(10, tail([s(1, did), s(2, firstPage), s(3, `PagingViewServiceUpdater:${uuid()}`)]))]);
  for (const [nid, records] of notes) if (records.length) notesEvents(nid, rand63());

  return zip([
    ['schema.pb', encode([v(1, SCHEMA)])],
    ['document.info.pb', new Uint8Array()],
    ['index.notes.pb', delimited(notes.map(([nid]) => [s(1, nid), s(2, `notes/${nid}`)]))],
    ['index.attachments.pb', delimited(attachments.map(([aid]) => [s(1, aid), s(2, `attachments/${aid}`)]))],
    ['index.events.pb', delimited(events)],
    ...attachments.map(([aid, pdf]) => [`attachments/${aid}`, pdf]),
    ...notes.map(([nid, records]) => [`notes/${nid}`, delimited(records)]),
  ]);
}

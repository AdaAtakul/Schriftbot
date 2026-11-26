// Selbsttest für den GoodNotes-Export: node tests/goodnotes.test.mjs
// Liest die erzeugte Datei mit einem unabhängigen Mini-Leser zurück (ZIP, Protobuf, bv41/LZ4, tpl).
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { emptyProfile, variantsOf } from '../js/profile.js';
import { layout, DEFAULTS } from '../js/layout.js';
import { buildPdf } from '../js/export.js';
import { buildGoodnotes, uuidPlus, nextKey } from '../js/goodnotes.js';
import { PEN_SIZE } from '../js/ink.js';

globalThis.window = { jspdf: createRequire(import.meta.url)('../vendor/jspdf.umd.min.js') };

// ---------- Mini-Leser ----------
export function unzip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), files = new Map();
  let p = buf.length - 22;
  while (dv.getUint32(p, true) !== 0x06054b50) p--;
  let c = dv.getUint32(p + 16, true);
  for (let i = 0; i < dv.getUint16(p + 10, true); i++) {
    const method = dv.getUint16(c + 10, true), size = dv.getUint32(c + 20, true);
    const nlen = dv.getUint16(c + 28, true), xlen = dv.getUint16(c + 30, true), clen = dv.getUint16(c + 32, true);
    const name = Buffer.from(buf.subarray(c + 46, c + 46 + nlen)).toString();
    const off = dv.getUint32(c + 42, true);
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 0 ? raw : new Uint8Array(inflateRawSync(raw)));
    c += 46 + nlen + xlen + clen;
  }
  return files;
}

function readVarint(b, p) {
  let r = 0n, sh = 0n;
  for (;;) { const x = b[p++]; r |= BigInt(x & 0x7f) << sh; if (!(x & 0x80)) return [r, p]; sh += 7n; }
}

export function parse(b) {
  const out = [];
  let p = 0;
  while (p < b.length) {
    let t; [t, p] = readVarint(b, p);
    const num = Number(t >> 3n), wt = Number(t & 7n);
    let val;
    if (wt === 0) [val, p] = readVarint(b, p);
    else if (wt === 2) { let n; [n, p] = readVarint(b, p); val = b.subarray(p, p + Number(n)); p += Number(n); }
    else if (wt === 5) { val = b.subarray(p, p + 4); p += 4; }
    else if (wt === 1) { val = b.subarray(p, p + 8); p += 8; }
    else throw new Error('Drahttyp ' + wt);
    out.push([num, wt, val]);
  }
  if (p !== b.length) throw new Error('abgeschnitten');
  return out;
}

export function records(b) {
  const out = [];
  for (let p = 0; p < b.length;) { let n; [n, p] = readVarint(b, p); out.push(parse(b.subarray(p, p + Number(n)))); p += Number(n); }
  return out;
}

export const get = (m, n) => m.find(f => f[0] === n)?.[2];
export const str = (m, n) => Buffer.from(get(m, n)).toString();

function lz4(src, size) {
  const out = new Uint8Array(size);
  let i = 0, o = 0;
  while (i < src.length) {
    const tok = src[i++];
    let n = tok >> 4;
    if (n === 15) { let x; do { x = src[i++]; n += x; } while (x === 255); }
    out.set(src.subarray(i, i + n), o); i += n; o += n;
    if (i >= src.length) break;
    const off = src[i] | src[i + 1] << 8; i += 2;
    let m = tok & 15;
    if (m === 15) { let x; do { x = src[i++]; m += x; } while (x === 255); }
    for (m += 4; m--; o++) out[o] = out[o - off];
  }
  assert.equal(o, size, 'LZ4-Länge');
  return out;
}

export function unblob(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), parts = [];
  let p = 0;
  while (Buffer.from(b.subarray(p, p + 4)).toString() === 'bv41') {
    const raw = dv.getUint32(p + 4, true), size = dv.getUint32(p + 8, true);
    parts.push(lz4(b.subarray(p + 12, p + 12 + size), raw));
    p += 12 + size;
  }
  assert.equal(Buffer.from(b.subarray(p, p + 4)).toString(), 'bv4$');
  return Buffer.concat(parts);
}

// ---------- Test ----------
assert.equal(uuidPlus('00000000-0000-0000-0000-0000000000FF'), '00000000-0000-0000-0000-000000000100');
assert.equal(uuidPlus('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'), '00000000-0000-0000-0000-000000000000');
assert.deepEqual([null, '40', '41', '4~'].map(nextKey), ['40', '41', '42', '5-']);

const p = emptyProfile();
variantsOf(p, 'a').forEach((v, i) => v.push([[0.2, -0.5, 0.5, 0], [0.8 + i * 0.1, -0.9, 0.7, 10], [0.9, 0, 0.4, 20]], [[1, -1, 0.5, 0]]));
const o = { ...DEFAULTS, ruled: true, lineSpacing: 8.8, lineTop: 20, chaos: 0.5, penSize: PEN_SIZE };
const result = layout(Array(60).fill('aaaa aaxa').join('\n'), p, o);
const paper = new Uint8Array(await buildPdf({ pages: [{ items: [] }] }, o, '#1f4fbf', true).arrayBuffer());
const file = buildGoodnotes(result, o, '#1f4fbf', paper, 'Test');
const files = unzip(file);

assert.deepEqual(parse(files.get('schema.pb')).map(f => [f[0], Number(f[2])]), [[1, 24]]);
const events = records(files.get('index.events.pb'));
const kind = e => e.find(f => f[0] !== 1)[0];
const pages = events.filter(e => kind(e) === 54);
assert.equal(pages.length, result.pages.length, 'eine GoodNotes-Seite je Layout-Seite');
assert.ok(result.pages.length >= 2);
const title = parse(get(parse(get(events.find(e => kind(e) === 30), 30)), 2));
assert.equal(str(title, 1), 'Test');

// Jede Seite: Index-Eintrag notes/<Seiten-ID + 1>, Datei vorhanden, Papier-Anhang registriert
const index = records(files.get('index.notes.pb'));
const attach = records(files.get('index.attachments.pb'));
assert.equal(Buffer.from(files.get(str(attach[0], 2)).subarray(0, 5)).toString(), '%PDF-');
let strokes = 0;
pages.forEach((e, i) => {
  const nid = uuidPlus(str(parse(get(e, 54)), 2));
  assert.equal(str(index[i], 1), nid);
  const recs = records(files.get(`notes/${nid}`));
  for (let k = 0; k < recs.length; k += 2) {
    const body = parse(get(recs[k + 1], 7));
    const tpl = unblob(get(body, 2));
    assert.equal(tpl.subarray(0, 4).toString(), 'tpl\0');
    assert.equal(tpl.readUInt32LE(4), tpl.length);
    assert.equal(tpl.subarray(8, tpl.indexOf(0, 8)).toString(), 'vuA(v)A(S(uu))A(S(uuuu))vA(f)');
    const th = tpl.readFloatLE(tpl.indexOf(0, 8) + 3);
    assert.ok(th > 1 && th < 6, `Strichbreite ${th}`);
    strokes++;
  }
});
const expected = result.pages.flatMap(pg => pg.items.filter(it => !it.missing).flatMap(it => it.strokes)).length;
assert.equal(strokes, expected, 'jeder Strich einzeln');
console.log(`OK – GoodNotes: ${pages.length} Seiten, ${strokes} einzelne Striche, ${Math.round(file.length / 1024)} KB`);

// Arbeitsblatt: eigenes Papier-PDF je Seite, jede Seite verweist auf ihre eigene Papierebene
const sheet = { pages: result.pages.slice(0, 2).map(pg => ({ ...pg, size: [210, 297] })) };
const papers = sheet.pages.map(() => paper);
const sf = unzip(buildGoodnotes(sheet, o, '#1f4fbf', papers, 'Blatt'));
const sev = records(sf.get('index.events.pb'));
assert.equal(records(sf.get('index.attachments.pb')).length, 2, 'ein Anhang je Seite');
const layers = sev.filter(e => kind(e) === 2).map(e => str(parse(get(e, 2)), 2));
const used = sev.filter(e => kind(e) === 54).map(e => str(parse(get(parse(get(e, 54)), 3)), 1));
assert.equal(new Set(layers).size, 2);
assert.deepEqual(new Set(used), new Set(layers), 'jede Seite hat ihre Ebene');
for (const [name] of records(sf.get('index.attachments.pb')).map(r => [str(r, 2)])) assert.ok(sf.has(name));
console.log('OK – GoodNotes mit Papier je Seite');

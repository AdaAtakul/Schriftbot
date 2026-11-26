// Selbsttest für den KI-Tab: node tests/ki.test.mjs
import assert from 'node:assert/strict';
import { rules, buildTurns, userContent, attachmentText, kindOf, MAX_ATTACHMENT_CHARS, MAX_TOTAL_CHARS } from '../js/ki.js';

// Regeln nennen die verfügbaren Zeichen
assert.match(rules(['a', 'b', 'ä', ' ', 'a']), /nur diese Zeichen.*: abä/);
assert.doesNotMatch(rules([]), /nur diese Zeichen/);

// Gespräch: Regeln vorne, beginnt und endet mit der Person
const h = [{ role: 'assistant', content: 'Hallo!' }, { role: 'user', content: 'Frage 1' }, { role: 'assistant', content: 'Antwort 1' }, { role: 'user', content: 'Frage 2' }];
const t = buildTurns(h, ['a']);
assert.equal(t[0].role, 'user');
assert.match(t[0].content, /Schreibassistent/);
assert.deepEqual(t.slice(1).map(x => x.content), ['Frage 1', 'Antwort 1', 'Frage 2'], 'führende Assistenten-Nachricht fällt weg');
assert.throws(() => buildTurns([{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }]), /letzte Nachricht/);
// Zu langes Gespräch: älteste Nachrichten fallen weg, die neueste bleibt
const big = 'x'.repeat(MAX_TOTAL_CHARS / 2);
const long = buildTurns([{ role: 'user', content: big }, { role: 'assistant', content: big }, { role: 'user', content: big }, { role: 'assistant', content: 'ok' }, { role: 'user', content: 'neu' }]);
assert.ok(long.slice(1).reduce((n, m) => n + m.content.length, 0) <= MAX_TOTAL_CHARS);
assert.equal(long.at(-1).content, 'neu');
assert.equal(long[1].role, 'user');

// Anhänge: Text gekürzt und eingerahmt, Fotos nur erwähnt
const a = attachmentText({ name: 'aufgabe.pdf', kind: 'pdf', text: 'y'.repeat(MAX_ATTACHMENT_CHARS + 50) });
assert.match(a, /^=== Anhang: aufgabe.pdf ===/);
assert.match(a, /\[… gekürzt\]/);
assert.equal(attachmentText({ name: 'foto.jpg', kind: 'image' }), '=== Foto: foto.jpg ===');
const c = userContent('Beantworte Aufgabe 1', [{ name: 'a.txt', kind: 'text', text: 'Inhalt' }], 'Mein Entwurf');
assert.ok(c.indexOf('Mein Entwurf') < c.indexOf('Inhalt') && c.indexOf('Inhalt') < c.indexOf('Beantworte'));
assert.equal(userContent('', []), 'Bitte sieh dir den Anhang an.');

// Dateiarten
assert.equal(kindOf({ name: 'IMG_1.HEIC', type: '' }), 'image');
assert.equal(kindOf({ name: 'blatt.pdf', type: 'application/pdf' }), 'pdf');
assert.equal(kindOf({ name: 'notiz.md', type: '' }), 'text');
assert.equal(kindOf({ name: 'aufsatz.docx', type: '' }), 'word');
console.log('OK – KI-Tab');

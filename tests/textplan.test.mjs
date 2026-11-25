// Selbsttest für den Aufnahmetext: node tests/textplan.test.mjs
import assert from 'node:assert/strict';
import { emptyProfile, GROUPS } from '../js/profile.js';
import { SENTENCES, parse, plan } from '../js/textplan.js';

assert.deepEqual(parse('D[ei][ch].'), [['D', 'ei', 'ch', '.']]);
assert.deepEqual(parse('[sch]wimmt Elsa'), [['sch', 'w', 'i', 'm', 'm', 't'], ['E', 'l', 's', 'a']]);

// Jedes markierte Paar steht in der Paarliste (kein Tippfehler im Text)
const pairs = GROUPS.find(g => g.pairs).chars;
for (const k of SENTENCES.flatMap(parse).flat()) if ([...k].length > 1) assert.ok(pairs.includes(k), k);

// Die Sätze allein decken alle Kleinbuchstaben, Umlaute und Paare ab
const inSentences = new Set(SENTENCES.flatMap(parse).flat());
for (const k of [...'abcdefghijklmnopqrstuvwxyzäöüß', ...pairs]) assert.ok(inSentences.has(k), `Satz fehlt: ${k}`);

// Der Gesamtplan deckt jedes Pflichtzeichen ab, auch eigene Paare
const p = emptyProfile();
p.customPairs.push('ft');
const keys = new Set(plan(p).flat());
const required = GROUPS.filter(g => !g.optional).flatMap(g => g.chars).filter(k => k !== ' ');
for (const k of [...required, 'ft']) assert.ok(keys.has(k), `Plan fehlt: ${k}`);

const slots = plan(p).flat().length;
console.log(`OK – Aufnahmetext: ${plan(p).length} Wörter, ${slots} Felder für ${required.length + 1} Zeichen`);

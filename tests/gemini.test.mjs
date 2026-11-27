// Selbsttest für die KI-Brücke (ohne echtes Netz): node tests/gemini.test.mjs
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const calls = [];
let reply = () => ({ status: 200, body: {} });
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  const { status, body } = reply(url);
  return { ok: status < 300, status, json: async () => body };
};
const G = await import('../js/gemini.js');

// Antwort aufräumen
assert.equal(G.cleanAnswer('```text\n# Titel\n**wichtig** ist das\n```\n'), '# Titel\nwichtig ist das');

// Ohne Schlüssel keine Anfrage
await assert.rejects(G.generate('auftrag', 'Hallo'), /Noch kein Schlüssel/);
assert.equal(calls.length, 0);

// Mit Schlüssel: Schlüssel im Kopf (nicht in der Adresse), Auftrag und Lernzettel-Regeln gehen mit
mem.set('gemini-key', 'AIzaTEST');
reply = () => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: '# Photosynthese\n- Licht' }] } }] } });
assert.equal(await G.generate('lernzettel', 'Photosynthese'), '# Photosynthese\n- Licht');
const c = calls.at(-1);
assert.ok(!c.url.includes('AIzaTEST'), 'Schlüssel nicht in der Adresse');
assert.equal(c.init.headers['x-goog-api-key'], 'AIzaTEST');
const body = JSON.parse(c.init.body);
assert.match(body.systemInstruction.parts[0].text, /==Begriff==/);
assert.equal(body.contents[0].parts[0].text, 'Photosynthese');

// Überarbeiten schickt den vorhandenen Text mit
await G.generate('ueberarbeiten', '', 'Text mit Feler');
assert.match(JSON.parse(calls.at(-1).init.body).contents[0].parts[0].text, /Rechtschreibung korrigieren[\s\S]*Text mit Feler/);

// Limit erreicht: einmal mit dem kleineren Modell, das danach gemerkt wird
calls.length = 0;
reply = url => (url.includes('gemini-flash-latest')
  ? { status: 429, body: { error: { message: 'quota' } } }
  : { status: 200, body: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } });
assert.equal(await G.generate('auftrag', 'x'), 'ok');
assert.deepEqual(calls.map(k => k.url.match(/models\/([^:]+)/)[1]), ['gemini-flash-latest', 'gemini-flash-lite-latest']);
assert.equal(mem.get('gemini-modell'), 'gemini-flash-lite-latest');

// Verständliche Fehler
reply = () => ({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
await assert.rejects(G.generate('auftrag', 'x'), /Schlüssel ist ungültig/);
reply = () => ({ status: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } });
await assert.rejects(G.generate('auftrag', 'x'), /Inhaltsfilter/);
console.log('OK – KI-Brücke');

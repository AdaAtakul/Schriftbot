// Selbsttest für die KI-Anbindung (ohne echten Aufruf): node tests/ki.test.mjs
import assert from 'node:assert/strict';
import { ask, buildRequest, DEFAULT_CONFIG, chatPrompt, cleanAnswer } from '../js/ki.js';

const fake = (status, data) => {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: status < 300, status, json: async () => data }; };
  return { fn, calls };
};
const claude = { ...DEFAULT_CONFIG, key: 'test-key' };

// Claude: richtige Adresse, Header für den Browser-Zugriff, Text aus den text-Blöcken
let f = fake(200, { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' Hallo Welt ' }] });
assert.equal(await ask(claude, 'Schreib etwas', 'alter Text', 'a b c', f.fn), 'Hallo Welt');
const c = f.calls[0];
assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
assert.equal(c.init.headers['x-api-key'], 'test-key');
assert.equal(c.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
assert.equal(c.init.headers['anthropic-version'], '2026-10-21');
assert.equal(c.body.model, 'claude-opus-5-5');
assert.equal(c.body.fallbacks, 'default');
assert.equal(c.init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
assert.ok(c.body.system.includes('a b c'), 'erlaubte Zeichen im Systemprompt');
assert.ok(c.body.messages[0].content.includes('alter Text') && c.body.messages[0].content.includes('Schreib etwas'));
// Haiku hat keine serverseitige Ausweichlösung
assert.equal(JSON.parse(buildRequest({ ...claude, model: 'claude-haiku-5-5' }, 's', 'u').init.body).fallbacks, undefined);

// Ablehnung, falscher Schlüssel, fehlender Schlüssel, offline
await assert.rejects(ask(claude, 'x', '', '', fake(200, { stop_reason: 'refusal', content: [] }).fn), /abgelehnt/);
await assert.rejects(ask(claude, 'x', '', '', fake(401, { error: { message: 'invalid x-api-key' } }).fn), /Schlüssel ungültig.*invalid x-api-key/);
await assert.rejects(ask({ ...claude, key: '' }, 'x', '', ''), /Kein API-Schlüssel/);
await assert.rejects(ask(claude, 'x', '', '', async () => { throw new TypeError('Failed to fetch'); }), /Keine Verbindung/);

// OpenAI-kompatibel: Bearer-Header, /chat/completions, Antwort aus choices
const other = { provider: 'openai', key: 'k2', model: 'irgendein-modell', baseUrl: 'https://example.test/v1/' };
f = fake(200, { choices: [{ message: { content: 'Antwort' } }] });
assert.equal(await ask(other, 'x', '', 'a', f.fn), 'Antwort');
assert.equal(f.calls[0].url, 'https://example.test/v1/chat/completions');
assert.equal(f.calls[0].init.headers.authorization, 'Bearer k2');
assert.equal(f.calls[0].body.messages[0].role, 'system');
await assert.rejects(ask({ ...other, model: '' }, 'x', '', ''), /Modell/);

// Kopierweg über die Claude-App: eine Nachricht mit Vorgaben, Text und Auftrag; Antwort wird entformatiert
const msg = chatPrompt('Kürzen', 'Mein Text', 'a b');
assert.ok(msg.includes('a b') && msg.includes('Mein Text') && msg.includes('Auftrag: Kürzen'));
assert.equal(cleanAnswer('```\n## Titel\n**fett** und normal\n```\n'), 'Titel\nfett und normal');
console.log('OK – KI-Anbindung');

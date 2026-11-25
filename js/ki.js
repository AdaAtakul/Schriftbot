// KI-Anbindung ohne Server: die App ruft den Anbieter direkt vom iPad aus mit dem eigenen API-Schlüssel auf.
// Claude über die Messages-API, alle anderen über die verbreitete OpenAI-kompatible Schnittstelle
// (OpenAI, OpenRouter, Mistral, Groq, Gemini u. a.). Ohne DOM, in Node testbar.
// Rohes fetch statt SDK, weil die App keinen Build-Schritt hat.

export const PROVIDERS = {
  claude: { label: 'Claude (Anthropic)', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'] },
  openai: { label: 'Andere KI (OpenAI-kompatibel)', models: [] },
};
export const DEFAULT_CONFIG = { provider: 'claude', key: '', model: 'claude-opus-5-5', baseUrl: 'https://api.openai.com/v1' };

// Modelle, die bei einer Ablehnung serverseitig auf ein anderes Modell ausweichen können.
const HAS_FALLBACK = /^claude-(opus-5|sonnet-5-5|fable-5)/;

export function systemPrompt(chars) {
  return 'Du schreibst Texte, die anschließend in der echten Handschrift der Person, die diese App benutzt, ' +
    'auf ein Notizblatt (GoodNotes) gesetzt werden. Antworte ausschließlich mit dem fertigen Text: ' +
    'ohne Einleitung, ohne Erklärung, ohne Markdown (keine Sternchen, Rauten, Tabellen), ohne Emojis. ' +
    `Verwende nur diese Zeichen, weil nur sie in der Handschrift aufgenommen sind: ${chars} ` +
    'Zeilenumbrüche sind erlaubt, Aufzählungen schreibst du mit "-" am Zeilenanfang. ' +
    'Schreib auf Deutsch, außer der Auftrag verlangt etwas anderes. ' +
    'Wird ein aktueller Text mitgeschickt und betrifft der Auftrag ihn, gib den vollständigen überarbeiteten Text zurück.';
}

export function userMessage(task, text) {
  return text.trim() ? `Aktueller Text:\n"""\n${text}\n"""\n\nAuftrag: ${task}` : `Auftrag: ${task}`;
}

export function buildRequest(cfg, system, user) {
  if (cfg.provider === 'claude') {
    const body = {
      model: cfg.model || DEFAULT_CONFIG.model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'medium' },
    };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true', // nötig für Aufrufe direkt aus dem Browser (CORS)
    };
    if (HAS_FALLBACK.test(body.model)) {
      body.fallbacks = 'default';
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }
    return { url: 'https://api.anthropic.com/v1/messages', init: { method: 'POST', headers, body: JSON.stringify(body) } };
  }
  return {
    url: cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    },
  };
}

export function parseResponse(provider, data) {
  if (provider === 'claude') {
    if (data.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt. Formuliere den Auftrag bitte anders.');
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!text) throw new Error('Die Antwort war leer.');
    return text;
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Die Antwort war leer.');
  return text;
}

function httpError(status, data) {
  const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : '');
  if (status === 401 || status === 403) return new Error('API-Schlüssel ungültig oder ohne Berechtigung. ' + msg);
  if (status === 429) return new Error('Zu viele Anfragen oder kein Guthaben mehr. ' + msg);
  if (status === 404) return new Error('Modell oder Adresse nicht gefunden. ' + msg);
  return new Error(`Fehler ${status}. ${msg}`);
}

export async function ask(cfg, task, text, chars, fetchImpl = fetch) {
  if (!cfg.key) throw new Error('Bitte zuerst im Profil-Tab einen API-Schlüssel eintragen.');
  if (cfg.provider !== 'claude' && (!cfg.model || !cfg.baseUrl)) throw new Error('Bitte im Profil-Tab Adresse und Modell der KI eintragen.');
  const { url, init } = buildRequest(cfg, systemPrompt(chars), userMessage(task, text));
  let res;
  try {
    res = await fetchImpl(url, init);
  } catch {
    throw new Error('Keine Verbindung zur KI. Bist du offline? Manche Anbieter erlauben auch keinen Zugriff direkt aus dem Browser.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw httpError(res.status, data);
  return parseResponse(cfg.provider, data || {});
}

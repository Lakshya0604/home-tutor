// LLM access: keyless Pollinations by default; user's own key (Groq / custom OpenAI-compatible) is stored in this browser only.
export const cfg = () => JSON.parse(localStorage.getItem('aiteacher.cfg') || '{}');
export const saveCfg = c => localStorage.setItem('aiteacher.cfg', JSON.stringify(c));
const DEFAULTS = {
  groq: { base: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', key: true },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', key: true },
  custom: { base: '', model: '', key: true },
};
export const providerDefaults = DEFAULTS;
export async function chat(messages, { json = true, temperature = 0.4, signal } = {}) {
  const c = cfg(); const prov = c.provider || 'groq'; const d = DEFAULTS[prov];
  const url = prov === 'custom' ? (c.baseUrl || '').replace(/\/$/, '') + (c.baseUrl?.includes('/chat/completions') ? '' : '/chat/completions') : d.base;
  if (!url) throw new Error('Set a base URL in AI settings.');
  if (prov !== 'custom' && !c.apiKey) throw new Error('Add your free API key first (AI settings button, top right).');
  const body = { model: c.model || d.model, messages, temperature };
  if (json) body.response_format = { type: 'json_object' };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 90000);
      signal?.addEventListener('abort', () => ctl.abort());
      const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(d.key && c.apiKey ? { Authorization: 'Bearer ' + c.apiKey } : {}) }, body: JSON.stringify(body) });
      clearTimeout(to);
      if (!r.ok) { const t = await r.text(); throw new Error(`AI provider error ${r.status}: ${t.slice(0, 160)}`); }
      const j = await r.json(); const out = j.choices?.[0]?.message?.content;
      if (!out) throw new Error('Empty AI reply');
      return out;
    } catch (e) { lastErr = e; if (e.name === 'AbortError' && signal?.aborted) throw e; await new Promise(r => setTimeout(r, 1200 * (attempt + 1))); }
  }
  throw lastErr;
}
export function parseJSON(txt) {
  const t = txt.replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('AI reply was not JSON');
  return JSON.parse(t.slice(a, b + 1));
}
export async function chatJSON(messages, opts) {
  let last;
  for (let i = 0; i < 2; i++) { try { return parseJSON(await chat(messages, opts)); } catch (e) { last = e; } }
  throw last;
}

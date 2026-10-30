import { checkActive, delay } from './progressive.js';
// LLM access: keyless Pollinations by default; user's own key (Groq / custom OpenAI-compatible) is stored in this browser only.
export const cfg = () => JSON.parse(localStorage.getItem('aiteacher.cfg') || '{}');
export const saveCfg = c => localStorage.setItem('aiteacher.cfg', JSON.stringify(c));
import { API_BASE } from './config.js';
import { token, logout } from './auth.js';
const DEFAULTS = {
  server: { base: API_BASE + '/api/llm', model: '(server default)', key: false },
  groq: { base: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b', key: true },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', key: true },
  custom: { base: '', model: '', key: true },
};
export const providerDefaults = DEFAULTS;
// Token-aware pacing for the shared free tier (Groq TPM limit 8000/min). Estimates are conservative; a real 429 still stops the call.
const TPM_BUDGET = 6500; const sentLog = []; export const pacing = { onWait: null };
const estTokens = m => Math.ceil(JSON.stringify(m).length / 3) + 5500;
async function paced(est, signal) {
  for (;;) {
    checkActive(signal);
    const now = Date.now(); while (sentLog.length && now - sentLog[0].t > 60000) sentLog.shift();
    const used = sentLog.reduce((s, x) => s + x.n, 0);
    if (!sentLog.length || used + est <= TPM_BUDGET) { sentLog.push({ t: now, n: est }); return; }
    const wait = Math.min(60000, sentLog[0].t + 60000 - now + 500);
    const end=Date.now()+wait;
    while(Date.now()<end) { checkActive(signal); pacing.onWait?.(Math.ceil((end-Date.now())/1000)); await delay(Math.min(1000,end-Date.now()),signal); }
  }
}
export async function chat(messages, { json = true, temperature = 0.4, signal } = {}) {
  const c = cfg(); const prov = c.provider || 'server'; const d = DEFAULTS[prov];
  const url = prov === 'custom' ? (c.baseUrl || '').replace(/\/$/, '') + (c.baseUrl?.includes('/chat/completions') ? '' : '/chat/completions') : d.base;
  if (!url) throw new Error('Set a base URL in AI settings.');
  if (prov !== 'custom' && prov !== 'server' && !c.apiKey) throw new Error('Add your free API key first (AI settings button, top right).');
  const body = prov === 'server' ? { messages, temperature, json } : { model: c.model || d.model, messages, temperature };
  if (json && prov !== 'server') body.response_format = { type: 'json_object' };
  checkActive(signal);
  if (prov === 'server') await paced(estTokens(messages), signal);
  const ctl=new AbortController();
  const abort=()=>ctl.abort();
  const timer=setTimeout(abort,100000);
  signal?.addEventListener('abort',abort,{once:true});
  try {
    checkActive(signal);
    const r=await fetch(url,{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json',...(prov==='server'?{Authorization:'Bearer '+token()}:d.key&&c.apiKey?{Authorization:'Bearer '+c.apiKey}:{})},body:JSON.stringify(body)});
    if(r.status===401 && prov==='server') { logout(); throw new Error('Session expired, please login again.'); }
    if(!r.ok) {
      let wait=0,limit=''; const text=await r.text();
      try { const j=JSON.parse(text);wait=+j.retryAfterSec||0;limit=j.limit||''; } catch {}
      const error=new Error(r.status===429 ? `AI free limit reached${limit?' ('+limit+')':''}${wait?'; provider suggests retrying after at least '+wait+' s (availability is not guaranteed)':''}. Preparation stopped; no automatic retries.` : `AI provider error ${r.status}: ${text.slice(0,160)}`);
      error.retryAfterSec=wait;error.noRetry=true;error.status=r.status;throw error;
    }
    const j=await r.json();checkActive(signal);
    if(j.choices?.[0]?.finish_reason==='length') throw new Error('The AI response was cut short. This part was not taught. Press Resume to prepare it again.');
    const out=j.choices?.[0]?.message?.content;
    if(!out) throw new Error('Empty AI reply');
    return out;
  } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
}

export function parseJSON(txt) {
  const t = txt.replace(/```json|```/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('AI reply was not JSON');
  return JSON.parse(t.slice(a, b + 1));
}
export async function chatJSON(messages, opts) { return parseJSON(await chat(messages, opts)); }

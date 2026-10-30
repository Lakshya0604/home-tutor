// Free, in-browser retrieval (BM25 keyword search). No model, no API, no network: it only picks which source parts to show the teacher for a doubt.
const STOP = new Set(('a an the is are was were be been of in on at to for from by with and or but not no it its this that these those as if then so do does did can could will would should may might i you he she we they me my your our their what why how when where which who whom whose kya kyu kyun kaise kaisa kaisi kab kahan kon kaun hai hain ho hu hoon tha thi the ka ki ke ko se me mein par pe aur ya to toh bhi nahi nahin ye yeh wo woh ek is us isko usko mujhe tum aap hum matlab samjhao batao bataiye explain please sir mam की का के को से में पर और या तो भी नहीं यह वह एक है हैं था थी क्या क्यों कैसे').split(/\s+/));
const tok = s => (String(s).toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || []).map(w => /^[a-z]+$/.test(w) ? w.replace(/(ing|ed|es|s)$/, m => w.length - m.length >= 3 ? '' : m) : w).filter(w => w.length > 1 && !STOP.has(w));
export function buildIndex(chunks) {
  const docs = chunks.map(c => { const t = tok(c), tf = new Map(); t.forEach(w => tf.set(w, (tf.get(w) || 0) + 1)); return { tf, len: t.length }; });
  const df = new Map(); docs.forEach(d => d.tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
  const avg = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avg, n: docs.length };
}
// returns [{part, score}] best first; only parts that share at least one real term with the query
export function search(ix, query, k = 3) {
  const q = [...new Set(tok(query))]; const out = [];
  ix.docs.forEach((d, i) => {
    let s = 0;
    for (const w of q) { const f = d.tf.get(w); if (!f) continue; const idf = Math.log(1 + (ix.n - ix.df.get(w) + 0.5) / (ix.df.get(w) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / (ix.avg || 1))); }
    if (s > 0) out.push({ part: i, score: s });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

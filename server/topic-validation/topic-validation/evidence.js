// Checks provenance and indexes, not whether an excerpt entails every answer claim.
export function checkedReferences(references, parts, sentenceCount) {
  if (!Array.isArray(references)) return [];
  const clean = [];
  for (const r of references) {
    const p = parts.find(p => p.part === r.part);
    const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
    if (!p || quote.length < 16 || !p.text.includes(quote)) throw new Error('Source reference does not match a supplied source excerpt.');
    if (!Array.isArray(r.sentences) || !r.sentences.length || r.sentences.some(i => !Number.isInteger(i) || i < 0 || i >= sentenceCount)) throw new Error('Source reference has invalid answer sentence indexes.');
    clean.push({part:r.part,quote,sentences:[...new Set(r.sentences)]});
  }
  return clean;
}
export function renderReferences(host, refs) {
  host.innerHTML = '';
  for (const r of refs) {
    const el = document.createElement('details'); el.className='source-ref';
    const title=document.createElement('summary');title.textContent=`Source excerpt: part ${r.part} (answer lines ${r.sentences.map(i=>i+1).join(', ')})`;
    const quote=document.createElement('blockquote');quote.textContent=r.quote;
    const note=document.createElement('small');note.textContent='Exact excerpt matched to the supplied notes. Check whether it supports the answer.';
    el.append(title,quote,note);host.append(el);
  }
}

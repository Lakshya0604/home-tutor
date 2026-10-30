// Structural checks only, not a proof of factual correctness or complete coverage.
export function validateLesson(d, source) {
  const sentences = Array.isArray(d?.sentences) ? d.sentences.filter(s => s && typeof s.text === 'string' && s.text.trim()) : [];
  const words = sentences.map(s => s.text).join(' ').trim().split(/\s+/).length;
  if (sentences.length < 4 || words < 45) throw new Error('The AI returned an incomplete explanation. This part is not marked taught. Press Resume to prepare it again.');
  if (/\d/.test(source) && /(?:example|calculate|calculation|numerical|metre|meter|squared|उदाहरण)/i.test(source) && !sentences.some(s => s.step?.math)) throw new Error('The AI skipped the worked calculation. This part is not marked taught. Press Resume to prepare it again.');
  d.sentences = sentences;
  return d;
}
export function sourceUnits(source) {
  return source.split(/(?<=[.!?।])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 10);
}
export function validateCoverage(d, source) {
  validateLesson(d, source);
  const units = sourceUnits(source), coverage = d.coverage;
  if (!Array.isArray(coverage)) throw new Error('The AI did not show how it covered the source. This part is not marked taught. Press Resume to prepare it again.');
  for (let id = 0; id < units.length; id++) {
    const c = coverage.find(x => x.unit === id);
    if (!c || !Array.isArray(c.sentences) || !c.sentences.length || c.sentences.some(i => !Number.isInteger(i) || !d.sentences[i])) throw new Error('The AI left source unit ' + (id + 1) + ' unexplained. This part is not marked taught. Press Resume to prepare it again.');
    const mapped = c.sentences.map(i => d.sentences[i]);
    if (mapped.every(s => /^(namaste|hello|welcome|aaj hum|today we)/i.test(s.text.trim()))) throw new Error('A greeting cannot count as source coverage. This part is not marked taught.');
    const explained = mapped.map(s => [s.text, s.step?.math].join(' ')).join(' ');
    const numbers = [...units[id].matchAll(/-?\d+(?:\.\d+)?/g)].map(m => m[0]);
    if (numbers.length > 1 && numbers.some(n => !explained.includes(n))) throw new Error('A worked example left out source values. This part is not marked taught.');
    if (/\b(formula|substitute|calculate|calculation|to find|follows from)\b/i.test(units[id]) && !mapped.some(s => s.step?.math)) throw new Error('A source calculation has no worked board step. This part is not marked taught.');
  }
  return d;
}
export function validateDoubt(d, allowedParts, noEvidence) {
  const text = (d.sentences || []).map(s => s.text || '').join(' ');
  if (noEvidence) { if (!/outside your notes|notes ke bahar|नोट्स के बाहर/i.test(text)) throw new Error('The answer did not disclose that it could not be confirmed from your notes. Please rephrase the question.'); }
  else { const refs = [...text.matchAll(/part\s+(\d+)/gi)].map(m => +m[1]); if (!refs.length || refs.some(n => !allowedParts.includes(n))) throw new Error('The answer did not include valid source-part references. It has not been presented as verified. Please ask again.'); }
  return d;
}

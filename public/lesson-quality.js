import { checkDerivedStep } from './derived-step.js';
import { checkedMotionGraph } from './motion-graph.js';
import { checkedReferences } from './evidence.js';
// Structural checks only, not a proof of factual correctness or complete coverage.
export function validateLesson(d, source) {
  const sentences = Array.isArray(d?.sentences) ? d.sentences.filter(s => s && typeof s.text === 'string' && s.text.trim()) : [];
  const words = sentences.map(s => s.text).join(' ').trim().split(/\s+/).length;
  if (sentences.length < 4 || words < 45) throw new Error('The AI returned an incomplete explanation. This part is not marked taught. Press Resume to prepare it again.');
  if (/\d/.test(source) && /(?:example|calculate|calculation|numerical|metre|meter|squared|उदाहरण)/i.test(source) && !sentences.some(s => s.step?.math)) throw new Error('The AI skipped the worked calculation. This part is not marked taught. Press Resume to prepare it again.');
  for (const s of sentences) for (const field of ['text','speak']) if (typeof s[field] === 'string') s[field] = s[field].replace(/\*(?:waves?|nods?|points?|smiles?|gestures?)\*/gi, '').replace(/\[(?:waves?|nods?|points?|smiles?|gestures?)\]/gi, '').trim();
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
    if (/derivation|derive|substitute.+(?:to get|gives|yield)/i.test(units[id]) && mapped.filter(s => s.step?.math).length < 2) throw new Error('The derivation needs separate worked steps before this part can be marked taught.');
    const explained = mapped.map(s => [s.text, s.step?.math].join(' ')).join(' ');
    const numbers = [...units[id].replace(/^(?:topic|chapter|unit)\s+\d+\s*[:.-]?\s*/i, '').matchAll(/-?\d+(?:\.\d+)?/g)].map(m => m[0]);
    if (numbers.length > 1 && numbers.some(n => !explained.includes(n))) throw new Error('A worked example left out source values. This part is not marked taught.');
    if (/\b(formula|substitute|calculate|calculation|to find|follows from)\b/i.test(units[id]) && !mapped.some(s => s.step?.math)) throw new Error('A source calculation has no worked board step. This part is not marked taught.');
  }
  if (d.diagram?.type === 'motion') d.diagram = checkedMotionGraph(d.diagram, source, d.sentences);
  return d;
}
export function validateDoubt(d, allowedParts, noEvidence, sourceParts = []) {
  if ((d.sentences || []).some(s=>Array.isArray(s.evidence))) d.references = d.sentences.flatMap((s,i)=>(s.evidence || []).map(e=>({...e,sentences:[i]})));
  for(const s of d.sentences || []) if(s.derived) s.derived = checkDerivedStep(s.derived, sourceParts);
  const text = (d.sentences || []).map(s => s.text || '').join(' ');
  if (noEvidence) { if (!/outside your notes|notes ke bahar|नोट्स के बाहर/i.test(text)) throw new Error('The answer did not disclose that it could not be confirmed from your notes. Please rephrase the question.'); }
  else if (d.references?.length) { d.references = checkedReferences(d.references, sourceParts, d.sentences?.length || 0); const covered = new Set(d.references.flatMap(r=>r.sentences)); if ((d.sentences || []).some((s,i)=> /\d|[=²]/.test(s.text || '') && !covered.has(i) && !s.derived?.checked)) throw new Error('The numerical answer has source references missing for one or more calculation lines.'); }
  else { const refs = [...text.matchAll(/part\s+(\d+)/gi)].map(m => +m[1]); if (!refs.length || refs.some(n => !allowedParts.includes(n))) throw new Error('The answer did not include valid source-part references. It has not been presented as verified. Please ask again.'); }
  return d;
}

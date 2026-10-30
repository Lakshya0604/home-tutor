import { checkedNumericEqualities } from './arithmetic.js';
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
  // Transparent content checks, not a claim of complete semantic coverage.
  const normalized = x => String(x).replace(/\s+/g, '').replace(/[×·]/g,'*').toLowerCase();
  const teaching = normalized(d.sentences.map(s=>[s.text,s.board,s.step?.math].join(' ')).join(' '));
  const premises = [...source.matchAll(/\b([uavghts])\s*=\s*(-?\d+(?:\.\d+)?)/gi)].map(m=>({name:m[1].toLowerCase(),value:m[2]}));
  for (const p of premises) {
    if (!teaching.includes(p.name+'='+p.value)) throw new Error('The explanation did not show the source value '+p.name+' = '+p.value+'. This part is not marked taught.');
  }
  const formulaSource = /\b(?:formula|equation|substitute|calculate|calculation)\b|[=²]/i.test(source);
  if (formulaSource && !d.sentences.some(s=>s.step?.math)) throw new Error('The explanation omitted worked board steps. This part is not marked taught.');
  if (/derivation|derive/i.test(source) && d.sentences.filter(s=>s.step?.math).length < 2) throw new Error('The derivation needs separate worked steps before this part can be marked taught.');
  if (d.diagram?.type === 'motion') d.diagram = checkedMotionGraph(d.diagram, source, d.sentences);
  return d;
}
export function validateDoubt(d, allowedParts, noEvidence, sourceParts = []) {
  if ((d.sentences || []).some(s=>Array.isArray(s.evidence))) d.references = d.sentences.flatMap((s,i)=>(s.evidence || []).map(e=>({...e,sentences:[i]})));
  for(const s of d.sentences || []) if(s.derived) s.derived = checkDerivedStep(s.derived, sourceParts);
  const text = (d.sentences || []).map(s => s.text || '').join(' ');
  if (noEvidence) { if (!/outside your notes|notes ke bahar|नोट्स के बाहर/i.test(text)) throw new Error('The answer did not disclose that it could not be confirmed from your notes. Please rephrase the question.'); }
  else if (d.references?.length) { d.references = checkedReferences(d.references, sourceParts, d.sentences?.length || 0); const cited = d.references.map(r=>r.quote).join(' '); const premiseNumbers=new Set([...cited.matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0])));
    for (const sentence of d.sentences || []) {
      if (/\d+\s*(?:m|metres?|meters?)\s*\+\s*\d+\s*(?:s|seconds?)\b/i.test(sentence.text || '')) throw new Error('This calculation adds incompatible distance and time units.');
      const numeric=checkedNumericEqualities([sentence.text,sentence.step?.math].join(' '));
      sentence.arithmeticChecks=numeric; sentence.supportStatus='Source excerpts supplied; arithmetic checks do not establish units or semantic support.';
      if(sentence.derived?.checked)continue;
      const sentenceText=String(sentence.text || '').replace(/\(part\s+\d+\)/gi,'');
      const claims=[...sentenceText.matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
      const checkedResults=new Set(numeric.map(n=>n.result));
      if(claims.some(n=>!premiseNumbers.has(n)&&!checkedResults.has(n)))throw new Error('The numerical answer uses a value not supplied by its cited premises or a checked calculation.');
    } }
  else { const refs = [...text.matchAll(/part\s+(\d+)/gi)].map(m => +m[1]); if (!refs.length || refs.some(n => !allowedParts.includes(n))) throw new Error('The answer did not include valid source-part references. It has not been presented as verified. Please ask again.'); }
  return d;
}

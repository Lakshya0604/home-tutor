import {lessonMessages,doubtMessages} from './bilingual-prompts.js';
import {lessonPrompt,doubtPrompt} from './prompts.js';
import {bilingualSchema} from './schema.js';
import {assertSchema} from './schema-check.js';
import {englishBoardHindiSpeech} from './language-contract.js';
import {validateCoverage,validateDoubt} from './lesson-quality.js';
export const hindiSpeechMode=language=>['hindi','hinglish'].includes(language);
export function spokenSentence(sentence,language) {
 if(!hindiSpeechMode(language))return sentence.text;
 // No automatic English substitution when the requested Hindi voice field is missing.
 if(!sentence.speak?.trim())throw new Error('Hindi speech is missing; playback stopped.');
 return sentence.speak;
}
// Existing English behavior preserved, including its provider request/parser path.
// Hindi uses strict whole-output JSON parse and full local runtime checks before caching/audio.
// Display-only punctuation cleanup on a derived notes response, never math,
// speech, evidence quotes or the parsed original. Other callers stay strict.
export function notesDisplayPunctuation(original) {
 const answer=structuredClone(original),punct=x=>typeof x==='string'?x.replace(/[\u0964\u0965]/g,'.'):x;
 answer.title=punct(answer.title);
 for(const sentence of answer.sentences||[]){sentence.text=punct(sentence.text);sentence.board=punct(sentence.board);if(sentence.step)sentence.step.from=punct(sentence.step.from);}
 const diagram=answer.diagram;
 if(diagram){for(const k of ['title','center'])if(k in diagram)diagram[k]=punct(diagram[k]);for(const k of ['steps','headers'])if(Array.isArray(diagram[k]))diagram[k]=diagram[k].map(punct);if(diagram.rows)diagram.rows=diagram.rows.map(row=>row.map(punct));if(diagram.branches)diagram.branches=diagram.branches.map(b=>({...b,label:punct(b.label),items:b.items.map(punct)}));}
 return answer;
}
async function bilingualResponse(task,messages,chat,options) {
 const schema=bilingualSchema(task);
 const raw=await chat([{...messages[0],content:messages[0].content+'\nEXACT JSON SCHEMA (all fields required, no unknown fields):\n'+JSON.stringify(schema)},...messages.slice(1)],options);
 // Opt-in diagnostics for synthetic QA only. Nothing is uploaded, persisted, or enabled on normal lesson URLs.
 if(typeof location!=='undefined' && new URLSearchParams(location.search).get('qa')==='1')globalThis.__homeTutorQADiagnostic=Object.freeze({task,raw});
 let answer;try{answer=JSON.parse(raw);}catch{throw new Error('AI returned invalid strict JSON; not taught.');}
 assertSchema(answer,schema);
 if(task==='lesson'){
   const lines=answer.sentences;
   if(lines.filter(s=>s.teachingRole==='explanation').length<2)throw new Error('The lesson omitted distinct explanations; not taught.');
   const last=lines.at(-1);
   if(last.teachingRole!=='check'||!/[?？]/.test(last.text)||!/[?？]/.test(last.speak))throw new Error('The lesson omitted its final understanding question; not taught.');
   // Narrow deterministic check: a review question cannot invent numerical givens.
   // This does not verify that its topic or every explanation is source-supported.
   const numbers=s=>[...s.replace(/(?<=\d),(?=\d{3}\b)/g,'').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
   const supplied=new Set(numbers(messages.at(-1).content));
   if(numbers(last.text+' '+last.speak).some(n=>!supplied.has(n)))throw new Error('The understanding question invented numerical inputs; not taught.');
   const compact=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
   const source=compact(messages.at(-1).content);
   if(lines.filter(s=>s.teachingRole==='explanation').some(s=>source.includes(compact(s.text))))throw new Error('The lesson copied a source line instead of explaining it; not taught.');
   // Narrow deterministic check: a review question must stay on source concepts.
   // Lexical stem overlap against the source only; this does not prove the
   // question is answerable, fairly phrased, or semantically supported.
   const framing=new Set(['steadily','suddenly','observed','observes','happens','happened','suggest','suggests','consider','considers','suppose','supposing','imagine','imagines','someone','something','anything','correctly','probably','possibly','question','answering','following','meaning','understand','explains','describe','describes','remember','notice','notices']);
   const novel=[...new Set((last.text.toLowerCase().match(/[a-z]{8,}/g)||[]).filter(w=>!framing.has(w)&&!source.includes(w)&&!source.includes(w.slice(0,6))))];
   if(novel.length>=2||novel.some(w=>w.length>=11))throw new Error('The understanding question left the source concepts; not taught.');
 }
 const display=task==='lesson'?notesDisplayPunctuation(answer):answer;englishBoardHindiSpeech(display);return display;
}
export async function prepareLesson({language,source,previousTitles,topic,plan,chat,chatJSON,options}) {
 const raw=hindiSpeechMode(language)?await bilingualResponse('lesson',lessonMessages({source,previousTitles,section:topic,headingMap:plan}),chat,options):await chatJSON(lessonPrompt(language,source,previousTitles,topic,plan),options);
 return validateCoverage(raw,source);
}
export async function prepareDoubt({language,question,source,parts,currentPart,noEvidence,chat,chatJSON,options}) {
 const sourceParts=[{part:currentPart,text:source},...parts.filter(p=>p.part!==currentPart)];
 const raw=hindiSpeechMode(language)?await bilingualResponse('doubt',doubtMessages({question,parts:sourceParts,noEvidence}),chat,options):await chatJSON(doubtPrompt(language,question,source,parts,currentPart,noEvidence),options);
 return validateDoubt(raw,sourceParts.map(p=>p.part),noEvidence,sourceParts);
}

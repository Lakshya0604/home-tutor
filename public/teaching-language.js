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
 let answer;try{answer=JSON.parse(raw);}catch{throw new Error('AI returned invalid strict JSON; not taught.');}
 assertSchema(answer,schema);const display=task==='lesson'?notesDisplayPunctuation(answer):answer;englishBoardHindiSpeech(display);return display;
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

// Screen language and spoken language are separate explicit user choices.
import {validateSpeechScript} from './speech-contract.js';
const DEV=/[\u0900-\u097F]/;
const ROMAN_HINDI=/\b(?:namaste|bachcho|bachchon|namaskar|chalo|samajh|matlab|yaani|yahan|toh|nahi|karenge|hota|hoti|hain|hai|aaya|dekhte|liye|mein)\b/i;
export function englishBoardHindiSpeech(answer) {
 const visible=[answer.title];
 for(const sentence of answer.sentences || [])visible.push(sentence.text,sentence.board,sentence.step?.math,sentence.step?.from);
 const d=answer.diagram;if(d)visible.push(d.title,d.center,...(d.steps||[]),...(d.headers||[]),...(d.rows||[]).flat(),...(d.branches||[]).flatMap(b=>[b.label,...b.items]));
 // Exact evidence and motion sourceQuote are not translated, as translation breaks provenance.
 for(const value of visible)if(value!=null&&(DEV.test(value)||ROMAN_HINDI.test(value)))throw new Error('Visible teaching must be English, not Hindi or Roman Hindi. This response was not taught.');
 validateSpeechScript(answer,'hinglish');
 for(const sentence of answer.sentences||[]) {
  const spoken=String(sentence.speak||'').trim();
  if(!DEV.test(spoken))throw new Error('Hindi speech is missing. This response was not taught.');
  // The spoken target is Hindi regardless of visible text. Count letters only,
  // not vowel marks/punctuation, so an isolated matra cannot satisfy this gate.
  const letters=[...spoken].filter(char=>/\p{L}/u.test(char));
  const hindiLetters=letters.filter(char=>/[\u0900-\u097F]/u.test(char)).length;
  if(!letters.length||hindiLetters/letters.length<0.2)throw new Error('Insufficient Devanagari in Hindi speech. This response was not taught.');
 }
 return answer;
}

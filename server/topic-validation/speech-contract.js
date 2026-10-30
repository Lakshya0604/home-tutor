// A script-presence guard, not translation, pronunciation, or semantic proof.
const DEV=/[\u0900-\u097F]/;
const ROMAN_HINDI=/\b(?:namaste|bachcho|bachchon|namaskar|suno|dekho|aaya|hai|hain|ho|hoga|hogi|hota|hoti|hote|ka|ki|ke|ko|mein|me|se|aur|ya|yeh|yahan|aap|hum|chalo|samajh|matlab|yaani|jaise|waise|kya|nahi|karo|karna|karte|liye|toh|bhi)\b/i;
export function validateSpeechScript(answer,language) {
 if(!['hinglish','hindi'].includes(language)) return answer;
 for(const sentence of answer?.sentences || []) {
  const text=String(sentence.text||'').trim();
  const speak=String(language==='hindi'?text:sentence.speak||'').trim();
  if(!text) throw new Error('Empty teaching sentence. This response was not taught.');
  if(language==='hinglish' && !speak) throw new Error('Hinglish voice text is missing. This response was not taught.');
  if((language==='hindi'||DEV.test(text)||ROMAN_HINDI.test(text))&&!DEV.test(speak)) throw new Error('Hindi voice text is not in Devanagari. This response was not taught.');
  if(ROMAN_HINDI.test(speak)) throw new Error('Roman Hindi remains in voice text. This response was not taught.');
  const devChars=(speak.match(/[\u0900-\u097F]/g)||[]).length;
  const romanChars=(speak.match(/[A-Za-z]/g)||[]).length;
  if((language==='hindi'||ROMAN_HINDI.test(text)||DEV.test(text)) && devChars/(devChars+romanChars)<0.2) throw new Error('Insufficient Devanagari in Hindi voice text. This response was not taught.');
  if(language==='hinglish' && ROMAN_HINDI.test(text) && speak===text) throw new Error('Roman Hinglish was copied into voice text. This response was not taught.');
 }
 return answer;
}

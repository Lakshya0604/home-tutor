import {teacherSchema} from './teacher-schema.js';
export function bilingualSchema(task) {
 const schema=teacherSchema(task,'hinglish'),fields=schema.properties.sentences.items.properties;
 if(task==='lesson'){schema.properties.sentences.minItems=4;schema.properties.sentences.description='At least 4 substantial explanatory sentences, totaling at least 45 English words across text fields. Normally use 8 to 24 sentences to explain each source idea, not a compressed summary. Keep every source condition and numerical premise.';}
 fields.text={type:'string',description:'Plain English visible teaching sentence. No Roman Hindi or Devanagari. Same meaning as speak.'};
 fields.speak={type:'string',description:'Natural simple Hindi spoken explanation equivalent to the English text. ALL Hindi words in Devanagari. English technical terms may remain Latin. No Roman Hindi, including disclaimers/checks.'};
 fields.board={type:'string',description:'English board note, or empty. No Hindi or Roman Hindi.'};
 return schema;
}

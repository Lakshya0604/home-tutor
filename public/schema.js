import {teacherSchema} from './teacher-schema.js';
export function bilingualSchema(task) {
 const schema=teacherSchema(task,'hinglish'),fields=schema.properties.sentences.items.properties;
 if(task==='lesson'){fields.teachingRole={type:'string',enum:['source_idea','explanation','worked_step','check'],description:'source_idea states supplied material; explanation unpacks the meaning or limitation in a distinct sentence; worked_step explains source-supported math; check is the final source-answerable question. Labels are not proof of correctness.'};schema.properties.sentences.items.required.push('teachingRole');schema.properties.sentences.minItems=8;schema.properties.sentences.description='At least 8 substantial explanatory sentences, including at least two distinct explanation sentences and one final check question, totaling at least 45 English words across text fields. Normally use 8 to 24 sentences to explain each source idea, not a compressed summary. Keep every source condition and numerical premise.';}
 fields.text={type:'string',description:'Plain English visible teaching sentence. No Roman Hindi or Devanagari. Same meaning as speak.'};
 fields.speak={type:'string',description:'Natural simple Hindi spoken explanation equivalent to the English text. ALL Hindi words in Devanagari. English technical terms may remain Latin. No Roman Hindi, including disclaimers/checks.'};
 fields.board={type:'string',description:'English board note, or empty. No Hindi or Roman Hindi.'};
 return schema;
}

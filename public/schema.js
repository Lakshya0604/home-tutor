import {teacherSchema} from './teacher-schema.js';
export function bilingualSchema(task) {
 const schema=teacherSchema(task,'hinglish'),fields=schema.properties.sentences.items.properties;
 fields.text={type:'string',description:'Plain English visible teaching sentence. No Roman Hindi or Devanagari. Same meaning as speak.'};
 fields.speak={type:'string',description:'Natural simple Hindi spoken explanation equivalent to the English text. ALL Hindi words in Devanagari. English technical terms may remain Latin. No Roman Hindi, including disclaimers/checks.'};
 fields.board={type:'string',description:'English board note, or empty. No Hindi or Roman Hindi.'};
 return schema;
}

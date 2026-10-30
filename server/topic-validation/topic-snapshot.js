import {validateTopic} from './topic-teaching.js';
export const TOPIC_PROMPT_VERSION=1;
export function validateSnapshot(snapshot,material,language) {
 if(snapshot==null)return null;
 if(!material||snapshot.version!==TOPIC_PROMPT_VERSION||snapshot.language!==language||!Number.isInteger(snapshot.unitId)||!material.units[snapshot.unitId]||JSON.stringify(snapshot).length>120000)throw Error('Saved topic response identity is invalid.');
 const d=validateTopic(snapshot.raw,material.units[snapshot.unitId],language);
 return {version:TOPIC_PROMPT_VERSION,language,unitId:snapshot.unitId,raw:snapshot.raw,teaching:d};
}
export function validateTopicState(state,material,language,snapshot) {
 if(!material)return;
 const i=state.chunkIndex,s=state.sentIndex,n=material.units.length;
 if(!Number.isInteger(i)||!Number.isInteger(s)||i<0||i>n||s<0)throw Error('Invalid topic progress indexes.');
 if(state.finished){if(i!==n||s!==0)throw Error('Finished topic progress must be at the final boundary.');}
 else if(i===n)throw Error('Final boundary requires finished progress.');
 if(s>0){const saved=validateSnapshot(snapshot,material,language);if(!saved||saved.unitId!==i||s>saved.raw.lesson.sentences.length)throw Error('Topic line index exceeds exact saved response.');}
 return true;
}

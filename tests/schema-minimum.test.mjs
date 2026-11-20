import test from 'node:test';
import assert from 'node:assert/strict';
import {bilingualSchema} from '../public/schema.js';
import {assertSchema} from '../public/schema-check.js';
import {validateCoverage} from '../public/lesson-quality.js';
const sentence={text:'This clear sentence explains the source idea carefully while preserving its conditions.',speak:'यह बात आसान तरीके से समझते हैं।',board:'',step:null,gesture:'explain',teachingRole:'explanation'};
const answer=n=>({title:'Source lesson',sentences:Array.from({length:n},()=>({...sentence})),diagram:null});
test('bilingual lesson schema advertises and enforces minimum eight-sentence teaching shape',()=>{const schema=bilingualSchema('lesson');assert.equal(schema.properties.sentences.minItems,8);assert.throws(()=>assertSchema(answer(7),schema),/Too few/);assert.doesNotThrow(()=>assertSchema(answer(8),schema));});
test('doubt retains concise reply contract',()=>{const schema=bilingualSchema('doubt');assert.equal(schema.properties.sentences.minItems,undefined);assert.doesNotThrow(()=>assertSchema({...answer(1),sentences:[Object.fromEntries(Object.entries({...sentence,evidence:[]}).filter(([k])=>k!=='teachingRole'))]},schema));});
test('short explanations remain rejected rather than lowering teaching bar',()=>{const a=answer(4);a.sentences.forEach(s=>s.text='Too brief.');assert.throws(()=>validateCoverage(a,'Resistance opposes current.'),/incomplete explanation/);});
test('lesson with an entirely empty board and no diagram is rejected',async()=>{const a=base();a.sentences.forEach(s=>{s.board='';s.step=null;});await assert.rejects(attempt(a),/board completely empty/);});
test('deliberately boardless sentences stay allowed when the lesson has board content or a diagram',async()=>{await assert.doesNotReject(attempt(base()));const a=base();a.sentences.forEach(s=>{s.board='';s.step=null;});a.diagram={type:'flow',title:'Survey roles',steps:['Population','Sample']};await assert.doesNotReject(attempt(a));});
test('array maxItems applies only when supplied',()=>{assert.throws(()=>assertSchema([1,2],{type:'array',maxItems:1,items:{type:'number'}}),/Too many/);assert.doesNotThrow(()=>assertSchema([1,2],{type:'array',items:{type:'number'}}));});

import {prepareLesson} from '../public/teaching-language.js';
import {lessonMessages,doubtMessages,TEACHING_METHOD} from '../public/bilingual-prompts.js';

const source='A sample is a selected group within a population. A population is the full group to describe. A large sample alone does not guarantee representation.';
const idea=(text,teachingRole='source_idea')=>({text,speak:'यह बात स्रोत की सीमा को सरल भाषा में समझाती है।',board:'',step:null,gesture:'explain',teachingRole});
const base=()=>({title:'Survey concepts',sentences:[{...idea('A sample is a selected group within a population.'),board:'Sample = selected group'},idea('The selected group is the part whose answers are recorded, not every member of the full group.','explanation'),idea('A population is the full group to describe.'),idea('The full group and the people actually answering are different roles in a survey.','explanation'),idea('A large sample alone does not guarantee representation.'),idea('Having more answers and having representative answers are different claims.'),idea('The limit in the source concerns what sample size alone can tell us.'),{...idea('Does a large sample alone guarantee representation?','check'),speak:'क्या केवल बड़ा नमूना प्रतिनिधित्व की गारंटी देता है?'}],diagram:null});
const attempt=a=>prepareLesson({language:'hindi',source,chat:async()=>JSON.stringify(a),options:{}});
test('complete labeled teaching shape remains subject to existing validators',async()=>{await assert.doesNotReject(attempt(base()));});
test('two explanation labels cannot replace a final question',async()=>{const a=base();a.sentences.at(-1).text='This concludes the lesson.';await assert.rejects(attempt(a),/final understanding/);});
test('paraphrase-only lessons remain rejected',async()=>{const a=base();a.sentences[1].text='A sample is a selected group within a population.';await assert.rejects(attempt(a),/repeated source lines/);});
test('a stray verbatim sentence mislabeled as explanation is tolerated when two real explanations exist',async()=>{const a=base();a.sentences.splice(4,0,{...idea('A large sample alone does not guarantee representation.','explanation')});await assert.doesNotReject(attempt(a));});
test('too few explanation labels stop the lesson',async()=>{const a=base();a.sentences[1].teachingRole='source_idea';await assert.rejects(attempt(a),/distinct explanations/);});

test('review question cannot introduce new numerical givens',async()=>{const a=base();a.sentences.at(-1).text='Would 1,000 answers guarantee representation?';await assert.rejects(attempt(a),/invented numerical inputs/);});
test('review question cannot drift to concepts absent from the source',async()=>{const a=base();a.sentences.at(-1).text='What do validation accuracy and generalization suggest about deployment?';await assert.rejects(attempt(a),/left the source concepts/);});
test('review question may rephrase source concepts with normal morphology',async()=>{const a=base();a.sentences.at(-1).text='Why does a large sample not guarantee a representative result?';await assert.doesNotReject(attempt(a));});
test('review question that drops the source hedge onto new wording is rejected',async()=>{const a=base();a.sentences.at(-1).text='Why do random selection and enough responses improve the sample ability to mirror the population?';await assert.rejects(attempt(a),/left the source concepts/);});
test('single mild rephrase word in a review question stays allowed',async()=>{const a=base();a.sentences.at(-1).text='Does a large sample alone guarantee a true picture of the population?';await assert.doesNotReject(attempt(a));});
test('ordinary probe verbs and modals (reached, possible, ensure) are not concept drift',async()=>{const a=base();a.sentences.at(-1).text='Does a large sample alone ensure the survey has reached the best possible representation?';await assert.doesNotReject(attempt(a));});
test('modal adverbs probing a source condition are not treated as concept drift',async()=>{const a=base();a.sentences.at(-1).text='If a sample is selected randomly, does it necessarily guarantee representation?';await assert.doesNotReject(attempt(a));});

test('lesson asks for explanations beside source ideas, limits and a source-answerable check',()=>{const m=lessonMessages({source:'Synthetic source.'});assert.ok(m[0].content.includes(TEACHING_METHOD));for(const phrase of ['A synonym, translation, repeated sentence','what the condition requires','observed evidence','one specific understanding question','never add a new scientific rule'])assert.ok(m[0].content.includes(phrase));assert.equal(m[1].content,'SOURCE RANGE:\nSynthetic source.');});
test('lesson method does not expand the concise doubt contract',()=>{const m=doubtMessages({question:'Synthetic?',parts:[]});assert.ok(!m[0].content.includes(TEACHING_METHOD));assert.ok(m[0].content.includes('concise useful sentences'));});

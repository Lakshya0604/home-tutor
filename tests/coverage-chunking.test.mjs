import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyChunks, sectionTopics } from '../public/progressive.js';
import { validateCoverage } from '../public/lesson-quality.js';

const unit = (h, body) => `${h}\n\n${body}`;
const body1 = 'A survey records answers from a sample, which is a selected group within a population. A population is the full group that the survey wants to describe. The sample is the part that actually answers the questions in the survey. '.repeat(4);
const body2 = 'During training, the loss values can drop from 10 to 5, then to 2 and finally 1.1. When the loss stops changing much and settles near a value, we say the training has converged toward a stable value. '.repeat(4);

test('a heading never ends a chunk orphaned from its body', () => {
  const chunks = legacyChunks(unit('Unit 1: Samples', body1) + '\n\n' + unit('Unit 2: Loss', body2));
  for (const c of chunks.slice(0, -1)) {
    const lines = c.split('\n').map(x => x.trim()).filter(Boolean);
    assert.ok(!/^(?:chapter|unit|section|topic)\s+[\dIVX]+/i.test(lines.at(-1)), 'chunk ends on a heading');
  }
  const topics = sectionTopics(chunks);
  assert.deepEqual(topics.map(t => t.title), ['Unit 1: Samples', 'Unit 2: Loss']);
});

test('a lone heading chunk is never emitted by itself', () => {
  const chunks = legacyChunks(unit('Unit 1: Samples', body1) + '\n\n' + unit('Unit 2: Loss', body2));
  for (const c of chunks) assert.ok(c.split('\n').map(x=>x.trim()).filter(Boolean).length > 1);
});

test('short single-section sources keep one chunk', () => {
  assert.equal(legacyChunks('A survey records answers from a sample. A population is the full group described.').length, 1);
});

const src = 'A survey records answers from a sample, which is a selected group within a population. A population is the full group that the survey wants to describe. During training, the loss values can drop from ten to five, then to two and finally one. When the loss stops changing much and settles near a value, we say the training has converged.';
const s = (text, board='') => ({text, board, speak: 'x'});
const theme1only = {title:'t', diagram:null, sentences:[
  s('A survey records answers from a sample, which is a selected group within a population.','sample'),
  s('A population is the full group that the survey wants to describe.','population'),
  s('A sample means the selected group actually answering the questions.'),
  s('The population means everyone the survey wants to describe.'),
  s('Check: Is a sample the whole population?')]};
const fullLesson = {title:'t', diagram:null, sentences: theme1only.sentences.concat([
  s('During training, the loss values can drop from ten to five, then to two and finally one.','loss falling'),
  s('When the loss stops changing much and settles near a value, we say the training has converged.','converged'),
  s('Loss here means how far the predictions are from the correct answers.'),
  s('Converged means the loss has settled and stopped changing much.')])};

test('a lesson that silently drops a whole source theme is rejected', () => {
  assert.throws(() => validateCoverage(theme1only, src), /omitted source ideas/);
});
test('a lesson covering all source themes passes the coverage floor', () => {
  assert.doesNotThrow(() => validateCoverage(fullLesson, src));
});

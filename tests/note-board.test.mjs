import test from 'node:test';
import assert from 'node:assert/strict';
import {noteBoardText} from '../public/note-board.js';
test('keeps uncertainty and negation from complete English, not categorical summary',()=>{
 for(const sentence of [
  {text:'This does not mean the cart moved at 3 metres per second at every instant.',board:'The cart does not move at 3 m/s at every instant.'},
  {text:'If selected randomly AND enough people respond, results may better represent the population.',board:'Random sampling guarantees accurate representation.'},
  {text:'Equal mean and median here does not establish that they are the same calculation.',board:'Mean = median.'}
 ]) { const raw=structuredClone(sentence);assert.equal(noteBoardText(sentence),sentence.text);assert.deepEqual(sentence,raw); }
});
test('keeps deliberate no-board sentences blank and preserves topic mode behavior',()=>{
 assert.equal(noteBoardText({text:'Spoken context.',board:''}),'');
 assert.equal(noteBoardText({text:'Topic explanation.',board:'Topic board'},true),'Topic board');
});
test('keeps step payload and raw generation unchanged',()=>{
 const s={text:'Speed equals 60 / 12 = 5 metres per second.',board:'v = 5 m/s',step:{math:'v = 60/12 = 5',from:'distance/time'}};
 const raw=JSON.stringify(s);assert.equal(noteBoardText(s),s.text);assert.equal(JSON.stringify(s),raw);
});

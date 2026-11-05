// Synthetic local UI regression, no actual inference or audio.
import{chromium}from'playwright';import fs from'node:fs';import path from'node:path';import http from'node:http';import assert from'node:assert/strict';
const root=path.resolve(new URL('../public/',import.meta.url).pathname),records={prepared:[],spoken:[],saved:[]};
const prepared=`export function spokenSentence(s,l){return s.speak;}export async function prepareLesson(){return{title:'Qualification display regression',diagram:null,sentences:[{text:'This does not mean the cart moved at 3 metres per second at every instant.',board:'The cart does not move at 3 m/s at every instant.',speak:'Synthetic speech one'},{text:'If respondents were selected randomly AND enough people responded, the results may better represent that population.',board:'Random sampling guarantees representation.',speak:'Synthetic speech two'},{text:'Hypothetical example: changing 4 to 10 gives (2 + 3 + 10) / 3 = 5, while the median remains 3.',board:'Mean equals median.',speak:'Synthetic speech three'}]};}export async function prepareDoubt(){throw Error('not in test');}`;
const tts=`export const PIPER={hindi:[],english:[]};export const voiceGroup=l=>l==='english'?'english':'hindi';export const sampleText=()=>'';export const deviceVoices=()=>[{voiceURI:'synthetic-hi',lang:'hi-IN',name:'Synthetic Hindi'},{voiceURI:'synthetic-en',lang:'en-US',name:'Synthetic English'}];export async function speakDevice(text){window.testSpoken.push(text);await new Promise(r=>window.testSpeechResolve=r);}export function stopAudio(){window.testSpeechResolve?.();}export async function synth(){throw Error('not in test')}export async function playBlob(){throw Error('not in test')}`;
const server=http.createServer(async(q,r)=>{const u=q.url.split('?')[0];if(u==='/teaching-language.js'){r.setHeader('Content-Type','text/javascript');return r.end(prepared)}if(u==='/tts.js'){r.setHeader('Content-Type','text/javascript');return r.end(tts)}if(u==='/config.js'){r.setHeader('Content-Type','text/javascript');return r.end("export const API_BASE='';")}if(u==='/api/lessons'){r.setHeader('Content-Type','application/json');if(q.method==='POST'){let b='';for await(const c of q)b+=c;records.saved.push(JSON.parse(b));return r.end('{"id":"synthetic-local-lesson"}')}return r.end('[]')}const p=path.join(root,u==='/'?'index.html':u);if(!fs.existsSync(p))return r.writeHead(404).end();r.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');r.end(fs.readFileSync(p))});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{b=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--no-sandbox']});const page=await b.newPage({viewport:{width:1200,height:900}});await page.route('https://**',r=>r.abort());await page.addInitScript(()=>{window.testPrepared=[];window.testSpoken=[];localStorage.setItem('ht.token','synthetic-local');localStorage.setItem('ht.user','{"name":"Test learner"}');});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__app);const source='Synthetic source for display identity only.';await page.locator('#src').fill(source);await page.locator('#btnStart').click();await page.waitForFunction(()=>window.testSpoken.length===1);for(let i=0;i<2;i++){await page.evaluate(()=>window.testSpeechResolve());await page.waitForFunction(n=>window.testSpoken.length===n,i+2);}await page.locator('#btnPause').click();const board=await page.locator('#board').innerText();const state=await page.evaluate(()=>window.__app.S.data[0]);for(const line of state.sentences)assert.ok(board.includes(line.text));assert.ok(!board.includes('guarantees representation'));assert.ok(!board.includes('The cart does not move'));assert.equal(state.sentences[0].board,'The cart does not move at 3 m/s at every instant.');// Resume runs showBoard from retained cursor, not a direct helper invocation.
const rawBefore=JSON.stringify(state);
const cursor=await page.evaluate(()=>({idx:window.__app.S.idx,sent:window.__app.S.sent}));
assert.equal(cursor.sent,2);
await page.locator('#btnResume').click();
await page.waitForFunction(()=>window.testSpoken.length===4);
assert.equal(await page.locator('#board').innerText(),board);
assert.equal(await page.evaluate(()=>JSON.stringify(window.__app.S.data[0])),rawBefore);
assert.deepEqual(await page.evaluate(()=>({idx:window.__app.S.idx,sent:window.__app.S.sent})),cursor);
await page.locator('#btnPause').click();
// Replaying interrupted audio must not append the same teaching line again.
assert.equal(await page.locator('#log .msg.t').count(),3);
assert.deepEqual(await page.locator('#log .msg.t').allTextContents(),state.sentences.map(s=>s.text));
await page.locator('#btnResume').click();
await page.waitForFunction(()=>window.testSpoken.length===5);
await page.locator('#btnPause').click();
assert.equal(await page.locator('#log .msg.t').count(),3);
await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#board').innerText(),board);
if(process.env.SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'resumed-note-board-mobile.png'),fullPage:true});await page.setViewportSize({width:1200,height:900});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'resumed-note-board-desktop.png'),fullPage:true});}
// A new lesson clears prior rows and must create its own first line.
await page.locator('#btnStart').click();
await page.waitForFunction(()=>window.testSpoken.length===6);
assert.equal(await page.locator('#log .msg.t').count(),1);
await page.locator('#btnPause').click();
await page.locator('#btnResume').click();
await page.waitForFunction(()=>window.testSpoken.length===7);
await page.locator('#btnPause').click();
assert.equal(await page.locator('#log .msg.t').count(),1);
console.log(JSON.stringify({board,rawUnchanged:true,resumeRebuild:true,sameCursor:true,transcriptUnique:true,actualProviderCalls:0,actualAudio:false,productionWrites:0}));}finally{await b?.close();server.close()}

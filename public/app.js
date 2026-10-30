import {pdfTopicLines} from './pdf-lines.js';
import {validateSnapshot,validateTopicState,TOPIC_PROMPT_VERSION} from './topic-snapshot.js';
import {materialMeta,validateMaterial,visibleUnitList} from './material.js';
import {prepareTopic} from './topic-teaching.js';
import { sectionTopics, checkActive } from './progressive.js';
import { boardMath } from './board-math.js';
import { renderReferences } from './evidence.js';
import { prepareLesson, prepareDoubt, spokenSentence } from './teaching-language.js';
import { createTeacher } from './teacher.js';
import { renderDiagram } from './diagram.js';
import { requireLogin, logout, user } from './auth.js';
import { cfg, saveCfg, providerDefaults, chat, chatJSON, pacing } from './llm.js';
import { saveProgress, listLessons, getLesson } from './progress.js';
import { buildIndex, search } from './rag.js';
import { testPrompt, gradePrompt } from './prompts.js';
import { PIPER, voiceGroup, sampleText, synth, playBlob, stopAudio, deviceVoices, speakDevice } from './tts.js';

const $ = id => document.getElementById(id);
const svgTeacher = createTeacher($('teacher'));
const teacher = { impl: svgTeacher, gesture(g) { this.impl.gesture(g); }, speaking(v) { this.impl.speaking(v); }, mouthLevel(v) { this.impl.mouthLevel?.(v); } };
// Four human-style 3D teachers (VTubeMe, CC BY 4.0). Falls back to the drawn teacher when WebGL or the model fails.
const AVATARS = [
  { id: 'ember', name: 'Ember', file: 'assets/1-teacher.vrm' },
  { id: 'nova', name: 'Nova', file: 'assets/1-nova.vrm' },
  { id: 'kai', name: 'Kai', file: 'assets/2-kai.vrm' },
  { id: 'sky', name: 'Sky', file: 'assets/3-sky.vrm' },
];
let avatarSeq = 0;
async function loadAvatar(id) {
  const av = AVATARS.find(x => x.id === id) || AVATARS[0]; const my = ++avatarSeq;
  try {
    const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
    const { createTeacher3D } = await import('./teacher3d.js');
    $('teacher3d').classList.add('loading');
    const t3 = await createTeacher3D($('teacher3d'), av.file);
    if (my !== avatarSeq) { t3.dispose(); return; }
    if (teacher.impl && teacher.impl.dispose) teacher.impl.dispose();
    $('teacher').style.display = 'none'; $('teacher3d').hidden = false; teacher.impl = t3; window.__teacher3d = av.id;
    $('credit').hidden = false; $('credit').innerHTML = `Teacher model "${av.name}" by <a href="https://vtubeme.com/free-vrm-avatars/${av.id}" target="_blank" rel="noopener">VTubeMe</a>, CC BY 4.0`;
    try { localStorage.setItem('hometutor.avatar', av.id); } catch {}
  } catch (e) { console.warn('3D teacher unavailable, keeping the current teacher:', e && e.message); }
  finally { $('teacher3d').classList.remove('loading'); }
}
{ const sel = $('avatar'); let saved = 'ember'; try { saved = localStorage.getItem('hometutor.avatar') || 'ember'; } catch {} sel.value = AVATARS.some(x => x.id === saved) ? saved : 'ember'; sel.onchange = () => loadAvatar(sel.value); loadAvatar(sel.value); }
const S = { chunks: [], data: [], idx: 0, sent: 0, run: 0, source: '', playing: false, started: false, titles: [], shown: new Set(), busy: false, testReady: false, qa: null };
const lang = () => $('lang').value;
const rate = () => parseFloat($('rate').value);
const LOADING = /^(Reading the whole|Preparing|Pacing|Planning|Thinking|Looking)/;
const status = t => { $('status').textContent = t; const p = $('prep'); if (p) { p.hidden = !LOADING.test(t); $('prepText').textContent = t; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let saveBusy = false;
async function persist(nextSent, finished) {
  if (!S.source || saveBusy) return; saveBusy = true;
  try {
    const payload={ ...(S.material?{material:S.material,topicSnapshot:S.data[S.idx]?.provenance?{version:TOPIC_PROMPT_VERSION,language:lang(),unitId:S.idx,raw:S.data[S.idx].strictRaw}:null}:{}), id: S.lessonId, title: S.title0 || S.source.slice(0, 60), lang: lang(), source: S.source, chunkIndex: S.idx, sentIndex: nextSent ?? S.sent, finished: !!finished };
    if(S.material){validateTopicState(payload,S.material,lang(),payload.topicSnapshot);if(new TextEncoder().encode(JSON.stringify(payload)).length>280000)throw Error('Topic progress exceeds safe save size; keep this tab open or use smaller topics.');}
    const j=await saveProgress(payload);
    if (j.id) S.lessonId = j.id;
  } catch(e) { if(S.material)say('s warn','Topic progress was not saved: '+e.message+'. Keep this tab open; exact reload resume is not guaranteed.'); } finally { saveBusy = false; }
}

// ---------- chat log ----------
function say(cls, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; $('log').appendChild(d); $('log').scrollTop = 1e9; return d; }

// ---------- voices ----------
const isNatural = v => /natural|online|google/i.test(v.name);
function voiceOptions() {
  const g = voiceGroup(lang()), out = [], want = g === 'english' ? 'en' : 'hi';
  const dev = deviceVoices().filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(want));
  dev.sort((a, b) => isNatural(b) - isNatural(a));
  for (const v of dev) out.push({ value: 'dev:' + v.voiceURI, nat: isNatural(v), label: (isNatural(v) ? '⭐ ' : '💻 ') + v.name + (isNatural(v) ? ' - natural online voice (browser)' : ' - device voice (quality varies)') });
  for (const v of PIPER[g]) out.push({ value: 'piper:' + v.id, label: '🧠 ' + v.label + ' - in-browser neural (flatter, fallback)' });
  return out;
}
function fillVoices() {
  const g = voiceGroup(lang()), saved = localStorage.getItem('aiteacher.voice.' + g);
  const opts = voiceOptions(); $('voice').innerHTML = '';
  for (const o of opts) { const e = document.createElement('option'); e.value = o.value; e.textContent = o.label; $('voice').appendChild(e); }
  if (!opts.length) { const e = document.createElement('option'); e.value = ''; e.textContent = 'No voice found in this browser'; $('voice').appendChild(e); }
  if (saved && opts.some(o => o.value === saved)) $('voice').value = saved;
  const nat = opts.find(o => o.nat);
  $('voice').title = nat ? 'Natural browser voices found - best quality' : 'No natural browser voice found. For the best Hindi/Hinglish voice open this site in Microsoft Edge (Madhur / Swara / Neerja natural voices) or Chrome on Android.';
  if (!saved && nat) $('voice').value = nat.value;
}
$('voice').onchange = () => localStorage.setItem('aiteacher.voice.' + voiceGroup(lang()), $('voice').value);
$('lang').onchange = () => { if(S.playing || S.pending) $('btnPause').click(); S.data=[]; S.prefetchError=null; fillVoices(); localStorage.setItem('aiteacher.lang', lang()); };
speechSynthesis?.addEventListener?.('voiceschanged', fillVoices);
if (localStorage.getItem('aiteacher.lang')) $('lang').value = localStorage.getItem('aiteacher.lang');
{ const r = localStorage.getItem('aiteacher.rate'); if (r && [...$('rate').options].some(o => o.value === r)) $('rate').value = r; }
$('rate').onchange = () => localStorage.setItem('aiteacher.rate', $('rate').value);
fillVoices();

let progressNote = null;
const onProg = p => { if (p && p.total) status(`Downloading voice model ${Math.round(100 * p.loaded / p.total)}% (one time, then cached)`); };
async function speakText(text) {
  text = String(text).replace(/\*(?:waves?|nods?|points?|smiles?|gestures?)\*/gi, '').replace(/\[(?:waves?|nods?|points?|smiles?|gestures?)\]/gi, '').trim();
  if (!text) return;
  const v = $('voice').value;
  if (!v) throw new Error('No voice available for this language in this browser. Open Home Tutor in Microsoft Edge on a computer (natural online voices), or switch the language to English.');
  teacher.speaking(true);
  try {
    if (v.startsWith('dev:')) { status('Speaking (device voice)'); await speakDevice(text, v.slice(4), lang() === 'english' ? 'en-IN' : 'hi-IN', rate()); }
    else {
      status('Preparing voice…');
      const blob = await synth(text, v.slice(6), onProg);
      status('Speaking…');
      window.__onClip?.(blob);
      await playBlob(blob, rate(), l => teacher.mouthLevel(l));
    }
  } finally { teacher.mouthLevel(null); teacher.speaking(false); status(S.playing ? 'Teaching…' : 'Paused'); }
}
$('btnPreview').onclick = async () => {
  stopAudio(); teacher.gesture('explain');
  try { await speakText(sampleText(lang())); } catch (e) { say('s warn', 'Voice preview failed: ' + e.message); }
  teacher.gesture('rest');
};

// ---------- settings ----------
function loadSettings() { const c = cfg(); $('provider').value = c.provider || 'server'; $('model').value = c.model || ''; $('baseUrl').value = c.baseUrl || ''; $('apiKey').value = c.apiKey || ''; syncSettingsUI(); }
function syncSettingsUI() { const p = $('provider').value; $('lblBase').hidden = p !== 'custom'; $('model').placeholder = providerDefaults[p].model || 'model name'; }
$('provider').onchange = syncSettingsUI;
$('btnSettings').onclick = () => { loadSettings(); $('settings').showModal(); };
$('saveSettings').onclick = () => saveCfg({ provider: $('provider').value, model: $('model').value.trim(), baseUrl: $('baseUrl').value.trim(), apiKey: $('apiKey').value.trim() });

// ---------- source loading ----------
let lastPdfText=null;
async function readPdf(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '', topicText='';
  const pages = Math.min(doc.numPages, 60);
  for (let i = 1; i <= pages; i++) { const c = await (await doc.getPage(i)).getTextContent(); text += c.items.map(x => x.str).join(' ') + '\n\n'; topicText+=pdfTopicLines(c.items)+'\n\n'; }
  let ocr = false;
  if (text.replace(/\s/g, '').length < 200) { // scanned PDF: free in-browser OCR (Tesseract, Hindi + English), first 12 pages
    ocr = true; text = '';
    const { createWorker } = (await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js')).default;
    const w = await createWorker('hin+eng');
    const n = Math.min(doc.numPages, 12);
    for (let i = 1; i <= n; i++) {
      $('srcInfo').textContent = `Scanned PDF: running OCR on page ${i} of ${n} (first run downloads the language data)…`;
      const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 2 }), cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      text += (await w.recognize(cv)).data.text + '\n\n';
    }
    await w.terminate();
    return { text, pages: n, total: doc.numPages, ocr };
  }
  return { text, topicText, pages, total: doc.numPages, ocr };
}
$('pdf').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  $('srcInfo').textContent = 'Reading PDF…';
  try {
    const r = await readPdf(f);
    if (r.text.replace(/\s/g, '').length < (r.ocr ? 20 : 200)) { $('srcInfo').textContent = 'No text could be read from this PDF, even with OCR. Paste the text instead.'; return; }
    lastPdfText={notes:r.text.trim(),topics:(r.topicText||r.text).trim()};$('src').value=($('materialMode').value==='notes'?lastPdfText.notes:lastPdfText.topics);previewMaterial(); $('srcInfo').textContent = `${r.ocr ? 'OCR (may contain mistakes): ' : ''}PDF read: ${r.pages}${r.total > r.pages ? ' of ' + r.total : ''} pages, ${r.text.length} characters. Check the text below before starting.`;
    if (r.total > r.pages) { const m = `Only the first ${r.pages} of ${r.total} pages were read${r.ocr ? ' (OCR limit)' : ''}. Paste the remaining pages separately to learn them.`; $('srcInfo').textContent += ' ' + m; say('s warn', m); }
  } catch (err) { $('srcInfo').textContent = 'Could not read PDF: ' + err.message; }
};
$('btnVideo').onclick = () => {
  const u = $('videoUrl').value.trim(); if (!u) return;
  say('s warn', 'Video link noted, but a browser app cannot fetch a video\'s transcript reliably (YouTube blocks it). Open the video\'s "Show transcript", copy it, and paste it in the box - I will teach from that.');
};

function chunkText(text) { return legacyChunks(text); }

function legacyChunks(t) {
  const paras = t.replace(/\r/g, '').split(/\n\s*\n|\n(?=\s*(?:\d+[\.\)]|[-•*]|Unit|UNIT|Chapter))/).map(x => x.trim()).filter(Boolean);
  const out = []; let cur = '';
  for (const p of paras) {
    if ((cur + '\n' + p).length > 900 && cur) { out.push(cur); cur = p; } else cur = cur ? cur + '\n' + p : p;
    while (cur.length > 1400) { const cut = cur.lastIndexOf('. ', 1000); const k = cut > 300 ? cut + 1 : 1000; out.push(cur.slice(0, k)); cur = cur.slice(k).trim(); }
  }
  if (cur) out.push(cur); return out;
}

// ---------- topics ----------
const topicOf = i => (S.topics || []).find(t => i >= t.from && i <= t.to);

let prepLabel = '';
pacing.onWait = seconds => { if(S.playing && !S.background) status(`${prepLabel || 'Preparing next part'} - free AI spacing ${seconds} s remaining…`); };
function planTopics() {
  if(S.material) {S.topics=S.material.units.map(u=>({title:u.title,from:u.id,to:u.id,plan:[]}));say('s','Topics provided by you. Explanations are generated teacher knowledge, not facts quoted from your topic list. Only the current topic is prepared first; one next topic may prepare during speech.');return true;}
  S.topics = sectionTopics(S.chunks); S.planFull = false; S.notRead = [];
  say('s', `Indexed all ${S.chunks.length} source parts locally in ${S.topics.length} source section(s). AI preparation is progressive: later parts have not yet been read by the AI. Preparing part ${S.idx+1} first; one next part may prepare while teaching. Section boundaries follow explicit source headings where present; otherwise the original text remains one source section. No whole-book AI reading is implied.`);
  return true;
}
let preparation = null;
function cancelPreparation() { preparation?.abort(); preparation=null; S.background=false; S.pending=null; }
function prefetchNext(i, signal) {
  if(i>=S.chunks.length || S.data[i] || S.pending?.index===i || S.prefetchError || signal.aborted) return;
  S.background=true;
  loadChunk(i,signal).catch(error=> {
    if(signal.aborted) return;
    S.prefetchError={ index:i, error };
    say('s warn', `Next part preparation stopped: ${error.message}. The current prepared part can continue. No more background calls will be made; Resume can retry when ready.`);
  }).finally(()=> { if(!signal.aborted) S.background=false; });
}

// ---------- lesson ----------
function loadChunk(i, signal) {
  checkActive(signal);
  if(i>=S.chunks.length) return null;
  if(S.data[i]?.sentences) return Promise.resolve(S.data[i]);
  if(S.pending?.index===i && S.pending.signal===signal) return S.pending.promise;
  const source=S.chunks[i], language=lang();
  const pending={index:i, signal};
  pending.promise=(S.material?prepareTopic(S.material.units[i],language,chat,{signal}):prepareLesson({language, source, previousTitles:S.titles.slice(-4), topic:topicOf(i)?.title, plan:[...(topicOf(i)?.plan || []), 'Source heading map (navigation only, not evidence): '+S.topics.map(t=>t.title).join('; ').slice(0,1600), 'Teach the exact supplied source range only. A later source range has not been read; do not claim to have read or taught it.'],chat,chatJSON,options:{signal}})).then(data=> {
    checkActive(signal);
    S.data[i]=data;
    return data;
  }).finally(()=> { if(S.pending===pending) S.pending=null; });
  S.pending=pending;
  return pending.promise;
}
function showBoard(d, upTo) {
  $('board').innerHTML = ''; $('boardTitle').textContent = d.title || 'Board';
  d.sentences.slice(0, upTo + 1).forEach((s, k) => { if ((s.board || s.step) && S.shown.has(k)) addBoard(s.board, s.step); });
  renderDiagram($('diagram'), S.shown.has('dia') ? d.diagram : null);
}
function addBoard(t, step, cls) {
  const e = document.createElement('div'); e.className = 'item' + (cls ? ' ' + cls : '');
  t=boardMath(t); if(step)step={...step,math:boardMath(step.math)};
  const norm = x => String(x || '').replace(/[\s*]/g, '').toLowerCase();
  if (t && !(step && step.math && norm(t) === norm(step.math))) { const m = document.createElement('div'); m.textContent = t; e.appendChild(m); }
  if (step && step.math) {
    const k = document.createElement('div'); k.className = 'step'; k.textContent = String(step.math).slice(0, 160); e.appendChild(k);
    if (step.from) { const f = document.createElement('div'); f.className = 'from'; f.textContent = 'from: ' + String(step.from).slice(0, 120); e.appendChild(f); }
  }
  $('board').appendChild(e); $('board').scrollTop = 1e9;
}
function setControls() {
  $('btnStart').disabled = !!S.playing || !!S.busy;
  $('btnPause').disabled = !S.playing && !S.pending; $('btnResume').disabled = S.playing || !S.started || S.finished;
  $('btnDoubt').disabled = !S.started || S.busy; $('btnVoiceAsk').disabled = !S.started || S.busy; $('btnResume').textContent = S.topicPause ? 'Next section' : 'Resume'; $('btnTest').disabled = !S.testReady || !!S.material;
  $('progress').textContent = S.started ? (S.topicPause ? `Completed part ${Math.min(S.idx,S.chunks.length)} of ${S.chunks.length}` : `Part ${Math.min(S.idx + 1, S.chunks.length)} of ${S.chunks.length}`) : '';
}
async function runLesson() {
  if(S.playing) return;
  if(!preparation || preparation.signal.aborted) preparation=new AbortController(); const signal=preparation.signal;
  const token = ++S.run; S.playing = true; S.topicPause = false; setControls();
  try {
    if (!S.topics) planTopics();
    while (S.idx < S.chunks.length) {
      checkActive(signal);
      if(S.prefetchError?.index===S.idx) { const error=S.prefetchError.error; S.prefetchError=null; throw error; }
      S.background=false;
      prepLabel=`Preparing part ${S.idx+1} of ${S.chunks.length}`;
      status(prepLabel+'…');
      const d = await loadChunk(S.idx,signal);
      if (token !== S.run) return;
      // Prepare only the part being taught. No speculative provider calls.
      if (S.sent === 0) { S.shown = new Set(); S.titles.push(d.title || ''); if (!S.title0 && d.title) S.title0 = d.title; }
      if(S.material && S.sent===0)say('s','Generated teacher explanation. Local plan: '+d.plan.join(' → '));
      showBoard(d, S.sent);
      for (; S.sent < d.sentences.length; S.sent++) {
        if (token !== S.run) return;
        const s = d.sentences[S.sent];
        teacher.gesture(['explain', 'point', 'wave', 'think', 'nod'].includes(s.gesture) ? s.gesture : 'explain');
        if (!S.shown.has(S.sent)) { S.shown.add(S.sent); if (s.board || s.step) addBoard(s.board, s.step); }
        if ((S.sent === d.sentences.length - 1 || /table|diagram|map|chart|graph|axis|axes|तालिका|नक्शा|ग्राफ/i.test(s.text)) && d.diagram && !S.shown.has('dia')) { S.shown.add('dia'); renderDiagram($('diagram'), d.diagram); }
        const tx = spokenSentence(s,lang());
        say('t', s.text);
        // Queue only the next source range once playback of this prepared part begins.
        await speakText(tx);
        // A successful first spoken line establishes playback before bounded prefetch.
        if(token===S.run) prefetchNext(S.idx+1,signal);
        if (token !== S.run) return;
        persist(S.sent + 1);
      }
      S.idx++; S.sent = 0; persist(0);
      const tp = topicOf(S.idx - 1);
      if (tp && S.idx > tp.to && S.idx < S.chunks.length) {
        S.playing = false; S.topicPause = true; teacher.gesture('rest'); status('Source section finished - paused'); setControls();
        say('s', `Source section "${tp.title}" is finished. Ask any doubt (type or by voice), then press Next section.`);
        return;
      }
      setControls();
    }
    S.playing = false; S.finished = true; S.testReady = true; teacher.gesture('wave'); status('Lesson finished'); setControls(); persist(0, true);
    say('s', S.material?'Topic teaching finished. Topic-mode assessments are not yet implemented; no source-grounded test is claimed.':'Lesson finished. Press "Unit test" when ready.');
    await sleep(1500); teacher.gesture('rest');
  } catch (e) {
    if (token !== S.run) return;
    cancelPreparation(); S.playing = false; setControls(); teacher.gesture('rest'); status('Stopped');
    say('s warn', 'Lesson stopped: ' + e.message + '  (Press Resume to retry, or check AI settings.)');
  }
}
$('btnStart').onclick = () => {
  if(S.playing || S.busy) return;
  const t = $('src').value.trim();
  if ($('materialMode').value==='notes' && t.length < 40) { say('s warn', 'Paste some notes first (at least a few lines).'); return; }
  if (!$('srcInfo').textContent.includes('PDF')) $('srcInfo').textContent = `Source loaded: ${t.length} characters.`;
  if (!$('voice').value) { say('s warn', 'No voice is available for this language in this browser. Open Home Tutor in Microsoft Edge on a computer (it has natural online Hindi voices), or switch the language to English.'); return; }
  let material=null;try{material=materialMeta(t,$('materialMode').value);}catch(e){say('s warn',e.message);return;}
  cancelPreparation(); stopAudio(); S.run++;
  const capped = t.slice(0, 60000); if (t.length > 60000) say('s warn', 'Text is very long; teaching the first 60,000 characters only.');
  Object.assign(S, { source: capped, material, chunks: material?material.units.map(u=>u.text):chunkText(capped), topics: null, topicPause: false, data: [], idx: 0, sent: 0, titles: [], shown: new Set(), started: true, finished: false, testReady: false, qa: null, prefetchError:null, lessonId: undefined, title0: '' });
  $('log').innerHTML = ''; $('board').innerHTML = ''; $('diagram').innerHTML = '';
  say('s', `Loaded ${capped.length} characters in ${S.chunks.length} parts. Teaching in ${$('lang').selectedOptions[0].textContent}, voice: ${$('voice').selectedOptions[0]?.textContent || 'none'}.`);
  if(material)say('s','Teaching outline (check original input if a PDF heading or problem is split incorrectly):\n'+visibleUnitList(material));
  runLesson();
};
$('btnPause').onclick = () => { cancelPreparation(); S.run++; S.playing = false; stopAudio(); teacher.speaking(false); teacher.gesture('rest'); status('Paused'); setControls(); };
$('btnResume').onclick = () => { if(S.playing || S.busy) return; S.prefetchError=null; $('doubtBox').hidden = true; runLesson(); };
$('btnDoubt').onclick = () => { $('btnPause').click(); $('doubtBox').hidden = false; $('doubtInput').focus(); say('s', 'Paused. Ask your doubt, then press Resume to continue from the same line.'); };
$('btnAsk').onclick = async () => {
  const q = $('doubtInput').value.trim(); if (!q) return; $('doubtInput').value = '';
  say('u', q); S.busy = true; setControls(); status('Thinking about your doubt…');
  try {
    const cur = Math.min(S.idx, S.chunks.length - 1);
    const rk = S.ragSource === S.source ? S.rag : (S.ragSource = S.source, S.rag = buildIndex(S.chunks));
    const all = search(rk, q + ' ' + (topicOf(cur)?.title || ''), 5);
    const hits = all.filter(h => h.part !== cur).slice(0, 3);
    const noEvidence = !!S.material || all.length === 0;
    const parts = hits.map(h => ({ part: h.part + 1, text: S.chunks[h.part].slice(0, 1400) }));
    if (noEvidence) say('s', 'Keyword search found no matching part in your document. That does not prove the notes lack the answer (different wording can be missed). The answer below could not be confirmed from your notes and is marked as outside your notes.');
    else if (hits.length) say('s', 'Looked through the whole document for this doubt: using part' + (hits.length > 1 ? 's ' : ' ') + hits.map(h => h.part + 1).join(', ') + ' plus the part being taught (keyword search, no AI).');
    else say('s', 'Keyword search matched only the part being taught (part ' + (cur + 1) + '); no other part of the document matched.');
    const d = await prepareDoubt({language:lang(),question:S.material?q+' [This is generated-topic teaching. The supplied entry is only a topic, not detailed factual notes. Answer as general teacher knowledge, outside provided notes; do not cite heading as factual evidence.]':q,source:S.chunks[cur] || S.source,parts:S.material?[]:parts,currentPart:cur+1,noEvidence,chat,chatJSON});
    const sents = (d.sentences || []).filter(s => s.text);
    $('board').innerHTML = ''; $('boardTitle').textContent = 'Doubt: ' + (d.title || q.slice(0, 40)); renderDiagram($('diagram'), d.diagram);
    if (d.references?.length) { const refHost = document.createElement('div'); $('log').append(refHost); renderReferences(refHost, d.references); }
    S.playing = true; const tok = ++S.run; setControls();
    for (const s of sents) {
      if (tok !== S.run) break;
      teacher.gesture(s.gesture || 'explain'); if (!s.derived?.checked && (s.step?.math || /[=²]/.test(s.text || ''))) addBoard(s.arithmeticChecks?.length ? 'Numeric equality checked only; units and explanation not automatically verified.' : 'Explanation/calculation: not automatically checked.'); if(s.derived?.checked) addBoard('Derived calculation: ' + s.derived.operation + ' = ' + s.derived.result + ' (arithmetic checked from quoted inputs)'); if (s.board || s.step) addBoard(s.board, s.step); say('t', s.text);
      await speakText(spokenSentence(s,lang()));
    }
    if (tok === S.run) { S.playing = false; teacher.gesture('rest'); }
    const cd = S.topicPause ? null : S.data[S.idx]; if (cd) showBoard(cd, S.sent);
    say('s', 'Doubt answered. Press Resume to continue the lesson, or ask another doubt.');
  } catch (e) { say('s warn', 'Could not answer: ' + e.message); }
  S.busy = false; S.playing = false; setControls(); status('Paused');
};
$('doubtInput').onkeydown = e => { if (e.key === 'Enter') $('btnAsk').click(); };
function listen() {
  cancelPreparation();
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { say('s warn', 'Voice input is not supported in this browser (Chrome or Edge on a computer work best). Type your doubt instead.'); $('doubtBox').hidden = false; return; }
  if (S.playing) $('btnPause').click(); else { cancelPreparation(); stopAudio(); }
  $('doubtBox').hidden = false;
  const r = new R(); r.lang = lang() === 'english' ? 'en-IN' : 'hi-IN'; r.interimResults = false; let got = false;
  r.onresult = e => { got = true; const t = e.results[0][0].transcript; $('doubtInput').value = t; status('Heard: ' + t.slice(0, 60)); $('btnAsk').click(); };
  r.onerror = e => say('s warn', 'Mic problem: ' + e.error + (e.error === 'not-allowed' ? ' (allow the microphone for this site, or type your doubt)' : '') + '. You can type your doubt instead.');
  r.onend = () => { if (!got && !S.busy) { status('Paused'); } };
  try { r.start(); status('Listening… ask your doubt'); say('s', 'Paused. Listening - speak your doubt now.'); } catch (err) { say('s warn', 'Could not start the mic: ' + err.message); }
}
$('btnMic').onclick = listen; $('btnVoiceAsk').onclick = listen;

// ---------- unit test ----------
$('btnTest').onclick = async () => {
  S.run++; stopAudio(); S.playing = false; setControls();
  say('s', 'Preparing the unit test…'); status('Preparing test…'); S.busy = true; setControls();
  try {
    const t = await chatJSON(testPrompt(lang(), S.source)); const qs = (t.questions || []).slice(0, 6);
    if (!qs.length) throw new Error('No questions generated');
    S.qa = qs; const box = document.createElement('div'); box.className = 'msg t'; box.innerHTML = '<b>Unit test</b> - answer in any of Hindi / English / Hinglish.';
    qs.forEach((q, i) => { const w = document.createElement('div'); w.className = 'q'; const l = document.createElement('div'); l.textContent = `Q${i + 1}. ${q.q}`; const a = document.createElement('textarea'); a.id = 'ans' + i; w.append(l, a); box.appendChild(w); });
    const b = document.createElement('button'); b.className = 'primary'; b.id = 'btnGrade'; b.textContent = 'Submit answers'; box.appendChild(b); $('log').appendChild(box); $('log').scrollTop = 1e9;
    b.onclick = () => grade(box, b);
    teacher.gesture('point'); status('Test ready'); await speakText(lang() === 'english' ? 'Your unit test is ready. Answer each question, then submit.' : (lang() === 'hindi' ? 'आपका यूनिट टेस्ट तैयार है। हर सवाल का जवाब लिखिए और फिर सबमिट कीजिए।' : 'आपका unit test तैयार है। हर सवाल का answer लिखिए और फिर submit कीजिए।'));
    teacher.gesture('rest');
  } catch (e) { say('s warn', 'Could not create the test: ' + e.message); }
  S.busy = false; setControls();
};
async function grade(box, btn) {
  const qa = S.qa.map((q, i) => ({ q: q.q, key: q.key, student: ($('ans' + i).value || '').trim() || '(no answer)' }));
  btn.disabled = true; btn.textContent = 'Checking…'; status('Checking your answers…');
  try {
    const g = await chatJSON(gradePrompt(lang(), qa, S.source)); const res = g.results || [];
    let tot = 0; const rem = [];
    const out = document.createElement('div'); out.className = 'msg t';
    qa.forEach((x, i) => { const r = res[i] || { score: 0, feedback: '' }; tot += +r.score || 0; const d = document.createElement('div'); d.className = 'res'; d.textContent = `Q${i + 1}: ${r.score >= 1 ? '✅' : r.score > 0 ? '🟡' : '❌'} ${r.feedback || ''}${r.remedial ? '\n\n' + ({ english: 'Let\'s understand: ', hindi: 'समझो: ' }[$('lang').value] || 'Samjho: ') + r.remedial : ''}`; out.appendChild(d); if (r.remedial) rem.push(r.remedial); });
    const h = document.createElement('div'); h.innerHTML = `<b>Score: ${tot} / ${qa.length}</b> - ${g.summary || ''}`; out.prepend(h);
    $('log').appendChild(out); $('log').scrollTop = 1e9; btn.textContent = 'Submitted';
    S.playing = true; const tok = ++S.run; setControls();
    for (const r of rem.slice(0, 4)) { if (tok !== S.run) break; teacher.gesture('explain'); $('board').innerHTML = ''; $('boardTitle').textContent = 'Revision'; addBoard(r.length > 140 ? (r.slice(0, 140).replace(/[^.!?।,;]*$/, '').trim() || r.slice(0, 140).replace(/\s\S*$/, '')) + (/[.!?।]$/.test(r.slice(0, 140).replace(/[^.!?।,;]*$/, '').trim()) ? '' : '…') : r); await speakText(r); }
    S.playing = false; teacher.gesture('rest'); status('Done'); setControls();
  } catch (e) { btn.disabled = false; btn.textContent = 'Submit answers'; say('s warn', 'Could not check answers: ' + e.message); }
}
setControls();
window.__app = { S, teacher };

// ---------- account ----------
requireLogin().then(async u => {
  $('who').textContent = u.name || u.email;
  try {
    const ls = (await listLessons()).slice(0, 5); if (!ls.length) return;
    say('s', 'Your saved lessons (continue from where you stopped):');
    for (const l of ls) {
      const b = document.createElement('button'); b.className = 'msg s'; b.style.cursor = 'pointer';
      b.textContent = (l.finished ? '✔ ' : '▶ ') + (l.title || 'Untitled') + (l.finished ? ' (finished)' : ` (part ${l.chunkIndex + 1}, line ${l.sentIndex + 1})`);
      b.onclick = async () => {
        if(S.playing || S.busy) return;
        const f = await getLesson(l._id); cancelPreparation(); stopAudio(); S.run++;
        $('lang').value = f.lang || $('lang').value; $('lang').onchange?.(); $('src').value = f.source;
        let material;try{material=validateMaterial(f.source,f.material);}catch(e){say('s warn','Cannot resume: '+e.message);return;}
        let snapshot;try{snapshot=validateSnapshot(f.topicSnapshot,material,f.lang);validateTopicState(f,material,f.lang,snapshot);}catch(e){say('s warn','Saved topic response invalid: '+e.message);return;}
        if(material && f.sentIndex>0 && (!snapshot || snapshot.unitId!==f.chunkIndex)){say('s warn','This topic has no exact saved response. Start a new topic rather than silently skip a regenerated explanation.');return;}
        $('materialMode').value=material?.mode||'notes';previewMaterial();
        Object.assign(S, { source: f.source, material, chunks: material?material.units.map(u=>u.text):chunkText(f.source), topics: null, topicPause: false, data: [], prefetchError:null, idx: f.chunkIndex, sent: f.sentIndex, titles: [], shown: new Set(), started: true, finished: !!f.finished, testReady: !!f.finished, qa: null, lessonId: f._id, title0: f.title });
        if(snapshot)S.data[snapshot.unitId]=snapshot.teaching;
        $('board').innerHTML = ''; $('diagram').innerHTML = '';
        say('s', `Resuming "${f.title}" at part ${f.chunkIndex + 1}, line ${f.sentIndex + 1}.`);
        if (f.finished) { setControls(); status('Lesson finished'); } else runLesson();
      };
      $('log').appendChild(b);
    }
  } catch { /* offline or server waking: skip */ }
});
$('btnLogout').onclick = logout;

function previewMaterial(){try{const m=materialMeta($('src').value,$('materialMode').value);$('materialPreview').textContent=m?'Generated teacher knowledge, not quoted notes. Check/edit the source if this outline is wrong:\n'+visibleUnitList(m):'Detailed notes: original source-grounded teaching and saved lesson format.';}catch(e){$('materialPreview').textContent=e.message;}}
$('materialMode').addEventListener('change',()=>{if(lastPdfText&&[lastPdfText.notes,lastPdfText.topics].includes($('src').value))$('src').value=$('materialMode').value==='notes'?lastPdfText.notes:lastPdfText.topics;previewMaterial();});$('src').addEventListener('input',previewMaterial);previewMaterial();

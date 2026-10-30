import { createTeacher } from './teacher.js';
import { renderDiagram } from './diagram.js';
import { requireLogin, logout, user } from './auth.js';
import { cfg, saveCfg, providerDefaults, chatJSON, pacing } from './llm.js';
import { saveProgress, listLessons, getLesson } from './progress.js';
import { buildIndex, search } from './rag.js';
import { lessonPrompt, doubtPrompt, testPrompt, gradePrompt, outlinePrompt, summaryPrompt } from './prompts.js';
import { PIPER, voiceGroup, sampleText, synth, playBlob, stopAudio, deviceVoices, speakDevice } from './tts.js';

const $ = id => document.getElementById(id);
const svgTeacher = createTeacher($('teacher'));
const teacher = { impl: svgTeacher, gesture(g) { this.impl.gesture(g); }, speaking(v) { this.impl.speaking(v); }, mouthLevel(v) { this.impl.mouthLevel?.(v); } };
// Upgrade to the 3D human teacher when WebGL and the model load; otherwise keep the drawn teacher.
(async () => {
  try {
    const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
    const { createTeacher3D } = await import('./teacher3d.js');
    const t3 = await createTeacher3D($('teacher3d'), 'assets/1-teacher.vrm');
    $('teacher').style.display = 'none'; $('teacher3d').hidden = false; $('credit').hidden = false; teacher.impl = t3; window.__teacher3d = true;
  } catch (e) { console.warn('3D teacher unavailable, using the drawn teacher:', e && e.message); }
})();
const S = { chunks: [], data: [], idx: 0, sent: 0, run: 0, source: '', playing: false, started: false, titles: [], shown: new Set(), busy: false, testReady: false, qa: null };
const lang = () => $('lang').value;
const rate = () => parseFloat($('rate').value);
const status = t => { $('status').textContent = t; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let saveBusy = false;
async function persist(nextSent, finished) {
  if (!S.source || saveBusy) return; saveBusy = true;
  try {
    const j = await saveProgress({ id: S.lessonId, title: S.title0 || S.source.slice(0, 60), lang: lang(), source: S.source, chunkIndex: S.idx, sentIndex: nextSent ?? S.sent, finished: !!finished });
    if (j.id) S.lessonId = j.id;
  } catch { /* progress saving is best effort */ } finally { saveBusy = false; }
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
  if (saved && opts.some(o => o.value === saved)) $('voice').value = saved;
  const nat = opts.find(o => o.nat);
  $('voice').title = nat ? 'Natural browser voices found - best quality' : 'No natural browser voice found. For the best Hindi/Hinglish voice open this site in Microsoft Edge (Madhur / Swara / Neerja natural voices) or Chrome on Android.';
  if (!saved && nat) $('voice').value = nat.value;
}
$('voice').onchange = () => localStorage.setItem('aiteacher.voice.' + voiceGroup(lang()), $('voice').value);
$('lang').onchange = () => { fillVoices(); localStorage.setItem('aiteacher.lang', lang()); };
speechSynthesis?.addEventListener?.('voiceschanged', fillVoices);
if (localStorage.getItem('aiteacher.lang')) $('lang').value = localStorage.getItem('aiteacher.lang');
{ const r = localStorage.getItem('aiteacher.rate'); if (r && [...$('rate').options].some(o => o.value === r)) $('rate').value = r; }
$('rate').onchange = () => localStorage.setItem('aiteacher.rate', $('rate').value);
fillVoices();

let progressNote = null;
const onProg = p => { if (p && p.total) status(`Downloading voice model ${Math.round(100 * p.loaded / p.total)}% (one time, then cached)`); };
async function speakText(text) {
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
async function readPdf(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  const pages = Math.min(doc.numPages, 60);
  for (let i = 1; i <= pages; i++) { const c = await (await doc.getPage(i)).getTextContent(); text += c.items.map(x => x.str).join(' ') + '\n\n'; }
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
  return { text, pages, total: doc.numPages, ocr };
}
$('pdf').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  $('srcInfo').textContent = 'Reading PDF…';
  try {
    const r = await readPdf(f);
    if (r.text.replace(/\s/g, '').length < (r.ocr ? 20 : 200)) { $('srcInfo').textContent = 'No text could be read from this PDF, even with OCR. Paste the text instead.'; return; }
    $('src').value = r.text.trim(); $('srcInfo').textContent = `${r.ocr ? 'OCR (may contain mistakes): ' : ''}PDF read: ${r.pages}${r.total > r.pages ? ' of ' + r.total : ''} pages, ${r.text.length} characters. Check the text below before starting.`;
    if (r.total > r.pages) { const m = `Only the first ${r.pages} of ${r.total} pages were read${r.ocr ? ' (OCR limit)' : ''}. Paste the remaining pages separately to learn them.`; $('srcInfo').textContent += ' ' + m; say('s warn', m); }
  } catch (err) { $('srcInfo').textContent = 'Could not read PDF: ' + err.message; }
};
$('btnVideo').onclick = () => {
  const u = $('videoUrl').value.trim(); if (!u) return;
  say('s warn', 'Video link noted, but a browser app cannot fetch a video\'s transcript reliably (YouTube blocks it). Open the video\'s "Show transcript", copy it, and paste it in the box - I will teach from that.');
};

function chunkText(t) {
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

pacing.onWait = s => status(`Pacing for the free AI limit (about ${s} s)…`);
async function planTopics() {
  const n = S.chunks.length, full = S.source.length <= 9000;
  let digest, readN = n, notRead = [];
  if (full) digest = S.chunks.map((c, i) => `[PART ${i}]\n${c}`).join('\n\n');
  else {
    // staged reading: summarise consecutive batches (<= ~7000 chars) one call at a time, then plan from the summaries
    const batches = []; let cur = [], len = 0;
    S.chunks.forEach((c, i) => { if (cur.length && len + c.length > 7000) { batches.push(cur); cur = []; len = 0; } cur.push(i); len += c.length; });
    if (cur.length) batches.push(cur);
    const key = S.source.length + ':' + n; if (S.sumKey !== key) { S.sumKey = key; S.sumLines = new Array(n).fill(null); }
    const MAXB = 40, lines = S.sumLines; notRead = [];
    for (let b = 0; b < batches.length; b++) {
      const ids = batches[b];
      if (ids.every(i => lines[i])) continue;
      if (b >= MAXB) { ids.forEach(i => notRead.push(i)); continue; }
      status(`Reading the whole material… batch ${b + 1}/${Math.min(batches.length, MAXB)}`);
      let m = new Map();
      for (let attempt = 0; attempt < 1 && !ids.every(i => m.get(i)); attempt++) {
        if (attempt) { status(`Reading the whole material… batch ${b + 1} retry (free AI limit, waiting)`); await new Promise(r => setTimeout(r, attempt * 12000)); }
        try {
          const o = await chatJSON(summaryPrompt(lang(), ids.map(i => `[PART ${i}]\n${S.chunks[i]}`).join('\n\n'), ids));
          (o.parts || []).forEach(p => { const s = String(p.summary || '').slice(0, 260); if (s) m.set(+p.part, s); });
        } catch { /* retry */ }
      }
      ids.forEach(i => { if (m.get(i)) lines[i] = m.get(i); else notRead.push(i); });
    }
    readN = n - notRead.length;
    if (notRead.length) {
      say('s', `Reading is not finished: ${readN} of ${n} parts read in full, parts ${notRead.join(', ')} still unread (free AI limit or error). Your finished reading is kept. Press Play to continue preparing; the lesson will not start on a partial reading.`);
      return false;
    }
    digest = S.chunks.map((c, i) => `[PART ${i}] ${lines[i]}`).join('\n');
  }
  let topics = null;
  try {
    const o = await chatJSON(outlinePrompt(lang(), digest.slice(0, 14000), n, full));
    // repair the AI's plan: order by start, make topics contiguous, cover parts 0..n-1 exactly once
    let t = (o.topics || []).map(x => ({ title: String(x.title || '').slice(0, 80), from: Math.round(+x.from), to: Math.round(+x.to) })).filter(x => x.title && Number.isFinite(x.from) && Number.isFinite(x.to));
    t.sort((x, y) => x.from - y.from);
    t = t.filter((x, k) => k === 0 || x.from > t[k - 1].from);
    t.forEach((x, k) => { x.from = k === 0 ? 0 : t[k - 1].to + 1; x.to = k === t.length - 1 ? n - 1 : Math.max(x.from, Math.min(t[k + 1].from - 1, n - 1)); });
    t = t.filter(x => x.from <= n - 1 && x.to >= x.from);
    if (t.length && t[t.length - 1].to < n - 1) t[t.length - 1].to = n - 1;
    if (t.length) topics = t;
  } catch { /* fall back below */ }
  if (!topics) { topics = []; for (let i = 0; i < n; i += 2) topics.push({ title: 'Topic ' + (topics.length + 1), from: i, to: Math.min(i + 1, n - 1) }); S.planFallback = true; }
  S.topics = topics; S.planFull = true; S.notRead = [];
  say('s', (full ? `Read all ${n} parts in full before planning.` : `Read all ${n} parts in full, batch by batch, before planning.`) + (S.planFallback ? ' (AI topic planning failed twice, so parts were grouped automatically in pairs.)' : '') + ' Topics: ' + topics.map((t, i) => `${i + 1}. ${t.title}`).join('  |  '));
  return true;
}

// ---------- lesson ----------
function loadChunk(i) {
  if (i >= S.chunks.length) return null;
  if (!S.data[i]) {
    S.data[i] = chatJSON(lessonPrompt(lang(), S.chunks[i], S.titles.slice(-4), topicOf(i)?.title)).then(d => {
      if (!Array.isArray(d.sentences) || !d.sentences.length) throw new Error('AI returned no lesson');
      d.sentences = d.sentences.filter(s => s && s.text).slice(0, 16); return d;
    });
    S.data[i].catch(() => { S.data[i] = null; });
  }
  return S.data[i];
}
function showBoard(d, upTo) {
  $('board').innerHTML = ''; $('boardTitle').textContent = d.title || 'Board';
  d.sentences.slice(0, upTo + 1).forEach((s, k) => { if ((s.board || s.step) && S.shown.has(k)) addBoard(s.board, s.step); });
  renderDiagram($('diagram'), S.shown.has('dia') ? d.diagram : null);
}
function addBoard(t, step) {
  const e = document.createElement('div'); e.className = 'item';
  const norm = x => String(x || '').replace(/[\s*]/g, '').toLowerCase();
  if (t && !(step && step.math && norm(t) === norm(step.math))) { const m = document.createElement('div'); m.textContent = t; e.appendChild(m); }
  if (step && step.math) {
    const k = document.createElement('div'); k.className = 'step'; k.textContent = String(step.math).slice(0, 160); e.appendChild(k);
    if (step.from) { const f = document.createElement('div'); f.className = 'from'; f.textContent = 'from: ' + String(step.from).slice(0, 120); e.appendChild(f); }
  }
  $('board').appendChild(e); $('board').scrollTop = 1e9;
}
function setControls() {
  $('btnPause').disabled = !S.playing; $('btnResume').disabled = S.playing || !S.started || S.finished;
  $('btnDoubt').disabled = !S.started || S.busy; $('btnVoiceAsk').disabled = !S.started || S.busy; $('btnResume').textContent = S.topicPause ? '▶ Next topic' : '▶ Resume'; $('btnTest').disabled = !S.testReady;
  $('progress').textContent = S.started ? `Part ${Math.min(S.idx + 1, S.chunks.length)} of ${S.chunks.length}` : '';
}
async function runLesson() {
  const token = ++S.run; S.playing = true; S.topicPause = false; setControls();
  try {
    if (!S.topics) { status('Reading the whole material…'); const okPlan = await planTopics(); if (token !== S.run) return; if (!okPlan) { S.playing = false; setControls(); status('Reading not finished - press Play to continue'); return; } }
    while (S.idx < S.chunks.length) {
      status('Preparing lesson part ' + (S.idx + 1) + '…');
      const d = await loadChunk(S.idx);
      if (token !== S.run) return;
      loadChunk(S.idx + 1)?.catch(() => {});
      if (S.sent === 0) { S.shown = new Set(); S.titles.push(d.title || ''); if (!S.title0 && d.title) S.title0 = d.title; }
      showBoard(d, S.sent);
      for (; S.sent < d.sentences.length; S.sent++) {
        if (token !== S.run) return;
        const s = d.sentences[S.sent];
        teacher.gesture(['explain', 'point', 'wave', 'think', 'nod'].includes(s.gesture) ? s.gesture : 'explain');
        if (!S.shown.has(S.sent)) { S.shown.add(S.sent); if (s.board || s.step) addBoard(s.board, s.step); }
        if (S.sent === d.sentences.length - 1 && d.diagram && !S.shown.has('dia')) { S.shown.add('dia'); renderDiagram($('diagram'), d.diagram); }
        const tx = s.speak && lang() === 'hinglish' ? s.speak : s.text;
        say('t', s.text);
        await speakText(tx);
        if (token !== S.run) return;
        persist(S.sent + 1);
      }
      S.idx++; S.sent = 0; persist(0);
      const tp = topicOf(S.idx - 1);
      if (tp && S.idx > tp.to && S.idx < S.chunks.length) {
        S.playing = false; S.topicPause = true; teacher.gesture('rest'); status('Topic finished - paused'); setControls();
        say('s', `Topic "${tp.title}" is finished. Ask any doubt (type or by voice), then press Next topic.`);
        return;
      }
      setControls();
    }
    S.playing = false; S.finished = true; S.testReady = true; teacher.gesture('wave'); status('Lesson finished'); setControls(); persist(0, true);
    say('s', 'Lesson finished. Press "Unit test" when ready.');
    await sleep(1500); teacher.gesture('rest');
  } catch (e) {
    if (token !== S.run) return;
    S.playing = false; setControls(); teacher.gesture('rest'); status('Stopped');
    say('s warn', 'Lesson stopped: ' + e.message + '  (Press Resume to retry, or check AI settings.)');
  }
}
$('btnStart').onclick = () => {
  const t = $('src').value.trim();
  if (t.length < 40) { say('s warn', 'Paste some notes first (at least a few lines).'); return; }
  if (!$('srcInfo').textContent.includes('PDF')) $('srcInfo').textContent = `Source loaded: ${t.length} characters.`;
  if (!$('voice').value) { say('s warn', 'No voice is available for this language in this browser. Open Home Tutor in Microsoft Edge on a computer (it has natural online Hindi voices), or switch the language to English.'); return; }
  stopAudio(); S.run++;
  const capped = t.slice(0, 60000); if (t.length > 60000) say('s warn', 'Text is very long; teaching the first 60,000 characters only.');
  Object.assign(S, { source: capped, chunks: chunkText(capped), topics: null, topicPause: false, data: [], idx: 0, sent: 0, titles: [], shown: new Set(), started: true, finished: false, testReady: false, qa: null, lessonId: undefined, title0: '' });
  $('log').innerHTML = ''; $('board').innerHTML = ''; $('diagram').innerHTML = '';
  say('s', `Loaded ${capped.length} characters in ${S.chunks.length} parts. Teaching in ${$('lang').selectedOptions[0].textContent}, voice: ${$('voice').selectedOptions[0]?.textContent || 'none'}.`);
  runLesson();
};
$('btnPause').onclick = () => { S.run++; S.playing = false; stopAudio(); teacher.speaking(false); teacher.gesture('rest'); status('Paused'); setControls(); };
$('btnResume').onclick = () => { $('doubtBox').hidden = true; runLesson(); };
$('btnDoubt').onclick = () => { $('btnPause').click(); $('doubtBox').hidden = false; $('doubtInput').focus(); say('s', 'Paused. Ask your doubt, then press Resume to continue from the same line.'); };
$('btnAsk').onclick = async () => {
  const q = $('doubtInput').value.trim(); if (!q) return; $('doubtInput').value = '';
  say('u', q); S.busy = true; setControls(); status('Thinking about your doubt…');
  try {
    const cur = Math.min(S.idx, S.chunks.length - 1);
    const rk = S.ragKey === S.source.length + ':' + S.chunks.length ? S.rag : (S.ragKey = S.source.length + ':' + S.chunks.length, S.rag = buildIndex(S.chunks));
    const hits = search(rk, q + ' ' + (topicOf(cur)?.title || ''), 4).filter(h => h.part !== cur).slice(0, 3);
    const parts = hits.map(h => ({ part: h.part + 1, text: S.chunks[h.part].slice(0, 1400) }));
    if (hits.length) say('s', 'Looked through the whole document for this doubt: using part' + (hits.length > 1 ? 's ' : ' ') + hits.map(h => h.part + 1).join(', ') + ' plus the part being taught (keyword search, no AI).');
    else say('s', 'Keyword search found no other matching part in the document; answering from the part being taught.');
    const d = await chatJSON(doubtPrompt(lang(), q, S.chunks[cur] || S.source, parts, cur + 1));
    const sents = (d.sentences || []).filter(s => s.text);
    $('board').innerHTML = ''; $('boardTitle').textContent = 'Doubt: ' + (d.title || q.slice(0, 40)); renderDiagram($('diagram'), d.diagram);
    S.playing = true; const tok = ++S.run; setControls();
    for (const s of sents) {
      if (tok !== S.run) break;
      teacher.gesture(s.gesture || 'explain'); if (s.board || s.step) addBoard(s.board, s.step); say('t', s.text);
      await speakText(s.speak && lang() === 'hinglish' ? s.speak : s.text);
    }
    if (tok === S.run) { S.playing = false; teacher.gesture('rest'); }
    const cd = S.topicPause ? null : await S.data[S.idx]?.catch(() => null); if (cd) showBoard(cd, S.sent);
    say('s', 'Doubt answered. Press Resume to continue the lesson, or ask another doubt.');
  } catch (e) { say('s warn', 'Could not answer: ' + e.message); }
  S.busy = false; S.playing = false; setControls(); status('Paused');
};
$('doubtInput').onkeydown = e => { if (e.key === 'Enter') $('btnAsk').click(); };
function listen() {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { say('s warn', 'Voice input is not supported in this browser (Chrome or Edge on a computer work best). Type your doubt instead.'); $('doubtBox').hidden = false; return; }
  if (S.playing) $('btnPause').click(); else { stopAudio(); }
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
        const f = await getLesson(l._id); stopAudio(); S.run++;
        $('lang').value = f.lang || $('lang').value; $('lang').onchange?.(); $('src').value = f.source;
        Object.assign(S, { source: f.source, chunks: chunkText(f.source), topics: null, topicPause: false, data: [], idx: f.chunkIndex, sent: f.sentIndex, titles: [], shown: new Set(), started: true, finished: !!f.finished, testReady: !!f.finished, qa: null, lessonId: f._id, title0: f.title });
        $('board').innerHTML = ''; $('diagram').innerHTML = '';
        say('s', `Resuming "${f.title}" at part ${f.chunkIndex + 1}, line ${f.sentIndex + 1}.`);
        if (f.finished) { setControls(); status('Lesson finished'); } else runLesson();
      };
      $('log').appendChild(b);
    }
  } catch { /* offline or server waking: skip */ }
});
$('btnLogout').onclick = logout;

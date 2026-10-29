import { createTeacher } from './teacher.js';
import { renderDiagram } from './diagram.js';
import { requireLogin, logout, user } from './auth.js';
import { cfg, saveCfg, providerDefaults, chatJSON } from './llm.js';
import { lessonPrompt, doubtPrompt, testPrompt, gradePrompt } from './prompts.js';
import { PIPER, voiceGroup, sampleText, synth, playBlob, stopAudio, deviceVoices, speakDevice } from './tts.js';

const $ = id => document.getElementById(id);
const teacher = createTeacher($('teacher'));
const S = { chunks: [], data: [], idx: 0, sent: 0, run: 0, source: '', playing: false, started: false, titles: [], shown: new Set(), busy: false, testReady: false, qa: null };
const lang = () => $('lang').value;
const rate = () => parseFloat($('rate').value);
const status = t => { $('status').textContent = t; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
if (localStorage.getItem('aiteacher.rate')) $('rate').value = localStorage.getItem('aiteacher.rate');
$('rate').onchange = () => localStorage.setItem('aiteacher.rate', $('rate').value);
fillVoices();

let progressNote = null;
const onProg = p => { if (p && p.total) status(`Downloading voice model ${Math.round(100 * p.loaded / p.total)}% (one time, then cached)`); };
async function speakText(text) {
  const v = $('voice').value;
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
  return { text, pages, total: doc.numPages };
}
$('pdf').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  $('srcInfo').textContent = 'Reading PDF…';
  try {
    const r = await readPdf(f);
    if (r.text.replace(/\s/g, '').length < 200) { $('srcInfo').textContent = 'This PDF has almost no selectable text (probably scanned). OCR is not built into this version - paste the text instead.'; return; }
    $('src').value = r.text.trim(); $('srcInfo').textContent = `PDF read: ${r.pages}${r.total > r.pages ? ' of ' + r.total : ''} pages, ${r.text.length} characters. Check the text below before starting.`;
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

// ---------- lesson ----------
function loadChunk(i) {
  if (i >= S.chunks.length) return null;
  if (!S.data[i]) {
    S.data[i] = chatJSON(lessonPrompt(lang(), S.chunks[i], S.titles.slice(-4))).then(d => {
      if (!Array.isArray(d.sentences) || !d.sentences.length) throw new Error('AI returned no lesson');
      d.sentences = d.sentences.filter(s => s && s.text).slice(0, 14); return d;
    });
    S.data[i].catch(() => { S.data[i] = null; });
  }
  return S.data[i];
}
function showBoard(d, upTo) {
  $('board').innerHTML = ''; $('boardTitle').textContent = d.title || 'Board';
  d.sentences.slice(0, upTo + 1).forEach((s, k) => { if (s.board && S.shown.has(k)) addBoard(s.board); });
  renderDiagram($('diagram'), S.shown.has('dia') ? d.diagram : null);
}
function addBoard(t) { const e = document.createElement('div'); e.className = 'item'; e.textContent = t; $('board').appendChild(e); $('board').scrollTop = 1e9; }
function setControls() {
  $('btnPause').disabled = !S.playing; $('btnResume').disabled = S.playing || !S.started || S.finished;
  $('btnDoubt').disabled = !S.started || S.busy; $('btnTest').disabled = !S.testReady;
  $('progress').textContent = S.started ? `Part ${Math.min(S.idx + 1, S.chunks.length)} of ${S.chunks.length}` : '';
}
async function runLesson() {
  const token = ++S.run; S.playing = true; setControls();
  try {
    while (S.idx < S.chunks.length) {
      status('Preparing lesson part ' + (S.idx + 1) + '…');
      const d = await loadChunk(S.idx);
      if (token !== S.run) return;
      loadChunk(S.idx + 1)?.catch(() => {});
      if (S.sent === 0) { S.shown = new Set(); S.titles.push(d.title || ''); }
      showBoard(d, S.sent);
      for (; S.sent < d.sentences.length; S.sent++) {
        if (token !== S.run) return;
        const s = d.sentences[S.sent];
        teacher.gesture(['explain', 'point', 'wave', 'think', 'nod'].includes(s.gesture) ? s.gesture : 'explain');
        if (!S.shown.has(S.sent)) { S.shown.add(S.sent); if (s.board) addBoard(s.board); }
        if (S.sent === d.sentences.length - 1 && d.diagram && !S.shown.has('dia')) { S.shown.add('dia'); renderDiagram($('diagram'), d.diagram); }
        const tx = s.speak && lang() === 'hinglish' ? s.speak : s.text;
        say('t', s.text);
        await speakText(tx);
        if (token !== S.run) return;
      }
      S.idx++; S.sent = 0; setControls();
    }
    S.playing = false; S.finished = true; S.testReady = true; teacher.gesture('wave'); status('Lesson finished'); setControls();
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
  stopAudio(); S.run++;
  const capped = t.slice(0, 60000); if (t.length > 60000) say('s warn', 'Text is very long; teaching the first 60,000 characters only.');
  Object.assign(S, { source: capped, chunks: chunkText(capped), data: [], idx: 0, sent: 0, titles: [], shown: new Set(), started: true, finished: false, testReady: false, qa: null });
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
    const d = await chatJSON(doubtPrompt(lang(), q, S.chunks[Math.min(S.idx, S.chunks.length - 1)] || S.source, S.source));
    const sents = (d.sentences || []).filter(s => s.text);
    $('board').innerHTML = ''; $('boardTitle').textContent = 'Doubt: ' + (d.title || q.slice(0, 40)); renderDiagram($('diagram'), d.diagram);
    S.playing = true; const tok = ++S.run; setControls();
    for (const s of sents) {
      if (tok !== S.run) break;
      teacher.gesture(s.gesture || 'explain'); if (s.board) addBoard(s.board); say('t', s.text);
      await speakText(s.speak && lang() === 'hinglish' ? s.speak : s.text);
    }
    if (tok === S.run) { S.playing = false; teacher.gesture('rest'); }
    const cd = await S.data[S.idx]?.catch(() => null); if (cd) showBoard(cd, S.sent);
    say('s', 'Doubt answered. Press Resume to continue the lesson, or ask another doubt.');
  } catch (e) { say('s warn', 'Could not answer: ' + e.message); }
  S.busy = false; S.playing = false; setControls(); status('Paused');
};
$('doubtInput').onkeydown = e => { if (e.key === 'Enter') $('btnAsk').click(); };
$('btnMic').onclick = () => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { say('s warn', 'Voice input is not supported in this browser. Type your doubt instead.'); return; }
  const r = new R(); r.lang = lang() === 'english' ? 'en-IN' : 'hi-IN'; r.onresult = e => { $('doubtInput').value = e.results[0][0].transcript; };
  r.onerror = e => say('s warn', 'Mic error: ' + e.error); r.start(); status('Listening…');
};

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
    qa.forEach((x, i) => { const r = res[i] || { score: 0, feedback: '' }; tot += +r.score || 0; const d = document.createElement('div'); d.className = 'res'; d.textContent = `Q${i + 1}: ${r.score >= 1 ? '✅' : r.score > 0 ? '🟡' : '❌'} ${r.feedback || ''}${r.remedial ? '\n\nSamjho: ' + r.remedial : ''}`; out.appendChild(d); if (r.remedial) rem.push(r.remedial); });
    const h = document.createElement('div'); h.innerHTML = `<b>Score: ${tot} / ${qa.length}</b> - ${g.summary || ''}`; out.prepend(h);
    $('log').appendChild(out); $('log').scrollTop = 1e9; btn.textContent = 'Submitted';
    S.playing = true; const tok = ++S.run; setControls();
    for (const r of rem.slice(0, 4)) { if (tok !== S.run) break; teacher.gesture('explain'); $('board').innerHTML = ''; $('boardTitle').textContent = 'Revision'; addBoard(r.slice(0, 120)); await speakText(r); }
    S.playing = false; teacher.gesture('rest'); status('Done'); setControls();
  } catch (e) { btn.disabled = false; btn.textContent = 'Submit answers'; say('s warn', 'Could not check answers: ' + e.message); }
}
setControls();
window.__app = { S, teacher };

// ---------- account ----------
requireLogin().then(u => { $('who').textContent = u.name || u.email; });
$('btnLogout').onclick = logout;

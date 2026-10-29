// Voice engine: free neural voices (Piper, runs in the browser) + the device's own voices as a fallback option.
export const PIPER = {
  hindi: [
    { id: 'hi_IN-priyamvada-medium', label: 'Priyamvada (Hindi, female)' },
    { id: 'hi_IN-pratham-medium', label: 'Pratham (Hindi, male)' },
    { id: 'hi_IN-rohan-medium', label: 'Rohan (Hindi, male)' },
  ],
  english: [
    { id: 'en_US-hfc_female-medium', label: 'HFC Female (English, female)' },
    { id: 'en_US-kristin-medium', label: 'Kristin (English, female)' },
    { id: 'en_US-amy-medium', label: 'Amy (English, female)' },
    { id: 'en_US-ryan-medium', label: 'Ryan (English, male)' },
    { id: 'en_US-lessac-medium', label: 'Lessac (English, male)' },
  ],
};
// Hinglish is spoken by a Hindi voice (Devanagari text, English terms in Latin script).
export const voiceGroup = lang => (lang === 'english' ? 'english' : 'hindi');
const SAMPLE = { hindi: 'नमस्ते बच्चों, आज हम धीरे धीरे और आसान तरीके से पढ़ेंगे।', english: 'Hello students, today we will learn slowly and in a simple way.' };
export const sampleText = lang => SAMPLE[voiceGroup(lang)];

let piperMod = null;
async function piper() { return piperMod || (piperMod = import('./vendor/piper/piper-tts-web.js')); }
const cache = new Map();
export async function synth(text, voiceId, onProgress) {
  const key = voiceId + '|' + text;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const m = await piper();
    const blob = await m.predict({ text, voiceId }, onProgress);
    return blob;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}
export function deviceVoices() { return (window.speechSynthesis?.getVoices?.() || []); }

let ctx, analyser, srcNode, audioEl;
function ensureAudio() {
  if (audioEl) return;
  audioEl = new Audio();
  audioEl.crossOrigin = 'anonymous';
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    srcNode = ctx.createMediaElementSource(audioEl);
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    srcNode.connect(analyser); analyser.connect(ctx.destination);
  } catch { /* analyser optional */ }
}
// Play a Blob; resolves when finished or stopped. onLevel(0..1) follows the real audio loudness.
export function playBlob(blob, rate, onLevel) {
  ensureAudio();
  if (ctx?.state === 'suspended') ctx.resume();
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    audioEl.src = url; audioEl.playbackRate = rate || 1; audioEl.preservesPitch = true;
    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
    let raf;
    const tick = () => {
      if (buf) { analyser.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) { const d = (v - 128) / 128; sum += d * d; } onLevel?.(Math.min(1, Math.sqrt(sum / buf.length) * 4.5)); }
      raf = requestAnimationFrame(tick);
    };
    const done = () => { window.__onClipEnd?.(); cancelAnimationFrame(raf); onLevel?.(0); audioEl.onended = audioEl.onerror = audioEl.onpause = null; URL.revokeObjectURL(url); resolve(); };
    audioEl.onended = done; audioEl.onerror = done; audioEl.onpause = () => { if (audioEl.ended) return; done(); };
    audioEl.play().then(tick).catch(done);
  });
}
export function stopAudio() { if (audioEl) { audioEl.pause(); } window.speechSynthesis?.cancel?.(); }
export function speakDevice(text, voiceURI, lang, rate) {
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    const v = deviceVoices().find(v => v.voiceURI === voiceURI); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang;
    u.rate = rate; u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

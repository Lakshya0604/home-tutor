// Voice engine: free neural voices (Piper, runs in the browser) + the device's own voices as a fallback option.
export const PIPER = {
  // Only licence-cleared voices stay here. The Hindi Piper voices are CC BY-NC-SA / unclear, so they are not offered.
  hindi: [],
  english: [
    { id: 'en_US-kristin-medium', label: 'Kristin (English, female)' },
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
let activePlayback = null;
export const playbackStatus = { phase:'idle', currentTime:0, duration:null, contextState:null };
export function playBlob(blob, rate, onLevel) {
  ensureAudio();
  return new Promise((resolve,reject) => {
    const url=URL.createObjectURL(blob); let settled=false, raf, poll, lastTime=0, lastProgress=Date.now();
    const cleanup=()=>{clearInterval(poll);cancelAnimationFrame(raf);audioEl.onended=audioEl.onerror=audioEl.onpause=null;URL.revokeObjectURL(url);onLevel?.(0);activePlayback=null;window.__onClipEnd?.();};
    const finish=(error,cancelled=false)=>{if(settled)return;settled=true;cleanup();playbackStatus.phase=cancelled?'cancelled':error?'failed':'ended';if(error)reject(error);else resolve({cancelled});};
    activePlayback={cancel:()=>{finish(null,true);audioEl.pause();}};
    audioEl.src=url;audioEl.playbackRate=rate||1;audioEl.preservesPitch=true;
    playbackStatus.phase='starting';
    const buf=analyser?new Uint8Array(analyser.fftSize):null;
    const tick=()=>{if(settled)return;if(buf){analyser.getByteTimeDomainData(buf);let sum=0;for(const v of buf){const d=(v-128)/128;sum+=d*d;}onLevel?.(Math.min(1,Math.sqrt(sum/buf.length)*4.5));}raf=requestAnimationFrame(tick);};
    audioEl.onended=()=>finish();
    audioEl.onerror=()=>finish(new Error('Audio playback failed. The lesson is paused at this line; choose a working voice and press Resume.'));
    audioEl.onpause=()=>{if(!settled&&!audioEl.ended)finish(new Error('Audio playback paused unexpectedly. Press Resume when ready.'));};
    // This timer starts AFTER synthesis/download has completed. Never skips a line.
    poll=setInterval(()=>{
      if(settled)return;
      const t=Number(audioEl.currentTime)||0;playbackStatus.currentTime=t;playbackStatus.duration=Number.isFinite(audioEl.duration)?audioEl.duration:null;playbackStatus.contextState=ctx?.state||null;
      if(t>lastTime+.02){lastTime=t;lastProgress=Date.now();playbackStatus.phase='playing';}
      if(Date.now()-lastProgress>30000){const e=new Error('Audio stopped making progress for 30 seconds. This line was not completed. Check the voice or browser audio, then press Resume.');finish(e);audioEl.pause();}
    },1000);
    (async()=>{try{if(ctx?.state==='suspended')await ctx.resume();if(settled)return;await audioEl.play();if(!settled)tick();}catch{finish(new Error('The browser could not start audio playback. Allow audio, choose a working voice, then press Resume.'));}})();
  });
}
export function stopAudio() { if(activePlayback)activePlayback.cancel();else if(audioEl)audioEl.pause();window.speechSynthesis?.cancel?.(); }
export function speakDevice(text, voiceURI, lang, rate) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) return reject(new Error('This browser has no speech synthesis. Open Home Tutor in Microsoft Edge or Chrome on a computer.'));
    const u = new SpeechSynthesisUtterance(text);
    const v = deviceVoices().find(v => v.voiceURI === voiceURI); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang;
    u.rate = rate;
    // Natural online voices can take a few seconds to start; if nothing starts in 20s treat it as a failure instead of hanging or skipping.
    const timer = setTimeout(() => { speechSynthesis.cancel(); reject(new Error('The voice did not start speaking. Pick another voice, check your internet connection (natural voices are online), then press Resume.')); }, 20000);
    u.onstart = () => clearTimeout(timer);
    u.onend = () => { clearTimeout(timer); resolve(); };
    u.onerror = e => {
      clearTimeout(timer);
      if (e && (e.error === 'canceled' || e.error === 'interrupted')) return resolve(); // we stopped it ourselves (Pause / new lesson)
      reject(new Error('The voice failed (' + ((e && e.error) || 'unknown') + '). Pick another voice or check your internet connection, then press Resume.'));
    };
    speechSynthesis.speak(u);
  });
}

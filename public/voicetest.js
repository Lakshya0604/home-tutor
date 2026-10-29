import { sampleText, deviceVoices, speakDevice, stopAudio } from './tts.js';
const $ = id => document.getElementById(id);
const natural = v => /natural|online|google/i.test(v.name);
function fill() {
  const want = $('lang').value === 'english' ? 'en' : 'hi';
  const vs = deviceVoices().filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(want)).sort((a, b) => natural(b) - natural(a));
  $('voice').innerHTML = '';
  for (const v of vs) { const o = document.createElement('option'); o.value = v.voiceURI; o.textContent = (natural(v) ? '⭐ ' : '') + v.name + ' (' + v.lang + ')'; $('voice').appendChild(o); }
  $('count').textContent = vs.length ? `${vs.length} voice(s) found in this browser for this language.` : 'No voice for this language was found in this browser (the list can take a second to load). Try Microsoft Edge on a computer, or choose English.';
  $('go').disabled = !vs.length;
}
$('lang').onchange = fill; speechSynthesis?.addEventListener?.('voiceschanged', fill); fill();
$('go').onclick = async () => {
  stopAudio(); $('st').textContent = 'Speaking…';
  try { await speakDevice(sampleText($('lang').value), $('voice').value, $('lang').value === 'english' ? 'en-IN' : 'hi-IN', parseFloat($('rate').value)); $('st').textContent = 'Done. Did it sound like a person?'; }
  catch (e) { $('st').textContent = e.message; $('st').style.color = '#f5b84b'; }
};

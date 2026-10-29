// Original SVG teacher: arms/gestures, blinking, breathing, mouth driven by speech activity.
const NS = 'http://www.w3.org/2000/svg';
const GEST = {
  rest:    [8, 12, -8, -12],
  explain: [32, -75, -32, 75],
  point:   [8, 12, -85, -8],
  wave:    [8, 12, -160, -10],
  think:   [8, 12, -35, -135],
  nod:     [12, 20, -12, -20],
  none:    [8, 12, -8, -12],
};
export function createTeacher(svg) {
  svg.innerHTML = `
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a63"/><stop offset="1" stop-color="#1b2540"/></linearGradient></defs>
  <rect width="300" height="340" rx="14" fill="url(#bg)"/>
  <g id="body">
    <path d="M70 340 Q70 250 120 238 L180 238 Q230 250 230 340 Z" fill="#c2415d"/>
    <path d="M120 238 L150 275 L180 238 Z" fill="#f2c9a0"/>
    <rect x="136" y="200" width="28" height="42" rx="10" fill="#e9b88a"/>
  </g>
  <g id="armL" transform="translate(88 252) rotate(8)"><rect x="-11" y="-4" width="22" height="58" rx="11" fill="#c2415d"/>
    <g id="foreL" transform="translate(0 50) rotate(12)"><rect x="-9" y="-4" width="18" height="50" rx="9" fill="#e9b88a"/><circle cx="0" cy="48" r="11" fill="#e9b88a"/></g></g>
  <g id="armR" transform="translate(212 252) rotate(-8)"><rect x="-11" y="-4" width="22" height="58" rx="11" fill="#c2415d"/>
    <g id="foreR" transform="translate(0 50) rotate(-12)"><rect x="-9" y="-4" width="18" height="50" rx="9" fill="#e9b88a"/><circle cx="0" cy="48" r="11" fill="#e9b88a"/></g></g>
  <g id="head">
    <path d="M88 125 Q86 55 150 52 Q214 55 212 125 Q214 85 150 82 Q86 85 88 125Z" fill="#2a1d1a"/>
    <ellipse cx="150" cy="125" rx="58" ry="66" fill="#f2c9a0"/>
    <path d="M92 118 Q95 60 150 56 Q205 60 208 118 Q200 84 150 84 Q100 84 92 118Z" fill="#2a1d1a"/>
    <circle cx="150" cy="70" r="22" fill="#2a1d1a" opacity=".0"/>
    <g id="eyes"><g id="eyeL"><ellipse cx="127" cy="120" rx="8" ry="9" fill="#fff"/><circle id="pupL" cx="127" cy="121" r="4.5" fill="#2a1d1a"/></g>
    <g id="eyeR"><ellipse cx="173" cy="120" rx="8" ry="9" fill="#fff"/><circle id="pupR" cx="173" cy="121" r="4.5" fill="#2a1d1a"/></g></g>
    <g fill="none" stroke="#3b2a22" stroke-width="2.6" stroke-linecap="round"><path id="browL" d="M114 104 Q127 98 140 104"/><path id="browR" d="M160 104 Q173 98 186 104"/></g>
    <g fill="none" stroke="#1d2433" stroke-width="3"><rect x="111" y="108" width="32" height="24" rx="9"/><rect x="157" y="108" width="32" height="24" rx="9"/><path d="M143 119 H157"/></g>
    <path d="M150 128 Q146 142 152 144" fill="none" stroke="#c99a74" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="112" cy="146" r="7" fill="#e88a8a" opacity=".35"/><circle cx="188" cy="146" r="7" fill="#e88a8a" opacity=".35"/>
    <ellipse id="mouth" cx="150" cy="160" rx="10" ry="2" fill="#7a2230"/>
    <circle cx="150" cy="98" r="3.4" fill="#d6304f"/>
  </g>`;
  const $ = id => svg.querySelector('#' + id);
  const el = { armL: $('armL'), foreL: $('foreL'), armR: $('armR'), foreR: $('foreR'), head: $('head'), mouth: $('mouth'),
    eyeL: $('eyeL'), eyeR: $('eyeR'), body: $('body'), browL: $('browL'), browR: $('browR') };
  let cur = [...GEST.rest], tgt = [...GEST.rest], gest = 'rest', speaking = false, mouthTarget = 0, mouth = 0;
  let ext = null; let nextBlink = 1500, blinkT = -1, t0 = performance.now(), lastPulse = 0;
  const set = (g) => { gest = GEST[g] ? g : 'explain'; tgt = [...GEST[gest]]; };
  function frame(now) {
    const t = now - t0;
    // oscillation while speaking, per gesture
    let osc = [0, 0, 0, 0];
    if (speaking) {
      const s = Math.sin(t / 260);
      if (gest === 'explain') osc = [s * 6, s * 12, -s * 6, -s * 12];
      else if (gest === 'point') osc = [0, 0, s * 3, s * 6];
      else if (gest === 'wave') osc = [0, 0, 0, Math.sin(t / 120) * 22];
      else if (gest === 'think') osc = [0, 0, 0, s * 4];
      else osc = [s * 3, s * 5, -s * 3, -s * 5];
    }
    for (let i = 0; i < 4; i++) cur[i] += ((tgt[i] + osc[i]) - cur[i]) * 0.12;
    el.armL.setAttribute('transform', `translate(88 252) rotate(${cur[0]})`);
    el.foreL.setAttribute('transform', `translate(0 50) rotate(${cur[1]})`);
    el.armR.setAttribute('transform', `translate(212 252) rotate(${cur[2]})`);
    el.foreR.setAttribute('transform', `translate(0 50) rotate(${cur[3]})`);
    const breathe = Math.sin(t / 900) * 1.5;
    const nod = (speaking ? Math.sin(t / 420) * 1.6 : 0) + (gest === 'nod' ? Math.sin(t / 200) * 4 : 0);
    el.head.setAttribute('transform', `translate(0 ${breathe + nod}) rotate(${speaking ? Math.sin(t / 700) * 1.2 : 0} 150 200)`);
    el.body.setAttribute('transform', `translate(0 ${breathe * 0.4})`);
    // mouth: speech activity (pulses from word boundaries + natural jitter)
    if (speaking) {
      if (ext !== null) mouthTarget = ext; else if (now - lastPulse > 110) { mouthTarget = 0.25 + Math.random() * 0.75; lastPulse = now; }
    } else mouthTarget = 0;
    mouth += (mouthTarget - mouth) * 0.35;
    el.mouth.setAttribute('rx', 9 + mouth * 5); el.mouth.setAttribute('ry', 2 + mouth * 9);
    // blink
    nextBlink -= 16;
    if (nextBlink < 0 && blinkT < 0) { blinkT = 0; nextBlink = 2200 + Math.random() * 2500; }
    let sy = 1;
    if (blinkT >= 0) { blinkT += 16; sy = Math.abs(1 - blinkT / 90) ; if (blinkT > 180) { blinkT = -1; sy = 1; } sy = Math.max(.08, sy); }
    for (const e of [el.eyeL, el.eyeR]) { const cx = e === el.eyeL ? 127 : 173; e.setAttribute('transform', `translate(${cx} 120) scale(1 ${sy}) translate(${-cx} -120)`); }
    const lift = speaking ? Math.sin(t / 500) * 1.5 : 0;
    el.browL.setAttribute('transform', `translate(0 ${lift})`); el.browR.setAttribute('transform', `translate(0 ${lift})`);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { gesture: set, speaking: v => { speaking = v; }, mouthLevel: v => { ext = v; } };
}

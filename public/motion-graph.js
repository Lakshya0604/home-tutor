// Only explicit source-grounded constant-acceleration examples. Not a general plotting engine.
export function checkedMotionGraph(g, source, sentences) {
  if (!g || g.type !== 'motion') return null;
  const {u,a,t}=g;
  if (![u,a,t].every(Number.isFinite) || t<=0 || t>1e6 || Math.abs(u)>1e6 || Math.abs(a)>1e6) throw new Error('Invalid motion graph values.');
  // Model may copy the numbered-unit label that we supplied; strip only that generated label.
  if (typeof g.sourceQuote === 'string') g = {...g,sourceQuote:g.sourceQuote.replace(/^\[\d+\]\s*/, '')};
  if (typeof g.sourceQuote!=='string' || g.sourceQuote.length<20 || !source.includes(g.sourceQuote)) throw new Error('Motion graph needs an exact source excerpt.');
  if (!/constant acceleration|constant-acceleration|uniform acceleration/i.test(source)) throw new Error('Motion graph requires an explicit constant-acceleration source.');
  for (const [name,value] of Object.entries({u,a,t})) { const match=g.sourceQuote.match(new RegExp('\\b'+name+'\\s*=\\s*(-?\\d+(?:\\.\\d+)?)','i')); if(!match || Number(match[1])!==value) throw new Error('Motion graph value must match its named source variable.'); }
  if (!/\bu\s*=\s*-?\d+(?:\.\d+)?\s*m\/s\b/i.test(g.sourceQuote) || !/\ba\s*=\s*-?\d+(?:\.\d+)?\s*m\/s(?:²|\^2)/i.test(g.sourceQuote) || !/\bt\s*=\s*-?\d+(?:\.\d+)?\s*s\b/i.test(g.sourceQuote)) throw new Error('Motion graph supports explicit m/s, m/s² and s only; convert the source units first.');
  const numeric=[...g.sourceQuote.matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
  if (![u,a,t].every(v=>numeric.includes(v))) throw new Error('Motion graph values are not all in its source excerpt.');
  if (!Array.isArray(g.explanation) || new Set(g.explanation).size<3 || g.explanation.some(i=>!Number.isInteger(i)||!sentences[i])) throw new Error('Motion graph needs explanation sentences for axes, slope and area.');
  return {...g,v:u+a*t,s:u*t+.5*a*t*t};
}
export function renderMotionGraph(host,g) {
  const NS='http://www.w3.org/2000/svg';host.innerHTML='';
  const title=document.createElement('div');title.className='board-title';title.textContent='Velocity-time graph';host.append(title);
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 480 340');svg.setAttribute('width','100%');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Velocity against time, from ${g.u} to ${g.v} metres per second over ${g.t} seconds. Slope ${g.a} metres per second squared. Signed area ${g.s} metres.`);
  const min=Math.min(0,g.u,g.v),max=Math.max(0,g.u,g.v)||1,span=max-min;
  const X=t=>68+t/g.t*340,Y=v=>250-(v-min)/span*195;
  function add(tag,attrs,text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;svg.append(e);return e;}
  add('polygon',{points:`${X(0)},${Y(0)} ${X(0)},${Y(g.u)} ${X(g.t)},${Y(g.v)} ${X(g.t)},${Y(0)}`,fill:'#dce7ff'});
  for(let i=0;i<=4;i++){let v=min+span*i/4;add('line',{x1:68,x2:408,y1:Y(v),y2:Y(v),stroke:'#dde3ef'});add('text',{x:57,y:Y(v)+5,'text-anchor':'end','font-size':15,fill:'#34435d'},+v.toFixed(2));}
  add('line',{x1:68,x2:425,y1:Y(0),y2:Y(0),stroke:'#34435d','stroke-width':2});add('line',{x1:68,x2:68,y1:40,y2:265,stroke:'#34435d','stroke-width':2});
  add('line',{x1:X(0),y1:Y(g.u),x2:X(g.t),y2:Y(g.v),stroke:'#2f5bea','stroke-width':4});
  for(const[t,v]of [[0,g.u],[g.t,g.v]]){add('circle',{cx:X(t),cy:Y(v),r:5,fill:'#2f5bea'});add('text',{x:X(t),y:280,'text-anchor':'middle','font-size':16,fill:'#34435d'},t);}
  add('text',{x:238,y:307,'text-anchor':'middle','font-size':17,fill:'#1f2a44'},'Time t (s)');
  add('text',{x:68,y:25,'font-size':17,fill:'#1f2a44'},'Velocity v (m/s)');
  host.append(svg);
  const caption=document.createElement('p');caption.className='graph-caption';caption.textContent=`Slope = acceleration = ${g.a} m/s². Signed area under line = displacement = ${+g.s.toFixed(4)} m. Shading is the area between velocity and zero.`;host.append(caption);
  const eq=document.createElement('p');eq.textContent=`v = u + at = ${g.u} + (${g.a} × ${g.t}) = ${g.v} m/s`;host.append(eq);
}

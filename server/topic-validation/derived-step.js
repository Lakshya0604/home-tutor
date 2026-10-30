// Allowlisted calculations only. No evaluation of model-written expressions or code.
export function checkDerivedStep(step, parts) {
  if (!step || !['velocity','displacement','triangleArea'].includes(step.operation)) throw new Error('Unsupported derived calculation.');
  const part=parts.find(p=>p.part===step.part);
  if (!part || typeof step.quote!=='string' || step.quote.length<16 || !part.text.includes(step.quote)) throw new Error('Derived calculation needs exact source premises.');
  const keys=step.operation==='triangleArea'?['base','height']:['u','a','t'];
  for(const key of keys){const v=step.inputs?.[key];if(!Number.isFinite(v))throw new Error('Invalid calculation input.');const m=step.quote.match(new RegExp('\\b'+key+'\\s*=\\s*(-?\\d+(?:\\.\\d+)?)','i'));if(!m||Number(m[1])!==v)throw new Error('Derived input does not match its named source premise.');}
  const x=step.inputs;
  const result=step.operation==='velocity'?x.u+x.a*x.t:step.operation==='displacement'?x.u*x.t+.5*x.a*x.t*x.t:.5*x.base*x.height;
  if(!Number.isFinite(step.result)||Math.abs(result-step.result)>1e-8*Math.max(1,Math.abs(result)))throw new Error('Derived arithmetic does not agree with the calculation.');
  return {...step,result,checked:true};
}

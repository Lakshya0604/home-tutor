// Pure numeric arithmetic parser. No eval, variables, functions or executable expressions.
export function calculate(expression) {
  const s=String(expression).replace(/½/g,'(1/2)').replace(/[×·]/g,'*').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/\s/g,'');let i=0;
  function atom(){if(s[i]==='('){i++;const v=sum();if(s[i++]!==')')throw Error('Unclosed calculation');return v;}const m=s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);if(!m)throw Error('Not pure arithmetic');i+=m[0].length;return Number(m[0]);}
  function power(){let v=atom();if(s[i]==='^'){i++;const p=unary();if(Math.abs(p)>10)throw Error('Exponent too large');v=v**p;}return v;}
  function unary(){if(s[i]==='+'||s[i]==='-'){const op=s[i++];return(op==='-'?-1:1)*unary();}return power();}
  function product(){let v=unary();while(s[i]==='*'||s[i]==='/'){const op=s[i++],w=unary();v=op==='*'?v*w:v/w;}return v;}
  function sum(){let v=product();while(s[i]==='+'||s[i]==='-'){const op=s[i++],w=product();v=op==='+'?v+w:v-w;}return v;}
  const value=sum();if(i!==s.length||!Number.isFinite(value))throw Error('Unsupported arithmetic');return value;
}
export function checkedNumericEqualities(text) {
  // Only check fully numeric arithmetic chains; formulas and unit-bearing text stay source premises.
  const chains=[...String(text).matchAll(/-?(?:\d|½)[\d\s.×·*+\-/()²^½]*=\s*-?\d+(?:\.\d+)?/g)];
  const checked=[];
  for(const m of chains){const [left,right]=m[0].split('=');if(!/[×·*+\-/²^½]/.test(left))continue;const result=calculate(left),claimed=Number(right.trim());if(Math.abs(result-claimed)>1e-7*Math.max(1,Math.abs(result)))throw Error('The numerical answer contains an incorrect arithmetic step.');checked.push({expression:left.trim(),result});}
  return checked;
}

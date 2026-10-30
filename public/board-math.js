// Plain readable math for common LLM LaTeX, never HTML evaluation.
export function boardMath(value) {
  return String(value||'').replace(/\\\(|\\\)|\$\$/g,'').replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,(_,a,b)=>a==='1'&&b==='2'?'½':`(${a})/(${b})`).replace(/\\(?:times|cdot)/g,'×').replace(/\^\{2\}|\^2/g,'²').replace(/\^\{([^{}]+)\}/g,'^$1').replace(/\\(?:left|right)/g,'').replace(/\\(?:mathrm|text)\{([^{}]+)\}/g,'$1').replace(/\s+/g,' ').trim();
}

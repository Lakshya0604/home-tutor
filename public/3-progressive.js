// Source ranges stay in order. No AI reading or whole-book understanding is implied.
export function makeTopics(chunks) {
  return chunks.map((text, i) => {
    const first = text.split(/\n/).map(x=>x.trim()).find(Boolean) || `Part ${i+1}`;
    return { title: `Part ${i+1}: ${first.slice(0,70)}`, from:i, to:i, plan:[] };
  });
}
export function abortError() { return new DOMException('Preparation paused','AbortError'); }
export function checkActive(signal) { if (signal?.aborted) throw abortError(); }
export function delay(ms, signal) {
  checkActive(signal);
  return new Promise((resolve,reject)=> {
    const stop=()=>{clearTimeout(id); reject(abortError());};
    const id=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);
    signal?.addEventListener('abort',stop,{once:true});
  });
}

// Preserve existing persisted chunk indices. Only group those unchanged ranges.
export function isHeading(line) {
  const t=line.trim();
  return t.length>0 && t.length<=100 && (/^(?:chapter|unit|section|topic|अध्याय|इकाई)\s+[\dIVX]+(?:\b|[.: -])/i.test(t) || /^#{1,4}\s+\S/.test(t) || /^\d+(?:\.\d+)*[.)]\s+[A-Za-z\u0900-\u097f]/.test(t) && !/[=]/.test(t));
}
export function sectionTopics(chunks) {
  const topics=[];
  chunks.forEach((text,i)=> {
    const first=text.split('\n').map(x=>x.trim()).find(Boolean) || '';
    if(i===0 || isHeading(first)) topics.push({title:isHeading(first)?first.replace(/^#+\s*/,''):'Source section',from:i,to:i,plan:[]});
    else topics[topics.length-1].to=i;
  });
  return topics;
}

// Chunking for source text: headings always start a fresh chunk and a
// chunk never ends on an orphaned heading whose body fell into the next one.
export function legacyChunks(t) {
  const paras = t.replace(/\r/g, '').split(/\n\s*\n|\n(?=\s*(?:\d+[\.\)]|[-•*]|Unit|UNIT|Chapter))/).map(x => x.trim()).filter(Boolean);
  const out = []; let cur = '';
  const firstLine = p => p.split('\n').map(x=>x.trim()).find(Boolean) || '';
  // A heading always starts a fresh chunk; a chunk never ends on an orphaned
  // heading whose body fell into the next chunk. A lone heading is never
  // pushed by itself; it waits for its body.
  let curLoneHeading = false;
  for (const p of paras) {
    const hp = isHeading(firstLine(p));
    if (hp && cur && !curLoneHeading) { out.push(cur); cur = p; curLoneHeading = true; continue; }
    if ((cur + '\n' + p).length > 900 && cur && !curLoneHeading) { out.push(cur); cur = p; curLoneHeading = hp; }
    else { cur = cur ? cur + '\n' + p : p; curLoneHeading = curLoneHeading || (hp && !cur.includes('\n')); if (!hp && cur.includes('\n')) curLoneHeading = false; }
    while (cur.length > 1400) { const cut = cur.lastIndexOf('. ', 1000); const k = cut > 300 ? cut + 1 : 1000; out.push(cur.slice(0, k)); cur = cur.slice(k).trim(); }
  }
  if (cur) out.push(cur); return out;
}

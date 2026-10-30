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

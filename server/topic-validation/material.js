export const OUTLINE_VERSION=1;
export const GENERATED_MODES=['topic','syllabus'];
export function outline(source,mode) {
 if(!GENERATED_MODES.includes(mode)||typeof source!=='string'||source.length>60000||!/[\p{L}\p{N}]/u.test(source))throw Error('Enter a meaningful topic or syllabus, up to60000characters.');
 if(mode==='topic')return [{id:0,title:source.trim().slice(0,120),text:source,start:0,end:source.length,parent:null,depth:0}];
 const nodes=[];let offset=0,stack=[];
 for(const raw of source.split('\n')) {
  const start=offset;offset+=raw.length+1;if(!raw.trim())continue;
  const t=raw.trim(),prefix=t.match(/^(\d+(?:\.\d+)*)(?:[.)]|\s)\s*/);
  const indent=(raw.match(/^\s*/)||[''])[0].replace(/\t/g,'    ').length;
  const depth=prefix?prefix[1].split('.').length-1:Math.floor(indent/2);
  const title=t.replace(/^#{1,5}\s+|^[-•*]\s+|^\d+(?:\.\d+)*[.)]?\s+/,'').slice(0,120);
  // An unnumbered long sentence/problem continuation belongs to the preceding entry.
  const continuation=nodes.length&& !prefix && indent>0 && /[=?!]|\b(?:given|calculate|find|solve)\b/i.test(t);
  if(continuation){const prev=nodes.at(-1);prev.end=start+raw.length;prev.text=source.slice(prev.start,prev.end);continue;}
  while(stack.length&&stack.at(-1).depth>=depth)stack.pop();
  const node={id:nodes.length,title:title||t.slice(0,120),text:raw,start,end:start+raw.length,parent:stack.length?stack.at(-1).id:null,depth};
  nodes.push(node);stack.push(node);
 }
 if(!nodes.length||nodes.length>200)throw Error('Use1–200 syllabus entries. Split a larger syllabus.');
 for(const node of nodes){node.ancestors=[];let parent=node.parent;while(parent!==null){node.ancestors.unshift(nodes[parent].text);parent=nodes[parent].parent;}}
 return nodes;
}
export function materialMeta(source,mode) {return GENERATED_MODES.includes(mode)?{mode,version:OUTLINE_VERSION,units:outline(source,mode)}:null;}
export function validateMaterial(source,m) {
 if(m==null)return null;
 if(!m||!GENERATED_MODES.includes(m.mode)||m.version!==OUTLINE_VERSION)throw Error('Unsupported saved teaching mode/version.');
 const expected=materialMeta(source,m.mode);
 if(JSON.stringify(m)!==JSON.stringify(expected))throw Error('Saved topic map does not match original source.');
 return expected;
}
export function visibleUnitList(m) {return m.units.map(u=>' '.repeat(Math.min(8,u.depth)*2)+(u.id+1)+'. '+u.title).join('\n');}

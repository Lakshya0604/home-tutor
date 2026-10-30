// PDF.js text items: preserve visual lines and indentation for NEW syllabus mode only.
export function pdfTopicLines(items) {
 const rows=[];
 for(const item of items||[]) {
  if(typeof item.str!=='string'||!item.str.trim())continue;
  const x=Number(item.transform?.[4])||0,y=Number(item.transform?.[5])||0;
  let row=rows.at(-1);
  if(!row||Math.abs(row.y-y)>2){row={y,x,items:[]};rows.push(row)}
  row.items.push({x,text:item.str});
 }
 const minX=Math.min(...rows.map(r=>r.x));
 return rows.map(r=>' '.repeat(Math.min(16,Math.max(0,Math.round((r.x-minX)/10))))+r.items.map(x=>x.text).join(' ')).join('\n');
}

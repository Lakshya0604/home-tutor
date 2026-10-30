// Validate the complete task schema locally, including unknown fields and nested types.
export function assertSchema(value,schema,path='$') {
 if(schema.anyOf) {
  const ok=schema.anyOf.some(branch=>{try{assertSchema(value,branch,path);return true}catch{return false}});
  if(!ok)throw new Error('Response shape mismatch at '+path);
  return;
 }
 if(schema.enum && !schema.enum.includes(value))throw new Error('Invalid response value at '+path);
 if(schema.type==='null') {if(value!==null)throw new Error('Expected null at '+path);return;}
 if(schema.type==='object') {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected object at '+path);
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw new Error('Missing field '+path+'.'+key);
  for(const [key,item] of Object.entries(value)) {
   if(!Object.hasOwn(schema.properties||{},key)) {if(schema.additionalProperties===false)throw new Error('Unknown field '+path+'.'+key);continue;}
   assertSchema(item,schema.properties[key],path+'.'+key);
  }
  return;
 }
 if(schema.type==='array') {if(!Array.isArray(value))throw new Error('Expected array at '+path);value.forEach((x,i)=>assertSchema(x,schema.items,path+'['+i+']'));return;}
 if(schema.type==='integer') {if(!Number.isInteger(value))throw new Error('Expected integer at '+path);return;}
 if(schema.type==='number') {if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Expected finite number at '+path);return;}
 if(schema.type==='string'&&typeof value!=='string')throw new Error('Expected string at '+path);
}

const str={type:'string'}, strings={type:'array',items:str};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const nullable=x=>({anyOf:[x,{type:'null'}]});
const diagram=nullable({anyOf:[object({type:{type:'string',enum:['flow']},title:str,steps:strings}),object({type:{type:'string',enum:['table']},title:str,headers:strings,rows:{type:'array',items:strings}}),object({type:{type:'string',enum:['map']},title:str,center:str,branches:{type:'array',items:object({label:str,items:strings})}}),object({type:{type:'string',enum:['motion']},u:{type:'number'},a:{type:'number'},t:{type:'number'},sourceQuote:str})]});
export function teacherSchema(task,language) {
 if(!['lesson','doubt'].includes(task)) throw new Error('Unsupported fallback task');
 const speak={type:'string',description:language==='hinglish'?'The SAME sentence as text. Hindi words MUST be Devanagari, including disclaimers and understanding checks. Keep English technical words in Latin letters. NEVER copy Roman Hindi into this field. Pure English sentences may remain English.':language==='hindi'?'Leave empty; Hindi text itself is Devanagari.':'Plain English speech matching text.'};
 const properties={text:str,speak,board:str,step:nullable(object({math:str,from:str})),gesture:{type:'string',enum:['explain','point','wave','think','nod']}};
 if(task==='doubt')properties.evidence={type:'array',items:object({part:{type:'integer'},quote:{type:'string',description:'Exact contiguous supporting source excerpt. Empty evidence array for outside-notes facts or understanding checks, never invented evidence.'}})};
 return object({title:str,sentences:{type:'array',items:object(properties)},diagram});
}

// Serialize saves per lesson session, coalescing only pending snapshots from that
// session. An old response can never assign its ID to a newly started lesson.
export function createProgressQueue(save,{onSaved=()=>{},onError=()=>{}}={}){
 let epoch=0,currentId,pending=null,running=false;
 async function drain(){if(running)return;running=true;try{while(pending){const job=pending;pending=null;if(job.epoch!==epoch)continue;try{const response=await save({...job.payload,id:currentId??job.payload.id});if(job.epoch===epoch){if(response.id)currentId=response.id;onSaved(response,job.payload);}}catch(error){if(job.epoch===epoch)onError(error,job.payload);}}}finally{running=false}}
 return{reset(id){epoch++;currentId=id;pending=null;},enqueue(payload){pending={epoch,payload:structuredClone(payload)};return drain()},isBusy(){return running}};
}

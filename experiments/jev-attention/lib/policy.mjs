import { inputHash,unit,record,safeId } from './util.mjs';
const MISSING=new Set(['unknown','incomplete_evidence']);
/** Numeric thresholds are provisional operating points, never authorization or correctness proofs. */
export function interpret(prepared,parsed,{threshold=0.9}={}){
 if(prepared.status!=='ready'||!unit(threshold)||threshold<=0.5)throw Error('invalid_policy_input');
 const decisions={};
 for(const [id,a] of Object.entries(parsed.answers)){
  if(a.type==='noul'){
   const value=a.noul>=threshold?true:a.noul<=1-threshold?false:null;
   decisions[id]={...a,value,accepted:value!==null};
  }else if(a.type==='choice')decisions[id]={...a,value:a.choice,accepted:!MISSING.has(a.choice)&&a.choiceProbability>=threshold};
  else decisions[id]={...a,value:a.score,accepted:Math.max(...Object.values(a.probabilities))>=threshold};
 }
 const c=prepared.context;
 let accepted=Object.values(decisions).every(x=>x.accepted),reason=accepted?'advisory_only':'uncertain';
 if(c.profileId==='content-route'&&accepted&&!c.compatibility[decisions.destination.value]?.includes(decisions.format.value)){
  accepted=false;reason='incompatible_pair';
 }
 if(c.profileId==='opportunity'&&decisions.mismatch.value==='supported_mismatch'&&decisions.evidence_id.value==='none'){
  accepted=false;reason='missing_support_reference';
 }
 if(c.profileId==='telemetry'&&!prepared.request.state.observations_complete){accepted=false;reason='incomplete_evidence';}
 const proposals=c.candidateIds.map(id=>({candidateId:id,value:decisions[c.candidateQuestionIds[id]]?.value??null,accepted:decisions[c.candidateQuestionIds[id]]?.accepted??false}));
 return {mode:'shadow',gating:false,actions:[],profileId:c.profileId,profileVersion:c.profileVersion,id:c.caseId,inputHash:c.inputHash,requestHash:c.requestHash,model:parsed.model,threshold,thresholdCalibrated:false,accepted,reason,decisions,proposals,preservedIds:[...c.pinnedIds],usage:parsed.usage};
}
/** Builds a NEW read-only view; retains uncertainty and all pinned records even over a soft budget. */
export function contextView(packet,receipt,{softMaxChars=32000}={}){
 const raw=structuredClone(packet?.state?.items??[]);
 const all=reason=>({items:raw,reason,overSoftBudget:JSON.stringify(raw).length>softMaxChars,originalUnchanged:true});
 if(!record(packet?.state)||!Array.isArray(packet.state.items)||!Array.isArray(packet.state.evidence)||!Number.isInteger(softMaxChars)||softMaxChars<1)return all('invalid_input');
 if(!packet.state.items.every(x=>record(x)&&safeId(x.id)&&typeof x.text==='string'&&typeof x.protected==='boolean')||!packet.state.evidence.every(x=>record(x)&&safeId(x.id)&&typeof x.text==='string'))return all('invalid_input');
 if(new Set(packet.state.items.map(x=>x.id)).size!==packet.state.items.length)return all('invalid_input');
 const state={task:packet.state.task,items:packet.state.items.map(x=>({id:x.id,text:x.text,protected:x.protected})),evidence:packet.state.evidence.map(x=>({id:x.id,text:x.text}))};
 if(!receipt||receipt.id!==packet.id||receipt.profileVersion!=='0.1.0'||!Array.isArray(receipt.actions)||receipt.actions.length!==0||receipt.profileId!=='memory'||receipt.gating!==false||receipt.mode!=='shadow'||receipt.inputHash!==inputHash({id:'memory',version:'0.1.0'},state)||!Array.isArray(receipt.proposals))return all('stale_receipt');
 if(!receipt.proposals.every(p=>record(p)&&safeId(p.candidateId)&&[true,false,null].includes(p.value)&&typeof p.accepted==='boolean')||new Set(receipt.proposals.map(p=>p.candidateId)).size!==receipt.proposals.length)return all('invalid_receipt');
 const proposals=new Map(receipt.proposals.map(p=>[p.candidateId,p]));
 const items=raw.filter(x=>x.protected||proposals.get(x.id)?.value!==false||proposals.get(x.id)?.accepted!==true);
 return {items,reason:'reversible_view_only',overSoftBudget:JSON.stringify(items).length>softMaxChars,originalUnchanged:true};
}

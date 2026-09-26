import { unit } from './util.mjs';
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
 const accepted=Object.values(decisions).every(x=>x.accepted),reason=accepted?'advisory_only':'uncertain';
 return {mode:'shadow',gating:false,actions:[],profileId:c.profileId,profileVersion:c.profileVersion,id:c.caseId,inputHash:c.inputHash,requestHash:c.requestHash,model:parsed.model,threshold,thresholdCalibrated:false,accepted,reason,decisions,usage:parsed.usage};
}

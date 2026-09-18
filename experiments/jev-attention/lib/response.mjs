import { Stop,record,unit,sameKeys } from './util.mjs';
function bad(){throw new Stop('invalid_response');}
const nonnegativeInteger=x=>Number.isSafeInteger(x)&&x>=0;
function distribution(value,keys){
 if(!sameKeys(value,keys))bad();const ps=Object.values(value);
 if(!ps.every(unit)||Math.abs(ps.reduce((a,b)=>a+b,0)-1)>0.001)bad();return {...value};
}
/** Reject drift, missing answers, undeclared options and malformed probabilities without coercion. */
export function parseResponse(body,request){
 if(!record(body)||body.model!==request.model||!sameKeys(body.answers,Object.keys(request.questions))||!record(body.usage)||!nonnegativeInteger(body.usage.input_tokens)||!nonnegativeInteger(body.usage.output_tokens))bad();
 const answers={};
 for(const [id,q] of Object.entries(request.questions)){
  const a=body.answers[id];if(!record(a)||a.type!==q.type)bad();
  if(q.type==='noul'){
   if(!unit(a.noul))bad();answers[id]={type:'noul',noul:a.noul};
  }else if(q.type==='choice'){
   const ps=distribution(a.probabilities,Object.keys(q.criteria));
   if(typeof a.choice!=='string'||!Object.hasOwn(ps,a.choice)||ps[a.choice]<Math.max(...Object.values(ps))||!unit(a.confidence))bad();
   answers[id]={type:'choice',choice:a.choice,probabilities:ps,choiceProbability:ps[a.choice],distributionConfidence:a.confidence};
  }else if(q.type==='score'){
   const keys=q.criteria.map((_,i)=>String(i));const ps=distribution(a.probabilities,keys);
   if(!sameKeys(a.legend,keys)||!keys.every(k=>a.legend[k]===q.criteria[Number(k)])||!unit(a.confidence)||typeof a.score!=='number'||!Number.isFinite(a.score))bad();
   const weighted=keys.reduce((sum,k)=>sum+Number(k)*ps[k],0);
   if(a.score<0||a.score>keys.length-1||Math.abs(a.score-weighted)>0.001)bad();
   answers[id]={type:'score',score:a.score,probabilities:ps,distributionConfidence:a.confidence};
  }else bad();
 }
 return {model:body.model,answers,usage:{input_tokens:body.usage.input_tokens,output_tokens:body.usage.output_tokens}};
}

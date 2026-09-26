/** Descriptive evaluation only. Simulation output cannot masquerade as live-model performance. */
export function summarize(results,fixtures,{evidenceKind='unknown'}={}){
 const refs=new Map(fixtures.map(f=>[f.id,f]));
 if(refs.size!==fixtures.length||new Set(results.map(r=>r.id)).size!==results.length||results.some(r=>!refs.has(r.id)))throw Error('invalid_evaluation_join');
 const live=evidenceKind==='live',observed=results.filter(r=>r.status==='observed'),accepted=observed.filter(r=>r.accepted===true);
 let correct=0,scored=0,questions=0,questionsCorrect=0,questionsAccepted=0,acceptedQuestionCorrect=0;
 const perProfile={};
 for(const r of observed){
  const labels=refs.get(r.id).expected??{};const ids=Object.keys(labels);let comparable=0,allCorrect=true;
  for(const id of ids){
   if(labels[id]===null||!r.decisions?.[id])continue;
   const prediction=r.decisions[id],label=labels[id];comparable++;questions++;
   const matches=typeof label==='number'?Math.abs(prediction.value-label)<=0.001:prediction.value===label;
   if(matches)questionsCorrect++;else allCorrect=false;
   if(prediction.accepted){questionsAccepted++;if(matches)acceptedQuestionCorrect++;}
  }
  if(r.accepted&&comparable){scored++;if(allCorrect)correct++;}
  const p=perProfile[r.profileId]??={observed:0,accepted:0};p.observed++;if(r.accepted)p.accepted++;
 }
 const times=observed.map(r=>r.latencyMs).filter(Number.isFinite).sort((a,b)=>a-b);
 const quantile=q=>times.length?times[Math.max(0,Math.ceil(q*times.length)-1)]:null;
 const started=results.filter(r=>r.requestStarted===true);
 const labelOrigins=[...new Set(fixtures.map(f=>f.label_origin??'unverified'))];
 return {evidenceKind,modelQualityMeasured:live&&scored>0,productionQualityEstablished:false,referenceQuality:labelOrigins.length===1?labelOrigins[0]:'mixed_or_unverified',total:fixtures.length,observed:observed.length,accepted:accepted.length,coverage:fixtures.length?accepted.length/fixtures.length:0,acceptedAccuracy:live&&scored?correct/scored:null,acceptedScoredCases:live?scored:0,questionAccuracy:live&&questions?questionsCorrect/questions:null,acceptedQuestionAccuracy:live&&questionsAccepted?acceptedQuestionCorrect/questionsAccepted:null,questionCoverage:questions?questionsAccepted/questions:0,unavailable:results.filter(r=>r.status==='unavailable').length,providerRequestsStarted:started.length,unknownBilledCalls:started.filter(r=>!Number.isInteger(r.usage?.input_tokens)).length,knownInputTokens:observed.reduce((sum,r)=>sum+(r.usage?.input_tokens??0),0),providerLatencyP50Ms:live?quantile(0.5):null,providerLatencyP95Ms:live?quantile(0.95):null,perProfile};
}

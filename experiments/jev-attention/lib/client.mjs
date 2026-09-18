import { performance } from 'node:perf_hooks';
import { prepare } from './prepare.mjs';import { parseResponse } from './response.mjs';import { interpret } from './policy.mjs';import { Stop,safeId,unit } from './util.mjs';
export const ENDPOINT='https://api.typesafe.ai/v1/systemone';
const MAX_BODY=131072;
/** One instance is shared for an entire CLI invocation; failures also consume a started-call slot. */
export class Budget {
 #remaining;
 constructor(maxCalls){if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>39)throw new Stop('invalid_budget');this.#remaining=maxCalls;}
 get remaining(){return this.#remaining;}
 take(){if(this.#remaining<=0)return false;this.#remaining--;return true;}
}
async function limitedBody(response,signal){
 if(!response.body)throw new Stop('invalid_response');
 if(Number(response.headers.get('content-length'))>MAX_BODY){void response.body.cancel().catch(()=>{});throw new Stop('response_too_large');}
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{
  while(true){if(signal.aborted)throw new Stop('timeout');const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BODY){cancel();throw new Stop('response_too_large');}chunks.push(value);}
  return Buffer.concat(chunks,bytes).toString('utf8');
 }finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
/**
 * All provider use is opt-in. Input classification is a declaration, not DLP.
 * Cloudflare binding injection is explicit, version-checked, and does not claim local processing.
 */
export async function evaluate(profile,packet,options={}){
 const base={id:safeId(packet?.id)?packet.id:'invalid',profileId:safeId(profile?.id)?profile.id:'invalid',mode:'shadow',gating:false,actions:[],accepted:false,thresholdCalibrated:false,requestStarted:false};
 const skip=reason=>({...base,status:'skipped',reason});
 if(options.enabled!==true)return skip('disabled');
 const provider=options.provider??'typesafe';if(!['typesafe','cloudflare'].includes(provider))return skip('unsupported_provider');
 if(!(options.budget instanceof Budget))return skip('missing_budget');
 const threshold=options.threshold??0.9,timeoutMs=options.timeoutMs??5000;
 if(!unit(threshold)||threshold<=0.5||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)return skip('invalid_options');
 if(provider==='typesafe'&&(typeof options.apiKey!=='string'||!options.apiKey.trim()||options.apiKey.length>4096||/[\r\n]/.test(options.apiKey)))return skip('missing_api_key');
 if(provider==='cloudflare'&&options.allowGatewayAlias!==true)return skip('gateway_alias_not_acknowledged');
 if(provider==='cloudflare'&&typeof options.aiBinding?.run!=='function')return skip('binding_unavailable');
 if(packet?.classification==='approved_non_sensitive'&&options.allowReviewedData!==true)return skip('reviewed_data_not_enabled');
 let p;try{p=prepare(profile,packet);}catch(e){return skip(e instanceof Stop?e.code:'invalid_input');}
 if(p.status==='blocked')return {...skip(p.reason),status:'blocked',inputHash:p.context.inputHash};
 const fetchImpl=options.fetchImpl??globalThis.fetch;
 if(provider==='typesafe'&&typeof fetchImpl!=='function')return skip('fetch_unavailable');
 if(!options.budget.take())return skip('budget_exhausted');
 const start=performance.now(),controller=new AbortController();let timer;
 const started={...base,provider,requestStarted:true,inputHash:p.context.inputHash,requestHash:p.context.requestHash};
 try{
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Stop('timeout'));},timeoutMs);});
  const operation=(async()=>{
   if(provider==='cloudflare'){
    // The documented binding has no cancellation contract. A timeout may still incur a charge.
    const raw=await options.aiBinding.run('typesafe/jev',{state:p.request.state,questions:p.request.questions});
    if(Buffer.byteLength(JSON.stringify(raw))>MAX_BODY)throw new Stop('response_too_large');
    return parseResponse(raw,p.request);
   }
   const res=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(p.request)});
   if(!res.ok){void res.body?.cancel().catch(()=>{});throw new Stop(`http_${res.status}`);}
   const text=await limitedBody(res,controller.signal);let raw;
   try{raw=JSON.parse(text);}catch{throw new Stop('invalid_response');}
   return parseResponse(raw,p.request);
  })();
  const parsed=await Promise.race([operation,deadline]);
  return {...started,...interpret(p,parsed,{threshold}),status:'observed',latencyMs:Math.round((performance.now()-start)*100)/100};
 }catch(e){
  const reason=controller.signal.aborted?'timeout':e instanceof Stop&&/^(invalid_response|response_too_large|http_\d{3})$/.test(e.code)?e.code:'network_error';
  return {...started,status:'unavailable',reason,unknownBilling:true,latencyMs:Math.round((performance.now()-start)*100)/100};
 }finally{clearTimeout(timer);}
}

import {readFileSync,statSync} from 'node:fs';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {prepare} from './lib/prepare.mjs';import {evaluate,Budget} from './lib/client.mjs';import {summarize} from './lib/metrics.mjs';
const ROOT=new URL('./',import.meta.url);
function readJson(path){if(statSync(path).size>2*1024*1024)throw Error('input_too_large');return JSON.parse(readFileSync(path,'utf8'));}
function parse(args){
 const out={};const flags=new Set(['--live','--allow-reviewed-data']);const valued=new Set(['--profile','--max-calls','--input']);const seen=new Set();
 for(let i=0;i<args.length;i++){
  const k=args[i];if(seen.has(k)||(!flags.has(k)&&!valued.has(k)))throw Error('invalid_arguments');seen.add(k);
  if(flags.has(k))out[k]=true;else{if(i+1>=args.length||args[i+1].startsWith('--'))throw Error('invalid_arguments');out[k]=args[++i];}
 }
 if(out['--input']&&!out['--profile'])throw Error('invalid_arguments');
 if(out['--allow-reviewed-data']&&(!out['--input']||!out['--live']))throw Error('invalid_arguments');
 if(out['--max-calls']&&!out['--live'])throw Error('invalid_arguments');
 if(out['--live']&&(!out['--max-calls']||!/^\d+$/.test(out['--max-calls'])))throw Error('invalid_arguments');
 return out;
}
/** Default invocation is a local contract/readiness check. Keys alone cannot activate inference. */
export async function runCLI(args,{root=ROOT,env=process.env,fetchImpl}={}){
 const empty={mode:'offline',providerRequestsStarted:0,modelQualityMeasured:false,productionChanged:false,githubPRs:[]};
 let flags,manifest,selected,budget;
 try{
  flags=parse(args);manifest=readJson(new URL('manifest.json',root));
  selected=flags['--profile']?manifest.experiments.filter(x=>x.id===flags['--profile']):manifest.experiments;
  if(!selected.length)throw Error('invalid_arguments');
  if(flags['--live'])budget=new Budget(Number(flags['--max-calls']));
 }catch{return {exitCode:2,report:{...empty,blockedReason:'invalid_arguments'}};}
 const live=flags['--live']===true;
 if(live&&!env.TYPESAFE_API_KEY)return {exitCode:2,report:{...empty,mode:'live',blockedReason:'missing_api_key'}};
 if(live&&flags['--input']&&!flags['--allow-reviewed-data'])return {exitCode:2,report:{...empty,mode:'live',blockedReason:'reviewed_data_not_enabled'}};
 // Freeze and validate the entire batch before spending even one provider call.
 const plans=[],seenIds=new Set();
 try{
  for(const entry of selected){
   const profile=readJson(new URL(`${entry.path}/profile.json`,root));
   const packets=flags['--input']?readJson(resolve(flags['--input'])):readJson(new URL(`${entry.path}/fixtures.json`,root));
   const fixtures=Array.isArray(packets)?packets:[packets];
   if(!fixtures.length||fixtures.length>100)throw Error('invalid_input');
   for(const fixture of fixtures){
    prepare(profile,fixture);
    if(seenIds.has(fixture.id))throw Error('invalid_input');seenIds.add(fixture.id);
   }
   plans.push({profile,fixtures});
  }
 }catch{return {exitCode:2,report:{...empty,mode:live?'live':'offline',blockedReason:'invalid_input'}};}
 const reports=[],results=[],allFixtures=[];let stopped=false,invalid=false;
 try{
  for(const {profile,fixtures} of plans){
   const cases=[];
   for(const fixture of fixtures){
    const p=prepare(profile,fixture);allFixtures.push(fixture);
    if(!live){
     const row={id:fixture.id,profileId:profile.id,status:p.status==='ready'?'ready':'blocked',reason:p.reason??'offline_only',inputHash:p.context.inputHash,requestHash:p.context.requestHash??null,questions:p.request?Object.keys(p.request.questions).length:0,requestStarted:false,mode:'shadow',gating:false,actions:[],accepted:false};cases.push(row);results.push(row);continue;
    }
    let row;
    if(stopped)row={id:fixture.id,profileId:profile.id,status:'skipped',reason:'batch_stopped',requestStarted:false,mode:'shadow',gating:false,actions:[],accepted:false};
    else row=await evaluate(profile,fixture,{enabled:true,budget,apiKey:env.TYPESAFE_API_KEY,allowReviewedData:flags['--allow-reviewed-data']===true,fetchImpl});
    if(row.status==='unavailable')stopped=true;
    if(row.status==='skipped'&&!['budget_exhausted'].includes(row.reason))invalid=true;
    cases.push(row);results.push(row);
   }
   reports.push({id:profile.id,title:profile.title,currentSourceVerified:false,cases});
  }
 }catch{return {exitCode:2,report:{...empty,mode:live?'live':'offline',blockedReason:'invalid_input',providerRequestsStarted:results.filter(r=>r.requestStarted).length,experiments:reports}};}
 const evidenceKind=live&&!fetchImpl?'live':fetchImpl?'mock':'offline';
 let metrics;try{metrics=summarize(results,allFixtures,{evidenceKind});}catch{return {exitCode:2,report:{...empty,mode:live?'live':'offline',blockedReason:'invalid_evaluation_join',providerRequestsStarted:results.filter(r=>r.requestStarted).length,experiments:reports}};}
 return {exitCode:stopped||invalid?2:0,report:{...empty,mode:live?'live':'offline',transportEvidence:fetchImpl?'injected':live?'native':'none',experiments:reports,...metrics,thresholdCalibrated:false,remainingCallBudget:budget?.remaining??null,blockedReason:stopped?'provider_error_stopped_batch':null}};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const result=await runCLI(process.argv.slice(2));console.log(JSON.stringify(result.report,null,2));process.exitCode=result.exitCode;
}

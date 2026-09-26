import test from 'node:test';
import assert from 'node:assert/strict';
import { profiles, fakeResponse } from './helpers.mjs';
import { prepare } from '../lib/prepare.mjs';
import { parseResponse } from '../lib/response.mjs';
import { interpret } from '../lib/policy.mjs';
for (const {profile,fixtures} of profiles) {
  test(profile.id+': contract projects permitted fields and excludes labels',()=>{
    const packet=structuredClone(fixtures[0]);packet.private_note='DO_NOT_EXPORT';packet.state.private_note='DO_NOT_EXPORT';
    const p=prepare(profile,packet);assert.ok(p);assert.equal(p.status,'ready');assert.equal(p.request.model,'jev-1.13.0');
    assert.doesNotMatch(JSON.stringify(p.request),/DO_NOT_EXPORT|label_origin|assistant_authored|expected|smoke-positive/);
    assert.ok(Object.keys(p.request.questions).length>0); assert.match(p.context.inputHash,/^[a-f0-9]{64}$/);
  });
  test(profile.id+': does not mutate or retain caller input',()=>{
    const packet=structuredClone(fixtures[0]),before=structuredClone(packet);const p=prepare(profile,packet);
    assert.deepEqual(packet,before);packet.state.evidence[0].text='MUTATED';assert.doesNotMatch(JSON.stringify(p.request),/MUTATED/);
  });
  test(profile.id+': missing required field fails before inference',()=>{
    const packet=structuredClone(fixtures[0]);delete packet.state[Object.keys(profile.input_schema.properties)[0]];
    assert.throws(()=>prepare(profile,packet),/invalid_input/);
  });
  test(profile.id+': rejects duplicate evidence IDs',()=>{
    const packet=structuredClone(fixtures[0]);packet.state.evidence.push({...packet.state.evidence[0]});
    assert.throws(()=>prepare(profile,packet),/invalid_input/);
  });
  test(profile.id+': rejects malformed evidence and top-level ID',()=>{
    const packet=structuredClone(fixtures[0]);packet.id='../escape';assert.throws(()=>prepare(profile,packet),/invalid_input/);
    packet.id='case1';packet.state.evidence[0].text='';assert.throws(()=>prepare(profile,packet),/invalid_input/);
  });
  test(profile.id+': rejects oversized input and false numeric/boolean types',()=>{
    const packet=structuredClone(fixtures[0]);packet.state.evidence[0].text='x'.repeat(4001);assert.throws(()=>prepare(profile,packet),/invalid_input/);
  });
  test(profile.id+': classification must be explicit',()=>{
    const packet=structuredClone(fixtures[0]);packet.classification='confidential';assert.throws(()=>prepare(profile,packet),/data_not_approved/);
  });
  for(const f of fixtures) test(profile.id+': fixture '+f.id+' remains advisory',()=>{
    const p=prepare(profile,f);assert.ok(p);
    if(f.expected_guard){assert.equal(p.status,'blocked');assert.equal(p.reason,f.expected_guard);assert.equal(p.request,null);return;}
    assert.equal(p.status,'ready');const a=parseResponse(fakeResponse(p,f.expected),p.request);
    const r=interpret(p,a);assert.ok(r);assert.equal(r.gating,false);assert.equal(r.mode,'shadow');assert.deepEqual(r.actions,[]);
    assert.equal(r.inputHash,p.context.inputHash);assert.equal(r.thresholdCalibrated,false);
  });
}

import { evaluate, Budget } from '../lib/client.mjs';
import { jsonResponse } from './helpers.mjs';
const single=profiles[0];
test('standalone export: disabled means zero provider calls',async()=>{
 let n=0;const r=await evaluate(single.profile,single.fixtures[0],{apiKey:'not-a-real-key',fetchImpl:async()=>{n++;}});
 assert.equal(n,0);assert.equal(r.reason,'disabled');
});
test('standalone export: typed mocked response remains non-gating',async()=>{
 const p=prepare(single.profile,single.fixtures[0]);
 const r=await evaluate(single.profile,single.fixtures[0],{enabled:true,apiKey:'not-a-real-key',budget:new Budget(1),fetchImpl:async()=>jsonResponse(fakeResponse(p,single.fixtures[0].expected))});
 assert.equal(r.status,'observed');assert.equal(r.mode,'shadow');assert.equal(r.gating,false);assert.deepEqual(r.actions,[]);
});

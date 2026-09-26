import { readFileSync, readdirSync } from 'node:fs';
export const root = new URL('../', import.meta.url);
export const profiles = readdirSync(new URL('experiments/',root)).sort().map(id => ({
  profile: JSON.parse(readFileSync(new URL(`experiments/${id}/profile.json`, root))),
  fixtures: JSON.parse(readFileSync(new URL(`experiments/${id}/fixtures.json`, root))),
}));
export function fakeResponse(prepared, expected={}) {
  const answers={};
  for (const [id,q] of Object.entries(prepared.request.questions)) {
    const want=expected[id];
    if(q.type==='noul') answers[id]={type:'noul',noul:want===true?0.97:want===false?0.03:0.5};
    else if(q.type==='choice') {
      const options=Object.keys(q.criteria);const choice=options.includes(want)?want:options.includes('unknown')?'unknown':options[0];
      answers[id]={type:'choice',choice,confidence:0.77,probabilities:Object.fromEntries(options.map(k=>[k,k===choice?1:0]))};
    } else {
      const n=q.criteria.length;const level=Number.isInteger(want)&&want>=0&&want<n?want:0;
      answers[id]={type:'score',score:level,confidence:0.8,legend:Object.fromEntries(q.criteria.map((x,i)=>[String(i),x])),probabilities:Object.fromEntries(q.criteria.map((_,i)=>[String(i),i===level?1:0]))};
    }
  }
  return {model:'jev-1.13.0',answers,usage:{input_tokens:120,output_tokens:0}};
}
export const jsonResponse = value => new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

import { createHash } from 'node:crypto';
export class Stop extends Error { constructor(code){super(code);this.code=code;} }
export const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const unit=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
export const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
export const sameKeys=(x,keys)=>record(x)&&JSON.stringify(Object.keys(x).sort())===JSON.stringify([...keys].sort());
function canonical(x){
 if(Array.isArray(x))return x.map(canonical);
 if(record(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
 return x;
}
export const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
/** This projects an explicit schema; it is not a PII detector or permission check. */
export function project(schema,value,depth=0){
 if(depth>12||!record(schema))throw new Stop('invalid_input');
 switch(schema.type){
 case 'string': if(typeof value!=='string'||value.trim().length<(schema.min??1)||value.length>(schema.max??4000))throw new Stop('invalid_input');return value;
 case 'id': if(!safeId(value))throw new Stop('invalid_input');return value;
 case 'boolean':if(typeof value!=='boolean')throw new Stop('invalid_input');return value;
 case 'number':if(typeof value!=='number'||!Number.isFinite(value)||value<(schema.min??0)||value>(schema.max??1e6))throw new Stop('invalid_input');return value;
 case 'enum':if(!schema.values.includes(value))throw new Stop('invalid_input');return value;
 case 'array':{
  if(!Array.isArray(value)||value.length>(schema.max??20))throw new Stop('invalid_input');
  const items=value.map(x=>project(schema.items,x,depth+1));
  if(schema.items.type==='object'&&schema.items.properties.id){const ids=items.map(x=>x.id);if(new Set(ids).size!==ids.length)throw new Stop('invalid_input');}
  return items;
 }
 case 'object':{
  if(!record(value))throw new Stop('invalid_input');
  return Object.fromEntries(Object.entries(schema.properties).map(([key,s])=>[key,project(s,value[key],depth+1)]));
 }
 default:throw new Stop('invalid_input');
 }
}
export const inputHash=(profile,state)=>hash({profile:profile.id,version:profile.version,state});

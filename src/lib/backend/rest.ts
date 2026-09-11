import {sameEnvelope,validEnvelope,validId,type Envelope,type PendingEvent} from '../game/protocol';
import type {BackendConfig} from './config';
type Field = {nullValue?: null; stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; arrayValue?: {values?: Field[]}; mapValue?: {fields?: Record<string,Field>}};
export function encode(value: unknown): Field {
 if(value===null)return {nullValue:null};
 if(typeof value==='string')return{stringValue:value};
 if(typeof value==='boolean')return{booleanValue:value};
 if(typeof value==='number'&&Number.isFinite(value))return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
 if(Array.isArray(value))return{arrayValue:{values:value.map(encode)}};
 if(value&&typeof value==='object')return{mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))}};
 throw new Error('Unsupported event value');
}
export function decode(value:Field):unknown {
 if('nullValue'in value)return null;
 if('stringValue'in value)return value.stringValue;
 if('booleanValue'in value)return value.booleanValue;
 if('integerValue'in value)return Number(value.integerValue);
 if('doubleValue'in value)return value.doubleValue;
 if(value.arrayValue)return(value.arrayValue.values??[]).map(decode);
 if(value.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([key,item])=>[key,decode(item)]));
 throw new Error('Unsupported stored value');
}
/** One atomic create; an uncertain acknowledgement is resolved by reading the exact immutable event. */
export async function appendEvent(config:BackendConfig,token:string,pending:PendingEvent) {
 if(!validId(pending.gameId)||!validId(pending.id)||!validId(config.namespace??'local')||!validEnvelope(pending.envelope))throw new Error('Invalid event');
 const origin=config.mode==='local'?'http://'+config.firestoreHost:'https://firestore.googleapis.com';
 const database='projects/'+encodeURIComponent(config.projectId)+'/databases/(default)';
 const name=database+'/documents/environments/'+(config.namespace??'local')+'/games/'+pending.gameId+'/events/'+pending.id;
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const fields=encode(pending.envelope).mapValue!.fields!;
 let response:Response|undefined;
 try{
  response=await fetch(origin+'/v1/'+database+'/documents:commit',{method:'POST',headers,body:JSON.stringify({writes:[{update:{name,fields},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]})});
 }catch{/* The write may have reached the server. Read its stable ID before deciding. */}
 if(response?.ok)return;
 if(response && response.status!==409 && response.status<500)throw new Error('The server could not accept this move.');
 const check=await fetch(origin+'/v1/'+database+'/documents:batchGet',{method:'POST',headers,body:JSON.stringify({documents:[name]})});
 if(!check.ok)throw new Error('The move is still unconfirmed.');
 const results=await check.json() as {found?:{name:string;fields:Record<string,Field>}}[];
 const found=results.find(result=>result.found?.name===name)?.found;
 if(!found)throw new Error('The move is still unconfirmed.');
 const saved=Object.fromEntries(Object.entries(found.fields).filter(([key])=>key!=='createdAt').map(([key,value])=>[key,decode(value)]));
 if(!validEnvelope(saved)||!sameEnvelope(saved as Envelope,pending.envelope))throw new Error('Room ID collision: the stored move differs.');
}

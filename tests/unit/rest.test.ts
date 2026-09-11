import {it,expect,vi,afterEach} from 'vitest';
import {appendEvent,encode,decode} from '../../src/lib/backend/rest';
import {VERSIONS,type PendingEvent} from '../../src/lib/game/protocol';
import type {BackendConfig} from '../../src/lib/backend/config';
const config:BackendConfig={mode:'local',projectId:'demo-deepsea',namespace:'local',apiKey:'test',firestoreHost:'127.0.0.1:8080'};
const pending:PendingEvent={gameId:'room',id:'tab_1',envelope:{...VERSIONS,type:'lobby/ready',actorUid:'mira',clientId:'tab',clientSeq:1,payload:{ready:true,rosterRevision:'created'}}};
const name='projects/demo-deepsea/databases/(default)/documents/environments/local/games/room/events/tab_1';
afterEach(()=>vi.unstubAllGlobals());
it('preserves JSON value types without losing large exact integers or concealed unit lists',()=>{
 const value={seed:4294967295,sequence:Number.MAX_SAFE_INTEGER,ready:false,order:['stack_t_1','t_2'],empty:[],nothing:null,name:'Mira & Sol',fraction:1.5};
 expect(decode(encode(value))).toEqual(value);expect(()=>encode(undefined)).toThrow();
});
it('creates a new event atomically with a server timestamp in one round trip',async()=>{
 const request=vi.fn().mockResolvedValue(new Response('{}',{status:200}));vi.stubGlobal('fetch',request);
 await appendEvent(config,'test-token',pending);
 expect(request).toHaveBeenCalledTimes(1);
 const [url,options]=request.mock.calls[0];expect(url).toContain('/documents:commit');
 expect(options.headers.Authorization).toBe('Bearer test-token');
 const write=JSON.parse(options.body).writes[0];
 expect(write.currentDocument).toEqual({exists:false});expect(write.updateTransforms).toEqual([{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]);
 expect(write.update.name).toBe(name);expect(decode({mapValue:{fields:write.update.fields}})).toEqual(pending.envelope);
});
it('resolves lost replies and existing IDs by reading and comparing the exact event without rewriting it',async()=>{
 for(const lost of [true,false]){
  const fetcher=vi.fn();
  if(lost)fetcher.mockRejectedValueOnce(new TypeError('reply lost'));else fetcher.mockResolvedValueOnce(new Response('{}',{status:409}));
  fetcher.mockResolvedValueOnce(Response.json([{found:{name,fields:{...encode(pending.envelope).mapValue!.fields,createdAt:{timestampValue:'2026-09-11T00:00:00Z'}}}}]));
  vi.stubGlobal('fetch',fetcher);await appendEvent(config,'test-token',pending);
  expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1][0]).toContain('/documents:batchGet');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({documents:[name]});
 }
});
it('never accepts a conflicting payload, missing event or denied operation as a saved move',async()=>{
 for(const mode of ['different','missing','denied']){
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:mode==='denied'?403:409}));
  fetcher.mockResolvedValueOnce(Response.json(mode==='missing'?[{missing:name}]:[{found:{name,fields:encode({...pending.envelope,payload:{ready:false,rosterRevision:'created'}}).mapValue!.fields}}]));
  vi.stubGlobal('fetch',fetcher);await expect(appendEvent(config,'test-token',pending)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(mode==='denied'?1:2);
 }
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(appendEvent(config,'test-token',{...pending,id:'wrong/path'})).rejects.toThrow('Invalid event');expect(fetcher).not.toHaveBeenCalled();
});

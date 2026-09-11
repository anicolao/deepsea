import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function infrastructure() {
  const load = (path, imports) => {
    const exports = {};
    const source = readFileSync(path, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, require: name => imports[name] ?? require(name), process, URL });
    return exports;
  };
  const assertions = load('tests/e2e/helpers/assertions.ts', {});
  const steps = load('tests/e2e/helpers/test-steps.ts', {
    './assertions': assertions,
    '@playwright/test': { test: { step: async (_title, body) => body() } }
  });
  const fixture = load('tests/e2e/helpers/fixture.ts', {
    '@playwright/test': { test: { extend: value => value } },
    './assertions': assertions,
    './test-steps': { assertStepsFinished() {} } // Step lifecycle has separate negative cases below.
  });
  return { ...steps, ...assertions, health: fixture.test.browserHealth, players: fixture.test.players };
}

test('runtime rejects missing TestSteps, omitted finish and empty walkthroughs', () => {
  const { TestSteps, assertStepsFinished } = infrastructure();
  assert.throws(() => assertStepsFinished({}), /Every scenario/);
  const info = {};
  const steps = new TestSteps({}, info, 'Title', 'Purpose');
  assert.throws(() => assertStepsFinished(info), /call finish/);
  assert.throws(() => steps.finish(), /at least one completed step/);
  assert.throws(() => new TestSteps({}, info, 'Title', 'Purpose'), /one TestSteps/);
});

test('runtime rejects semantic callbacks that execute no matcher before any screenshot', async () => {
  const { TestSteps } = infrastructure();
  const steps = new TestSteps({}, {}, 'Title', 'Purpose');
  await assert.rejects(steps.step('empty', 'Empty check', []), /semantic checks/);
  await assert.rejects(steps.step('empty', 'Empty check', [{ description: 'No assertion', assert: async () => {} }]), /execute an expect matcher/);
  await assert.rejects(steps.step('blank-description', 'Empty check', [{ description: ' ', assert: async () => {} }]), /require a description/);
});

test('counted assertions include negated and asynchronous matchers, not just expect construction', async () => {
  const { expect, assertionsPerformed } = infrastructure();
  expect(true);
  assert.equal(assertionsPerformed(), 0);
  expect(true).toBe(true);
  expect(true).not.toBe(false);
  await expect(Promise.resolve(42)).resolves.toBe(42);
  assert.equal(assertionsPerformed(), 3);
});

test('shared health fixture is automatic and rejects every browser/resource failure category', async () => {
  const { health } = infrastructure();
  assert.equal(health[1].auto, true);
  for (const [event, value] of [
    ['pageerror', new Error('uncaught failure')],
    ['console', { type: () => 'error', text: () => 'console failure' }],
    ['response', { status: () => 404, url: () => 'http://localhost/missing' }],
    ['requestfailed', { url: () => 'http://localhost/disconnected', failure: () => ({ errorText: 'net::ERR_FAILED' }) }],
    ['page', {}]
  ]) {
    const handlers = new Map();
    const page = { on: (name, handler) => handlers.set(name, handler) };
    const context = { route: async () => {}, on: page.on };
    await assert.rejects(health[0]({ context, page, baseURL: 'http://localhost/' }, async () => handlers.get(event)(value), {}), /No browser errors/);
  }
});

test('shared health fixture allows local assets and aborts external requests', async () => {
  const { health } = infrastructure();
  for (const external of [false, true]) {
    let handler;
    let aborted = false;
    let continued = false;
    const context = { route: async (_pattern, callback) => { handler = callback; }, on() {} };
    const page = { on() {} };
    const run = health[0]({ context, page, baseURL: 'http://localhost/' }, async () => {
      await handler({
        request: () => ({ url: () => external ? 'https://unexpected.invalid/font.woff' : 'http://localhost/font.woff' }),
        abort: async () => { aborted = true; }, continue: async () => { continued = true; }
      });
    }, {});
    if (external) await assert.rejects(run, /No browser errors/);
    else await run;
    assert.equal(aborted, external);
    assert.equal(continued, !external);
  }
});

function playerHarness() {
  const contexts = [];
  const browser = { newContext: async options => {
    const handlers = new Map();
    const context = {
      options, actionTimeout: null, navigationTimeout: null, closed: false, offline: false,
      on: (name, handler) => handlers.set(name, handler), route: async () => {},
      setDefaultTimeout: value => { context.actionTimeout = value; },
      setDefaultNavigationTimeout: value => { context.navigationTimeout = value; },
      setOffline: async value => { context.offline = value; },
      close: async () => { context.closed = true; },
      newPage: async () => {}
    };
    context.newPage = async () => {
      if (handlers.has('page')) handlers.get('page')();
      const pageHandlers = new Map();
      const page = {
        context: () => context,
        on: (name,fn) => pageHandlers.set(name,fn),
        route: async (_pattern,fn) => { page.interception=fn; },
        goto: async () => { if (page.cancellation) pageHandlers.get('requestfailed')(page.cancellation); },
        reload: async () => { if (page.cancellation) pageHandlers.get('requestfailed')(page.cancellation); },
        cancellation:null,
        emit:(name,value)=>(pageHandlers.get(name) ?? handlers.get(name))(value)
      };
      return page;
    };
    contexts.push(context);
    return context;
  } };
  const info = { project: { use: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, locale: 'en-CA', timezoneId: 'UTC', colorScheme: 'dark', contextOptions: { reducedMotion: 'reduce' }, actionTimeout: 2000, navigationTimeout: 2000 } } };
  return { browser, contexts, info };
}

test('additional contexts inherit canonical rendering, deadlines and cleanup', async () => {
  const { players } = infrastructure();
  const h = playerHarness();
  await players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
    const a = await factory.create(); const b = await factory.create();
    assert.notEqual(a.context(), b.context());
    await factory.setConnected(a, false);
    assert.equal(a.context().offline, true);
    await factory.setConnected(a, true);
    for (const context of h.contexts) {
      assert.equal(context.actionTimeout, 2000); assert.equal(context.navigationTimeout, 2000);
      assert.equal(context.options.locale, 'en-CA'); assert.equal(context.options.reducedMotion, 'reduce');
      assert.equal(context.options.serviceWorkers, 'block');
    }
  }, h.info);
  assert.ok(h.contexts.every(context => context.closed));
});

test('errors in a second player fail the scenario and still close all contexts', async () => {
  const { players } = infrastructure(); const h = playerHarness();
  await assert.rejects(players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
    await factory.create(); const guest = await factory.create();
    guest.emit('console', { type: () => 'error', text: () => 'guest failed' });
  }, h.info), /any player context/);
  assert.ok(h.contexts.every(context => context.closed));
});

test('reload cancellation classification is restricted to the exact stream, code and navigation', async () => {
  for (const [url, code, duringReload, allowed] of [
    ['http://127.0.0.1:8080/v1/projects/demo-deepsea/databases/(default)/documents:commit', 'net::ERR_ABORTED', true, true],
    ['http://127.0.0.1:8080/v1/projects/demo-deepsea/databases/(default)/documents:commit', 'net::ERR_ABORTED', false, false],
    ['http://127.0.0.1:8080/v1/projects/demo-deepsea/databases/(default)/documents:batchGet', 'net::ERR_FAILED', true, false],
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_ABORTED', true, true],
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_FAILED', true, false],
    ['http://127.0.0.1:8080/missing-resource', 'net::ERR_ABORTED', true, false],
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_ABORTED', false, false]
  ]) {
    const { players } = infrastructure(); const h = playerHarness();
    const run = players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
      const page = await factory.create();
      const failure = { url: () => url, failure: () => ({ errorText: code }) };
      if (duringReload) { page.emit('request', failure); page.cancellation = failure; await factory.reload(page); }
      else page.emit('requestfailed', failure);
    }, h.info);
    if (allowed) await run; else await assert.rejects(run, /any player context/);
  }
});

test('live browser health allows only Firebase endpoints and excludes local emulators', async () => {
  const { health } = infrastructure();
  for (const [url, allowed] of [
    ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel', true],
    ['https://identitytoolkit.googleapis.com/v1/accounts:signUp', true],
    ['https://securetoken.googleapis.com/v1/token', true],
    ['http://127.0.0.1:8080/', false],
    ['https://unrelated.googleapis.com/', false]
  ]) {
    let route;
    const run = health[0]({ context: { route: async (_pattern, handler) => { route = handler; }, on() {} }, page: { on() {} }, baseURL: 'https://anicolao.github.io/deepsea/pr5/' }, async () => {
      await route({ request: () => ({ url: () => url }), abort: async () => {}, continue: async () => {} });
    }, {});
    if (allowed) await run; else await assert.rejects(run, /No browser errors/);
  }
});

test('delayed reload cancellation belongs only to the exact old request, not a new stream', async () => {
  for (const [oldRequest, code, allowed] of [[true, 'net::ERR_ABORTED', true], [false, 'net::ERR_ABORTED', false], [true, 'net::ERR_FAILED', false]]) {
    const { players } = infrastructure(); const h = playerHarness();
    const run = players({ browser: h.browser, baseURL: 'https://anicolao.github.io/deepsea/pr5/' }, async factory => {
      const page = await factory.create();
      const old = { url: () => 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel', failure: () => ({ errorText: code }) };
      page.emit('request', old);
      await factory.reload(page);
      const current = { ...old };
      page.emit('request', current);
      page.emit('requestfailed', oldRequest ? old : current);
    }, h.info);
    if (allowed) await run; else await assert.rejects(run, /any player context/);
  }
});

test('overlap checks honor only the intended scroll panel clipping rectangle', () => {
  const source = readFileSync('tests/e2e/helpers/test-steps.ts','utf8');
  const file = ts.createSourceFile('steps.ts',source,ts.ScriptTarget.Latest,true);
  let expression;
  function find(node) { if(ts.isVariableDeclaration(node) && node.name.getText(file)==='visibleBox') expression=node.initializer.getText(file);ts.forEachChild(node,find); }
  find(file);assert.ok(expression);
  const code=ts.transpileModule(`const visibleBox = ${expression}; visibleBox;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const panel={left:0,right:300,top:100,bottom:400};
  const control=(top,bottom,inside=true)=>({getBoundingClientRect:()=>({left:10,right:100,top,bottom}),closest:()=>inside?{getBoundingClientRect:()=>panel}:null});
  const game=runInNewContext(code,{layout:'game'});
  const clipped=game(control(380,430));assert.equal(clipped.bottom,400);assert.equal(clipped.top,380);
  const outside=game(control(430,474));assert.ok(outside.bottom<=outside.top);
  const footer=game(control(430,474,false));assert.equal(footer.top,430);assert.equal(footer.bottom,474);
  const ordinary=runInNewContext(code,{layout:'room'})(control(380,430));assert.equal(ordinary.bottom,430);
  const overlapping=game(control(390,410));assert.ok(Math.min(clipped.bottom,overlapping.bottom)>Math.max(clipped.top,overlapping.top));
});

test('only recovered immutable Firestore event conflicts qualify as SDK retries', async () => {
 const url='http://127.0.0.1:8080/v1/projects/demo-deepsea/databases/(default)/documents:commit?key=local-emulator-key';
 const name='projects/demo-deepsea/databases/(default)/documents/environments/local/games/room/events/tab_3';
 const fields={type:{stringValue:'lobby/ready'}};
 for(const mode of ['same-write','verified-read','missing-ack','wrong-event','wrong-fields','wrong-status','wrong-endpoint','unconditional-verify']){
  const {health}=infrastructure();const handlers=new Map();
  const response=(status,writes,target=url,errorStatus='ALREADY_EXISTS')=>({status:()=>status,url:()=>target,request:()=>({url:()=>target,method:()=> 'POST',postDataJSON:()=>({writes})}),json:async()=>({error:{code:409,status:errorStatus}})});
  const run=health[0]({context:{route:async()=>{},on(){}},page:{on:(name,fn)=>handlers.set(name,fn)},baseURL:'http://localhost/'},async()=>{
   const target=mode==='wrong-endpoint'?'http://127.0.0.1:8080/unrelated':url;
   handlers.get('response')(response(409,[{update:{name,fields}}],target,mode==='wrong-status'?'PERMISSION_DENIED':'ALREADY_EXISTS'));
   handlers.get('console')({type:()=> 'error',text:()=> 'Failed to load resource: the server responded with a status of 409 (Conflict)',location:()=>({url:target})});
   if(mode!=='missing-ack')handlers.get('response')(response(200,mode==='verified-read'?[{verify:name,currentDocument:{updateTime:'2026-09-11T00:00:00Z'}}]:mode==='unconditional-verify'?[{verify:name}]:[{update:{name:mode==='wrong-event'?name+'other':name,fields:mode==='wrong-fields'?{changed:true}:fields}}]));
  },{});
  if(['same-write','verified-read'].includes(mode))await run;else await assert.rejects(run,/No browser errors/);
 }
});

test('completed Fetch streams require successful same-session acknowledgement advancement', async () => {
 for(const mode of ['advanced','missing-response','no-successor','stagnant','different-session','different-database','wrong-method','wrong-endpoint','wrong-code']){
  const {health}=infrastructure(), handlers=new Map();
  const url=(sid,aid,database='projects/demo/databases/(default)')=>'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?RID=rpc&SID='+sid+'&AID='+aid+'&database='+encodeURIComponent(database);
  const old={url:()=>mode==='wrong-endpoint'?'http://127.0.0.1:8080/other':url('a',3),method:()=>mode==='wrong-method'?'POST':'GET',failure:()=>({errorText:mode==='wrong-code'?'net::ERR_FAILED':'net::ERR_ABORTED'})};
  const next={url:()=>url(mode==='different-session'?'b':'a',mode==='stagnant'?3:5,mode==='different-database'?'projects/other/databases/(default)':'projects/demo/databases/(default)'),method:()=> 'GET'};
  const response=request=>({status:()=>200,url:request.url,request:()=>request});
  const run=health[0]({context:{route:async()=>{},on(){}},page:{on:(name,fn)=>handlers.set(name,fn)},baseURL:'http://localhost/'},async()=>{
   handlers.get('request')(old);
   if(mode!=='missing-response')handlers.get('response')(response(old));
   handlers.get('requestfailed')(old);
   if(mode!=='no-successor'){handlers.get('request')(next);handlers.get('response')(response(next));}
  },{});
  if(mode==='advanced')await run;else await assert.rejects(run,/No browser errors/);
 }
});

test('buffering proxy probe cancellation requires a recovered mode switch and acknowledged progress', async () => {
 for(const mode of ['recovered','missing-response','no-advance','different-session','different-database','unchanged-mode','wrong-kind','not-initial','wrong-code']){
  const {health}=infrastructure(), handlers=new Map();
  const url=(aid,ci,sid='a',database='projects/demo/databases/(default)',kind='xmlhttp')=>'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?RID=rpc&SID='+sid+'&AID='+aid+'&CI='+ci+'&TYPE='+kind+'&database='+encodeURIComponent(database);
  const old={url:()=>url(mode==='not-initial'?3:0,0),method:()=> 'GET',failure:()=>({errorText:mode==='wrong-code'?'net::ERR_FAILED':'net::ERR_ABORTED'})};
  const replacement={url:()=>url(0,mode==='unchanged-mode'?0:1,mode==='different-session'?'b':'a',mode==='different-database'?'projects/other/databases/(default)':'projects/demo/databases/(default)',mode==='wrong-kind'?'other':'xmlhttp'),method:()=> 'GET'};
  const advanced={url:()=>url(6,1),method:()=> 'GET'};
  const run=health[0]({context:{route:async()=>{},on(){}},page:{on:(name,fn)=>handlers.set(name,fn)},baseURL:'http://localhost/'},async()=>{
   handlers.get('request')(old);handlers.get('requestfailed')(old);
   handlers.get('request')(replacement);
   if(mode!=='missing-response')handlers.get('response')({status:()=>200,url:replacement.url,request:()=>replacement});
   if(mode!=='no-advance')handlers.get('request')(advanced);
  },{});
  if(mode==='recovered')await run;else await assert.rejects(run,/No browser errors/);
 }
});

test('named player navigation stays on the deployment and classifies only its old stream', async () => {
 const {players}=infrastructure();const h=playerHarness();
 await players({browser:h.browser,baseURL:'http://localhost/'},async factory=>{
  const page=await factory.create();await assert.rejects(factory.visit(page,'https://elsewhere.invalid/'),/stay on this deployment/);
  const old={url:()=> 'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel',failure:()=>({errorText:'net::ERR_ABORTED'})};
  page.emit('request',old);page.cancellation=old;await factory.visit(page,'http://localhost/rooms/?room=next');
 },h.info);
});

test('same-identity tabs are explicit, share one context and keep health checks',async()=>{
 for(const noisy of [false,true]){
  const {players}=infrastructure(),h=playerHarness();
  const run=players({browser:h.browser,baseURL:'http://localhost/'},async factory=>{
   const original=await factory.create();
   await assert.rejects(factory.create(-1),/unsigned integer/);
   await assert.rejects(factory.tab({}),/Unknown player/);
   const tab=await factory.tab(original);
   assert.notEqual(tab,original);assert.equal(tab.context(),original.context());assert.equal(h.contexts.length,1);
   if(noisy)tab.emit('pageerror',new Error('new tab failure'));
  },h.info);
  if(noisy)await assert.rejects(run,/No browser errors/);else await run;
  assert.ok(h.contexts.every(c=>c.closed));
 }
});
test('offline classification requires the registered request and exact transport error',async()=>{
 for(const mode of ['disconnected','cancelled-listen','delayed','unregistered','other-origin','other-code','online']){
  const {players}=infrastructure(),h=playerHarness();
  const run=players({browser:h.browser,baseURL:'http://localhost/'},async factory=>{
   const page=await factory.create();
   const request={url:()=>mode==='other-origin'?'https://elsewhere.invalid/asset':'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel',method:()=> 'GET',failure:()=>({errorText:mode==='other-code'?'net::ERR_FAILED':mode==='cancelled-listen'?'net::ERR_ABORTED':'net::ERR_INTERNET_DISCONNECTED'})};
   if(mode!=='unregistered')page.emit('request',request);
   if(mode!=='online')await factory.setConnected(page,false);
   if(mode==='delayed')await factory.setConnected(page,true);
   page.emit('requestfailed',request);
   await factory.setConnected(page,true);
  },h.info);
  if(['disconnected','cancelled-listen','delayed'].includes(mode))await run;else await assert.rejects(run,/No browser errors/);
 }
});
test('lost acknowledgements forward a real commit and classify exactly one induced failure',async()=>{
 for(const mode of ['lost','unarmed','unrelated-error']){
  const {players}=infrastructure(),h=playerHarness();let fetched=0,aborted=0,continued=0;
  const run=players({browser:h.browser,baseURL:'http://localhost/'},async factory=>{
   const page=await factory.create();
   await factory.loseNextAcknowledgement(page);
   if(mode==='unarmed')return;
   const request={url:()=> 'http://127.0.0.1:8080/v1/projects/demo/databases/(default)/documents:commit',method:()=> 'POST',postDataJSON:()=>({writes:[{update:{name:'projects/demo/databases/(default)/documents/environments/local/games/room/events/tab_1'}}]}),failure:()=>({errorText:'net::ERR_FAILED'})};
   const route={request:()=>request,fetch:async()=>{fetched++;return{status:()=>200};},abort:async code=>{aborted++;assert.equal(code,'failed');page.emit('requestfailed',request);page.emit('console',{type:()=> 'error',text:()=> 'Failed to load resource: net::ERR_FAILED',location:()=>({url:request.url()})});},continue:async()=>{continued++;}};
   page.emit('request',request);await page.interception(route);
   assert.equal(factory.faultCount(page),1);await page.interception(route);
   if(mode==='unrelated-error')page.emit('console',{type:()=> 'error',text:()=> 'unrelated failure'});
  },h.info);
  if(mode==='lost')await run;else await assert.rejects(run,/No browser errors/);
  if(mode!=='unarmed'){assert.equal(fetched,1);assert.equal(aborted,1);assert.equal(continued,1);}
 }
});

test('navigation tracks only old-document requests until the main frame commits',async()=>{
 for(const mode of ['old-document','new-document','other-page']){
  const {players}=infrastructure(),h=playerHarness();
  const run=players({browser:h.browser,baseURL:'http://localhost/'},async factory=>{
   const page=await factory.create(),other=await factory.create(),frame={};
   page.mainFrame=()=>frame;
   const request=()=>({url:()=> 'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel',failure:()=>({errorText:'net::ERR_ABORTED'})});
   page.goto=async()=>{
    const old=request();page.emit('request',old);
    page.emit('framenavigated',frame);
    const fresh=request(),target=mode==='other-page'?other:page;target.emit('request',fresh);
    target.emit('requestfailed',mode==='old-document'?old:fresh);
   };
   await factory.visit(page,'http://localhost/rooms/?room=next');
  },h.info);
  if(mode==='old-document')await run;else await assert.rejects(run,/No browser errors/);
 }
});
test('a recovered create conflict needs a matching immutable document from the server read',async()=>{
 for(const mode of ['matching','different-document','different-fields','missing-version']){
  const {health}=infrastructure(),handlers=new Map();
  const name='projects/demo/databases/(default)/documents/environments/local/games/room/events/tab_1';
  const fields={payload:{mapValue:{fields:{ready:{booleanValue:true},rosterRevision:{stringValue:'created'}}}},type:{stringValue:'lobby/ready'}};
  const commit='http://127.0.0.1:8080/v1/projects/demo/databases/(default)/documents:commit';
  const read=commit.replace(':commit',':batchGet');
  const found={name:mode==='different-document'?name+'other':name,fields:mode==='different-fields'?{changed:{booleanValue:true}}:{type:fields.type,payload:fields.payload,createdAt:{timestampValue:'2026-09-11T00:00:00Z'}},...(mode==='missing-version'?{}:{updateTime:'2026-09-11T00:00:00Z'})};
  const run=health[0]({context:{route:async()=>{},on(){}},page:{on:(event,fn)=>handlers.set(event,fn)},baseURL:'http://localhost/'},async()=>{
   handlers.get('response')({status:()=>409,url:()=>commit,request:()=>({url:()=>commit,method:()=> 'POST',postDataJSON:()=>({writes:[{update:{name,fields}}]})}),json:async()=>({error:{code:409,status:'ALREADY_EXISTS'}})});
   handlers.get('response')({status:()=>200,url:()=>read,request:()=>({url:()=>read,method:()=> 'POST',postDataJSON:()=>({documents:[name]})}),json:async()=>[{found}]});
  },{});
  if(mode==='matching')await run;else await assert.rejects(run,/No browser errors/);
 }
});

test('routing bypasses only configured backend origins while retaining the origin gate',async()=>{
 for(const hosted of [false,true]){
  const {health}=infrastructure();let pattern;
  await health[0]({context:{route:async p=>{pattern=p;},on(){}},page:{on(){}},baseURL:hosted?'https://anicolao.github.io/deepsea/pr6/':'http://localhost/'},async()=>{},{});
  const firebase='https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents:commit';
  const emulator='http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel';
  assert.equal(pattern.test(firebase),!hosted);assert.equal(pattern.test(emulator),hosted);
  for(const url of ['https://firestore.googleapis.com.evil.invalid/','https://firestore.googleapis.com:444/','http://127.0.0.1:8081/','https://www.google.com/images/cleardot.gif','http://localhost/backend.json'])assert.equal(pattern.test(url),true);
 }
});

test('concurrent screenshot checks cannot borrow another check’s assertions',async()=>{
 const {assertionScope,expect}=infrastructure();
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const counts=await Promise.all([
  assertionScope(async()=>{await gate;}),
  assertionScope(async()=>{expect(true).toBe(true);release();})
 ]);
 assert.deepEqual(counts,[0,1]);
});

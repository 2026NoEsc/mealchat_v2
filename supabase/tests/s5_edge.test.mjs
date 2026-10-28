import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { runEdgeVm } from './edge_vm.mjs';
import ts from 'typescript';
const base=new URL('../functions/schedule-recommend/',import.meta.url);
const logs=[];
const load=async(name,require=()=>{throw Error('Unexpected import');})=>{
 const source=await fs.readFile(new URL(name,base),'utf8'),module={exports:{}};
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(result.diagnostics.length,0);
 runEdgeVm(result.outputText,{module,exports:module.exports,require,Response,Request,TextEncoder,TextDecoder,Uint8Array,URL,URLSearchParams,AbortSignal,
 console:{error:(...args)=>logs.push(args),warn:(...args)=>logs.push(args)},Deno:{env:{get:()=>undefined}}});
 return module.exports;
};
const s5=await load('s5Recommendation.ts');
const pipeline=await load('pipeline.ts');
const s4Availability=await load('s4Availability.ts');
const A='10000001-0000-4000-8000-000000000001',room='21000000-0000-4000-8000-000000000001',rid='51000000-0000-4000-8000-000000000001',token='61000000-0000-4000-8000-000000000001';
const body={contract_version:2,request_id:rid,room_id:room,purpose:'places'};
const area={id:'public-center',label:'Public center',latitude:37.5665,longitude:126.978,radius_m:2000};
const poi=(id='1',extra={})=>({id,name:'Provider name - never prompt',frontLat:'37.5665',frontLon:'126.9780',upperBizName:'음식',middleBizName:'한식',upperAddrName:'Public address - never prompt',...extra});
const pois=(items)=>({searchPoiInfo:{pois:{poi:items}}});
const model=(order)=>({candidates:[{content:{parts:[{text:JSON.stringify({order})}]}}]});
const env={get:k=>({SUPABASE_URL:'http://127.0.0.1:55321',SUPABASE_ANON_KEY:'synthetic-public',TMAP_API_KEY:'synthetic-tmap',GEMINI_API_KEY:'synthetic-gemini'}[k])};
const finalResult=(source='rules',places=[])=>({contract_version:2,request_id:rid,valid_until:'2099-01-01T00:00:00Z',source,area,
 places_status:places.length?'ready':'empty',slots_status:'not_requested',slot_recommendations:[],my_health_filter:'not_requested',
 place_recommendations:places.slice(0,3).map((p,i)=>({place_id:p.id,menu_id:null,rank:i+1,place:{name:p.name,address:p.address,latitude:p.latitude,longitude:p.longitude},reason_code:'PUBLIC_AREA_RECOMMENDATION',evidence_status:'unverified'}))});

async function scenario({ticketStatus='pending',beginError,claimError,finalError,modelStatus=200,modelValue=model(['p1']),poiStatus=200,poiValue=pois([poi()]),failModel=false,failPoi=false,noGemini=false,callBody=body,keywords=['korean'],recoveredStatus='pending',recoverError,noTmap=false,failRecord=false}={}) {
 const trace=[],network=[],adminCalls=[];let begins=0;
 const fetchMock=async(url,opts={})=>{
  const u=String(url);network.push({url:u,opts});trace.push(u.includes('/rpc/')?'begin':u.includes('openapi.sk.com')?'tmap':'gemini');
  if(u.includes('/rpc/')) {
   assert.equal(opts.headers.Authorization,'Bearer synthetic-user');assert.equal(opts.headers.apikey,'synthetic-public');
   assert.equal(JSON.parse(opts.body).p_room_id,room);
   begins++;const error=begins>1?recoverError:beginError,status=begins>1?recoveredStatus:ticketStatus;
   return Response.json(error?{code:error}:{contract_version:2,request_id:rid,status,valid_until:'2099-01-01Z',result:status==='complete'?finalResult():null},{status:error?400:200});
  }
  if(u.includes('openapi.sk.com')){if(failPoi)throw Error('private transport detail');return Response.json(poiValue,{status:poiStatus});}
  if(failModel)throw Error('private response detail');
  return Response.json(modelValue,{status:modelStatus});
 };
 const admin=async(name,args)=>{
  trace.push(name.startsWith('claim')?'claim':name.startsWith('fail_')?'fail':'finalize');adminCalls.push({name,args});
  if(name.startsWith('fail_'))return {data:null,error:failRecord?{code:'42501'}:null};
  if(name.startsWith('claim'))return {data:claimError?null:{work_token:token,area,keywords},error:claimError?{code:claimError}:null};
  return {data:finalError?null:finalResult(args.p_source,args.p_candidates.places),error:finalError?{code:finalError}:null};
 };
 const response=await s5.runS5Places(callBody,{get:k=>noTmap&&k==='TMAP_API_KEY'?'   ':noGemini&&k==='GEMINI_API_KEY'?undefined:env.get(k)},'Bearer synthetic-user',admin,fetchMock);
 return {response,result:await response.json(),trace,network,adminCalls};
}
test('strict body rejects health location candidates ids and unknown purposes',async()=>{
 for(const patch of [{health:['egg']},{placeCandidates:[]},{latitude:37},{user_id:A},{request_id:'bad'}]) {
  const x=await scenario({callBody:{...body,...patch}});assert.equal(x.response.status,400);assert.equal(x.network.length,0);assert.equal(x.adminCalls.length,0);
 }
});
test('unsupported v2 purposes require a client update',async()=>{for(const purpose of ['slots','both']){const x=await scenario({callBody:{...body,purpose}});assert.equal(x.response.status,426);assert.equal(x.network.length,0);}});
test('places request does not require availability and follows user then worker order',async()=>{
 const x=await scenario();assert.equal(x.response.status,200);assert.deepEqual(x.trace,['begin','claim','tmap','gemini','finalize']);assert.equal(x.result.source,'gemini');
});
test('Tmap request is fixed public-area search, not preference or health search',async()=>{
 const x=await scenario();const call=x.network.find(x=>x.url.includes('openapi.sk.com')),u=new URL(call.url);
 assert.equal(u.origin,'https://apis.openapi.sk.com');assert.equal(u.searchParams.get('categories'),'음식');assert.equal(u.searchParams.get('radius'),'2');
 assert.equal(u.searchParams.get('centerLat'),String(area.latitude));assert.equal(call.opts.redirect,'error');
 assert.ok(!call.url.includes('korean'));assert.ok(!call.url.includes(A));
});
test('Gemini allowlist contains only temporary ids, category and upper keywords',async()=>{
 const x=await scenario();const text=x.network.find(x=>x.url.includes('generativelanguage')).opts.body;
 const prompt=JSON.parse(JSON.parse(text).contents[0].parts[0].text);
 assert.deepEqual(Object.keys(prompt).sort(),['candidates','keywords','task']);assert.deepEqual(prompt.keywords,['korean']);
 assert.deepEqual(Object.keys(prompt.candidates[0]).sort(),['cuisine_codes','id']);
 for(const secret of ['Provider name','Public address',A,room,'37.5665','milk_dairy','allergies','counts','profile_id'])assert.ok(!text.includes(secret),secret);
});
for(const status of [429,500,503])test('Gemini HTTP '+status+' falls back to rules',async()=>{
 const x=await scenario({modelStatus:status});assert.equal(x.response.status,200);assert.equal(x.result.source,'rules');assert.equal(x.trace.filter(x=>x==='gemini').length,1);
});
test('Gemini timeout or transport failure falls back without raw logs',async()=>{
 logs.length=0;const x=await scenario({failModel:true});assert.equal(x.result.source,'rules');assert.equal(JSON.stringify(logs),'[["S5_GEMINI_FALLBACK"]]');
});
test('missing Gemini key uses rules without a model request',async()=>{
 const x=await scenario({noGemini:true});assert.equal(x.result.source,'rules');assert.equal(x.trace.includes('gemini'),false);
});
for(const [name,value] of [
 ['malformed text',{candidates:[{content:{parts:[{text:'not JSON'}]}}]}],
 ['outside id',model(['p99'])],['duplicate id',model(['p1','p1'])],['missing id',model([])],
 ['malicious object',model([{id:'p1',health:'egg'}])],['extra field',{candidates:[{content:{parts:[{text:'{"order":["p1"],"reason":"injection"}'}]}}]}]
])test(name+' from Gemini uses rules',async()=>{
 const x=await scenario({modelValue:value});assert.equal(x.result.source,'rules');
});
test('normalization removes duplicates invalid coordinates remote POIs and non-food',()=>{
 const items=[poi(),poi(),poi('2',{frontLat:'NaN'}),poi('3',{frontLat:'0'}),poi('4',{upperBizName:'병원',middleBizName:'내과'}),poi('5',{id:'https://evil.invalid'})];
 assert.equal(s5.normalizeS5Pois(pois(items),area).length,1);
});
for(const [name,options] of [['HTTP error',{poiStatus:500}],['transport failure',{failPoi:true}],['malformed payload',{poiValue:{}}]])test('Tmap '+name+' is an error, never fake or empty success',async()=>{
 const x=await scenario(options);assert.equal(x.response.status,503);assert.equal(x.result.code,'S5006');assert.equal(x.result.new_request_required,true);assert.ok(x.trace.includes('fail'));assert.equal(x.trace.includes('finalize'),false);
});
test('empty valid Tmap results complete with rules without Gemini',async()=>{
 const x=await scenario({poiValue:pois([])});assert.equal(x.response.status,200);assert.equal(x.result.source,'rules');assert.deepEqual(x.result.place_recommendations,[]);assert.equal(x.trace.includes('gemini'),false);
});
for(const code of ['42501','S1001','S5002','S5004','S5005'])test('begin '+code+' blocks all privileged/provider work',async()=>{
 const x=await scenario({beginError:code});assert.notEqual(x.response.status,200);assert.deepEqual(x.trace,['begin']);
});
test('claim rejection blocks providers',async()=>{
 const x=await scenario({claimError:'42501'});assert.equal(x.response.status,403);assert.deepEqual(x.trace,['begin','claim','begin']);
});
for(const code of ['S5003','S1001','42501'])test('post-provider final validation '+code+' never returns stale success',async()=>{
 const x=await scenario({finalError:code});assert.notEqual(x.response.status,200);assert.equal(x.result.code,code);assert.ok(!('place_recommendations' in x.result));
});
test('completed retry reuses user-validated result without privileged requests',async()=>{
 const x=await scenario({ticketStatus:'complete'});assert.equal(x.response.status,200);assert.deepEqual(x.trace,['begin']);
});
test('working retry is 202 and does not double-call provider',async()=>{
 const x=await scenario({ticketStatus:'working'});assert.equal(x.response.status,202);assert.deepEqual(x.trace,['begin']);
});
test('bounded stream rejects oversized and malformed bodies',async()=>{
 for(const text of ['x'.repeat(40000),'{"bad":']) await assert.rejects(()=>s5.readBoundedJson(new Request('http://local',{method:'POST',body:text})));
});
test('helper typechecks strictly with no emit',()=>{
 const file=new URL('s5Recommendation.ts',base).pathname.replace(/^\/([A-Za-z]:)/,'$1');
 const program=ts.createProgram([file],{strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,lib:['lib.es2022.d.ts','lib.dom.d.ts'],types:[]});
 const errors=ts.getPreEmitDiagnostics(program);assert.equal(errors.length,0,errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));
});
test('actual handler verifies caller and required consent before S5 dispatch',async()=>{
 const gateSource=await load('consentGate.ts');
 const handlerSource=await fs.readFile(new URL('index.ts',base),'utf8');const module={exports:{}};let calls=0,provider=0;
 const Deno={env};
 const fetchMock=async()=>{calls++;return Response.json({contract_version:1,bundle_version:'fixture',required:{status:'required',service_agreed:false,privacy_agreed:false}});};
 const req=id=>{
  if(id==='./s4Availability.ts')return s4Availability;
  if(id==='@supabase/server')return {withSupabase:(options,fn)=>{assert.equal(options.auth,'user');return fn;}};
  if(id==='./pipeline.ts')return {...pipeline,callGeminiWithRetry:(url,options)=>pipeline.callGeminiWithRetry(url,options,{fetchImpl:fetchMock})};
  if(id==='./consentGate.ts')return {...gateSource,checkRequiredConsent:(...args)=>gateSource.checkRequiredConsent(...args,fetchMock)};
  if(id==='./s5Recommendation.ts')return {...s5,runS5Places:()=>{provider++;throw Error('must not reach');}};
  if(id.startsWith('@supabase/functions-js'))return {};
  throw Error('unknown import '+id);
 };
 runEdgeVm(ts.transpileModule(handlerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,require:req,Deno,Request,Response,TextEncoder,AbortSignal,console:{error(){}}});
 const context={jwtClaims:{sub:A,role:'authenticated',aud:'authenticated',iss:'http://127.0.0.1:55321/auth/v1',exp:Date.now()/1000+600},userClaims:{id:A},supabaseAdmin:{rpc(){provider++;throw Error('must not reach');}}};
 const result=await module.exports.default.fetch(new Request('http://local',{method:'POST',headers:{Authorization:'Bearer synthetic-user'},body:JSON.stringify(body)}),context);
 assert.equal(result.status,403);assert.equal(calls,1);assert.equal(provider,0);
});

test('strict result allowlist strips internal metadata from both fresh and cached result',()=>{
 const input={...finalResult(),work_token:token,context_hash:'secret',keywords:['korean'],counts:{korean:2},health:'private'};
 const output=s5.sanitizeS5Result(input);
 for(const key of ['work_token','context_hash','keywords','counts','health'])assert.equal(key in output,false);
});
test('unexpected health-complete claim is rejected instead of forwarded',()=>{
 assert.throws(()=>s5.sanitizeS5Result({...finalResult(),my_health_filter:'applied'}));
});
test('expired cached result is rejected at Edge response boundary',()=>{
 assert.throws(()=>s5.sanitizeS5Result({...finalResult(),valid_until:'2000-01-01T00:00:00Z'}));
});

async function actualHandler({consentAccepted=true,missingGemini=false,legacyBody=false,legacyTime=false,oversized=false,badCaller=false}={}) {
 const gate=await load('consentGate.ts');const code=await fs.readFile(new URL('index.ts',base),'utf8');const module={exports:{}},trace=[];
 const fetchMock=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('get_my_consent_status')){trace.push('consent');return Response.json({contract_version:1,bundle_version:'fixture',required:{status:consentAccepted?'accepted':'required',service_agreed:consentAccepted,privacy_agreed:consentAccepted}});}
  if(u.includes('room_availability_status')){trace.push('permission');return Response.json([{profile_id:A}]);}
  if(u.includes('/rpc/begin_room')){trace.push('begin');assert.equal(opts.headers.Authorization,'Bearer synthetic-user');return Response.json({contract_version:2,request_id:rid,status:'pending'});}
  if(u.includes('openapi.sk.com')){trace.push('tmap');return Response.json(pois([poi()]));}
  trace.push('gemini');if(legacyTime){const request=JSON.parse(opts.body),schema=request.generationConfig.responseJsonSchema;assert.equal('placeRecommendations' in schema.properties,false);assert.equal(schema.required.includes('placeRecommendations'),false);assert.ok(schema.properties.slotRecommendations.minItems>0);assert.ok(schema.properties.slotRecommendations.items.properties.rank.maximum>=1);const prompt=JSON.parse(request.contents[0].parts[0].text);assert.equal(prompt.placeCount,0);assert.deepEqual(prompt.placeCandidates,[]);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({slotRecommendations:prompt.candidates.slice(0,3).map((x,i)=>({slotId:x.slotId,rank:i+1,score:99,reason:'Synthetic time reason'}))})}]}}]});}return Response.json(model(['p1']));
 };
 const req=id=>{
  if(id==='./s4Availability.ts')return s4Availability;
  if(id==='@supabase/server')return {withSupabase:(_options,fn)=>fn};
  if(id==='./pipeline.ts')return {...pipeline,callGeminiWithRetry:(url,options)=>pipeline.callGeminiWithRetry(url,options,{fetchImpl:fetchMock})};
  if(id==='./consentGate.ts')return {...gate,checkRequiredConsent:(...args)=>gate.checkRequiredConsent(...args,fetchMock),checkRoomPermission:(...args)=>gate.checkRoomPermission(...args,fetchMock)};
  if(id==='./s5Recommendation.ts')return {...s5,runS5Places:(b,e,a,admin)=>s5.runS5Places(b,e,a,admin,fetchMock)};
  if(id.startsWith('@supabase/functions-js'))return {};throw Error('Unexpected module');
 };
 runEdgeVm(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {module,exports:module.exports,require:req,Response,Request,TextEncoder,AbortSignal,fetch:fetchMock,Deno:{env:{get:k=>missingGemini&&k==='GEMINI_API_KEY'?undefined:env.get(k)}},console:{error(){},warn(){}}});
 const payload=legacyTime?{meetingName:'Legacy time',roomId:room,placeCandidates:[]}:legacyBody?{meetingName:'Legacy',roomId:room,placeCandidates:[{id:'forged'}]}:body;
 const context={jwtClaims:{sub:A,role:'authenticated',aud:'authenticated',iss:'http://127.0.0.1:55321/auth/v1',exp:Date.now()/1000+600},
  userClaims:{id:badCaller?room:A},supabaseAdmin:{from:(table)=>{if(table==='rooms')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{expires_at:'2099-01-01Z'},error:null})})})};assert.equal(table,'participants');trace.push('availability');return {select:columns=>{assert.equal(columns,'profile_id, schedule');return {eq:async()=>({data:[{profile_id:A,schedule:{slots:['2030-01-01-12']}}],error:null})};}};},rpc:async(name,args)=>{
   if(name.startsWith('claim')){assert.equal(trace.at(-1),'begin');trace.push('claim');return {data:{work_token:token,area,keywords:['korean']},error:null};}
   trace.push('finalize');return {data:finalResult(args.p_source,args.p_candidates.places),error:null};
  }}};
 const response=await module.exports.default.fetch(new Request('http://local',{method:'POST',headers:{Authorization:'Bearer synthetic-user'},body:JSON.stringify(payload)+(oversized?' '.repeat(9000):'')}),context);
 return {response,result:await response.json(),trace};
}
test('actual accepted handler runs the S5 user-ticket and worker/provider chain',async()=>{
 const x=await actualHandler();assert.equal(x.response.status,200);assert.equal(x.result.source,'gemini');
 assert.deepEqual(x.trace,['consent','begin','claim','tmap','gemini','finalize']);
});
test('actual S5 handler reaches rules before the legacy mandatory Gemini-key check',async()=>{
 const x=await actualHandler({missingGemini:true});assert.equal(x.response.status,200);assert.equal(x.result.source,'rules');
 assert.deepEqual(x.trace,['consent','begin','claim','tmap','finalize']);
});
test('actual handler refuses legacy client-supplied restaurant candidates',async()=>{
 const x=await actualHandler({legacyBody:true});assert.equal(x.response.status,426);assert.deepEqual(x.trace,['consent']);
});
test('actual handler bounds raw bytes including JSON whitespace before providers',async()=>{
 const x=await actualHandler({oversized:true});assert.equal(x.response.status,400);assert.deepEqual(x.trace,['consent']);
});
test('actual handler rejects a mismatched caller before any RPC',async()=>{
 const x=await actualHandler({badCaller:true});assert.equal(x.response.status,401);assert.deepEqual(x.trace,[]);
});

for(const status of ['working','complete'])test('claim race is recovered as '+status+' using authorized begin',async()=>{
 const x=await scenario({claimError:'42501',recoveredStatus:status});assert.equal(x.response.status,status==='working'?202:200);assert.deepEqual(x.trace,['begin','claim','begin']);
});
for(const code of ['42501','S1001','S5006'])test('claim race recovery never bypasses '+code,async()=>{
 const x=await scenario({claimError:'42501',recoverError:code});assert.equal(x.result.code,code);assert.equal(x.trace.includes('tmap'),false);
});
test('missing or blank Tmap key leaves pending id reusable without claiming',async()=>{
 const x=await scenario({noTmap:true});assert.equal(x.response.status,503);assert.equal(x.result.code,'S5006');assert.equal(x.result.new_request_required,false);assert.deepEqual(x.trace,['begin']);
});
test('failed ticket replay explicitly requires a new request id',async()=>{
 const x=await scenario({beginError:'S5006'});assert.equal(x.result.new_request_required,true);assert.deepEqual(x.trace,['begin']);
});
test('failure recording rejection still tells the caller to use a new id',async()=>{
 const x=await scenario({failPoi:true,failRecord:true});assert.equal(x.result.new_request_required,true);assert.equal(x.result.code,'S5006');
});
test('actual legacy time-only handler succeeds with empty restaurant candidates',async()=>{
 const x=await actualHandler({legacyTime:true});assert.equal(x.response.status,200,JSON.stringify(x.result));assert.ok(x.result.slotRecommendations.length>0);assert.deepEqual(x.result.placeRecommendations,[]);assert.deepEqual(x.trace,['consent','permission','availability','gemini']);
});
test('recommendation SQL and Edge never reference health tables or individual origins',async()=>{
 const sql=await fs.readFile(new URL('../migrations/20261018131946_s5_recommendation_worker_boundary.sql',import.meta.url),'utf8');
 const areaSql=await fs.readFile(new URL('../migrations/20261018131943_s5_recommendation_public_area.sql',import.meta.url),'utf8');
 const edge=await fs.readFile(new URL('s5Recommendation.ts',base),'utf8');
 const index=await fs.readFile(new URL('index.ts',base),'utf8');
 for(const code of [sql,areaSql,edge,index])assert.doesNotMatch(code,/profile_health_preferences|profile_private|profile_consent_states|personal_data|meeting_midpoint/);
 assert.match(sql,/kind in\('service','privacy'\)/);
});

test('same request_id concurrent Edge calls return one success and one 202 with one provider invocation',async()=>{
 let state='pending',initial=0,beginCount=0,providers=0,releaseBoth,releaseRecovery;
 const both=new Promise(r=>releaseBoth=r),recovery=new Promise(r=>releaseRecovery=r);
 const fetchMock=async(url)=>{
  if(String(url).includes('/rpc/')){beginCount++;if(initial<2){initial++;if(initial===2)releaseBoth();await both;return Response.json({contract_version:2,request_id:rid,status:'pending'});}
   releaseRecovery();return Response.json({contract_version:2,request_id:rid,status:state,valid_until:'2099-01-01Z',result:state==='complete'?finalResult():null});}
  if(String(url).includes('openapi.sk.com')){providers++;await recovery;return Response.json(pois([poi()]));}
  return Response.json(model(['p1']));
 };
 const admin=async(name,args)=>{
  if(name.startsWith('claim')){if(state!=='pending')return {data:null,error:{code:'42501'}};state='working';return {data:{work_token:token,area,keywords:[]},error:null};}
  state='complete';return {data:finalResult(args.p_source,args.p_candidates.places),error:null};
 };
 const responses=await Promise.all([s5.runS5Places(body,env,'Bearer synthetic-user',admin,fetchMock),s5.runS5Places(body,env,'Bearer synthetic-user',admin,fetchMock)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,202]);assert.equal(providers,1);assert.equal(beginCount,3);
});

test('every Edge VM defaults to a throwing fetch when a mock is omitted',async()=>{
 assert.throws(()=>runEdgeVm('fetch("https://example.invalid")'),/EDGE_TEST_NETWORK_DISABLED/);
 assert.throws(()=>runEdgeVm('0',{fetch:globalThis.fetch}),/EDGE_TEST_HOST_FETCH_FORBIDDEN/);
 await assert.rejects(()=>pipeline.callGeminiWithRetry('https://example.invalid',{}, {sleep:async()=>{}}),/EDGE_TEST_NETWORK_DISABLED/);
 for(const file of ['s1_edge_gate.test.mjs','s5_edge.test.mjs']) {
  const code=await fs.readFile(new URL(file,import.meta.url),'utf8');assert.ok(code.includes("import { runEdgeVm } from './edge_vm.mjs'"));assert.ok(!code.includes('vm.runInNew'+'Context('));
 }
});

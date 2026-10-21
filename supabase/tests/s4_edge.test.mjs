import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {runEdgeVm} from './edge_vm.mjs';
const base=new URL('../functions/schedule-recommend/',import.meta.url);
async function load(name,require=()=>{throw Error('Unexpected import');},globals={}) {
 const module={exports:{}},source=await fs.readFile(new URL(name,base),'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(result.diagnostics.length,0);
 runEdgeVm(result.outputText,{module,exports:module.exports,require,Response,Request,TextEncoder,TextDecoder,URL,URLSearchParams,AbortSignal,console:{error(){},warn(){}},Deno:{env:{get:()=>undefined}},...globals});
 return module.exports;
}
const norm=await load('s4Availability.ts'),pipeline=await load('pipeline.ts'),gate=await load('consentGate.ts'),s5=await load('s5Recommendation.ts');
const A='10000001-0000-4000-8000-000000000001',B='10000002-0000-4000-8000-000000000002',room='24000000-0000-4000-8000-000000000001';
const row=(id,slots)=>({profile_id:id,schedule:{slots},name:'Never prompt',health:'Never prompt'});
const normalize=(rows,expiry='2030-01-03T00:00:00Z',now='2030-01-01T00:00:00Z')=>JSON.parse(JSON.stringify(norm.normalizeAvailabilityRows(rows,expiry,Date.parse(now))));
test('pure eligibility excludes NULL and malformed display rows and projects only slots',()=>{
 const x=normalize([row(null,['2030-01-02-11']),row(A,['2030-01-02-12']),{},null,row('',[])]);
 assert.deepEqual(x,[{profile_id:A,schedule:{slots:['2030-01-02-12']}}]);
});
for(const key of ['2030-02-30-11','2030-02-29-11','2030-13-01-11','2030-00-01-11','2030-01-00-11','2030-01-01-10','2030-01-01-21','2030-1-01-11',null,42])test('normalization ignores invalid cell '+key,()=>assert.deepEqual(normalize([row(A,[key])])[0].schedule.slots,[]));
test('normalization sorts and deduplicates valid cells',()=>assert.deepEqual(normalize([row(A,['2030-01-02-13','2030-01-02-12','2030-01-02-13'])])[0].schedule.slots,['2030-01-02-12','2030-01-02-13']));
test('leap year actual calendar is accepted',()=>assert.deepEqual(normalize([row(A,['2032-02-29-11'])],'2032-03-01Z')[0].schedule.slots,['2032-02-29-11']));
test('exact start is past while exact expiry end is valid',()=>{
 assert.deepEqual(normalize([row(A,['2030-01-01-11'])],'2030-01-01T03:00:00Z','2030-01-01T02:00:00Z')[0].schedule.slots,[]);
 assert.deepEqual(normalize([row(A,['2030-01-01-11'])],'2030-01-01T03:00:00Z','2030-01-01T01:59:59.999Z')[0].schedule.slots,['2030-01-01-11']);
 assert.deepEqual(normalize([row(A,['2030-01-01-11'])],'2030-01-01T02:59:59.999Z')[0].schedule.slots,[]);
});
test('invalid expiry never yields a submitted row',()=>assert.deepEqual(normalize([row(A,['2030-01-01-11'])],'invalid'),[]));
test('nonfinite expiry fails availability normalization closed',()=>assert.deepEqual(normalize([row(A,['2030-01-01-11'])],'infinity'),[]));
async function handler(rows,{expiry='2099-01-01T00:00:00Z',caller=A,participantsError=false,supabaseUrl='http://127.0.0.1:55321',issuer='http://127.0.0.1:55321/auth/v1',localAuthIssuer,geminiKey='synthetic-gemini',claims={}}={}) {
 let providerCalls=0,consentCalls=0,adminCalls=0,prompt;
 const fetchMock=async(url,options)=>{
  if(String(url).includes('get_my_consent_status')){consentCalls++;assert.ok(String(url).startsWith(supabaseUrl+'/'));return Response.json({contract_version:1,bundle_version:'fixture',required:{status:'accepted',service_agreed:true,privacy_agreed:true}});}
  if(String(url).includes('room_availability_status'))return Response.json([{profile_id:A}]);
  assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'),'only synthetic Gemini transport is allowed');
  providerCalls++;const body=JSON.parse(options.body);prompt=JSON.parse(body.contents[0].parts[0].text);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({slotRecommendations:prompt.candidates.slice(0,3).map((x,i)=>({slotId:x.slotId,rank:i+1,score:99,reason:'Synthetic reason'}))})}]}}]});
 };
 const req=id=>{
  if(id==='@supabase/server')return {withSupabase:(o,fn)=>{assert.equal(o.auth,'user');return fn;}};
  if(id==='./s4Availability.ts')return norm;
  if(id==='./pipeline.ts')return {...pipeline,callGeminiWithRetry:(u,o)=>pipeline.callGeminiWithRetry(u,o,{fetchImpl:fetchMock})};
  if(id==='./consentGate.ts')return {...gate,checkRequiredConsent:(...a)=>gate.checkRequiredConsent(...a,fetchMock),checkRoomPermission:(...a)=>gate.checkRoomPermission(...a,fetchMock)};
  if(id==='./s5Recommendation.ts')return {...s5,runS5Places:()=>{throw Error('Not requested');}};
  if(id.startsWith('@supabase/functions-js'))return {};throw Error('Unexpected import '+id);
 };
 const module=await load('index.ts',req,{Deno:{env:{get:k=>({SUPABASE_URL:supabaseUrl,SUPABASE_ANON_KEY:'synthetic-public',GEMINI_API_KEY:geminiKey,MEALCHAT_LOCAL_AUTH_ISSUER:localAuthIssuer}[k])}},fetch:fetchMock});
 const context={jwtClaims:{sub:caller,role:'authenticated',aud:'authenticated',iss:issuer,exp:Date.now()/1000+600,...claims},userClaims:{id:caller},supabaseAdmin:{from:table=>{
  adminCalls++;
  if(table==='participants')return {select:columns=>{assert.equal(columns,'profile_id, schedule');return {eq:async()=>({data:rows,error:participantsError?{}:null})};}};
  assert.equal(table,'rooms');return {select:columns=>{assert.equal(columns,'expires_at');return {eq:()=>({maybeSingle:async()=>({data:{expires_at:expiry},error:null})})};}};
 }}};
 const response=await module.default.fetch(new Request('http://local',{method:'POST',headers:{Authorization:'Bearer synthetic-user'},body:JSON.stringify({meetingName:'Synthetic',roomId:room,placeCandidates:[]})}),context);
 return {response,result:await response.json(),providerCalls,consentCalls,adminCalls,prompt};
}
test('actual time handler excludes NULL profiles from denominator and provider input',async()=>{
 const x=await handler([row(A,['2030-01-01-11']),row(B,['2030-01-01-11']),row(null,[])]);
 assert.equal(x.response.status,200,JSON.stringify(x.result));assert.equal(x.providerCalls,1);
 assert.ok(x.prompt.candidates.every(x=>x.totalCount===2&&x.availableCount===2));
 for(const forbidden of [A,B,room,'Never prompt','profile_id','health'])assert.ok(!JSON.stringify(x.prompt).includes(forbidden),forbidden);
});
for(const slots of [[],['2020-01-01-11'],['2030-02-30-11'],null])test('actual handler blocks an eligible unsubmitted member '+JSON.stringify(slots),async()=>{
 const x=await handler([row(A,['2030-01-01-11']),row(B,slots)]);assert.equal(x.response.status,409);assert.equal(x.result.code,'S4004');assert.equal(x.providerCalls,0);
});
test('adjacent disjoint availability never produces a zero-attendee interval',async()=>{
 const x=await handler([row(A,['2030-01-01-11']),row(B,['2030-01-01-12'])]);assert.equal(x.response.status,200,JSON.stringify(x.result));
 assert.equal(x.prompt.candidates.length,2);assert.ok(x.prompt.candidates.every(x=>x.availableCount===1&&x.totalCount===2));
 assert.ok(x.prompt.candidates.every(x=>x.startTime!== '11:00'||x.endTime==='12:00'));
});
for(const [label,options] of [['expired',{expiry:'2020-01-01Z'}],['nonmember',{caller:'10000003-0000-4000-8000-000000000003'}],['invalid expiry',{expiry:'bad'}]])test('actual handler denies '+label+' before provider',async()=>{
 const x=await handler([row(A,['2030-01-01-11'])],options);assert.equal(x.response.status,403);assert.equal(x.providerCalls,0);
});
test('participant load failure remains an error with no provider',async()=>{const x=await handler([row(A,['2030-01-01-11'])],{participantsError:true});assert.equal(x.response.status,500);assert.equal(x.providerCalls,0);});
test('S4 recommendation additions do not read health/private origin tables',async()=>{
 for(const path of ['s4Availability.ts','index.ts'])assert.doesNotMatch(await fs.readFile(new URL(path,base),'utf8'),/profile_health_preferences|profile_private|profile_consent_states|personal_data|meeting_midpoint/);
});
test('every S4 VM defaults to throwing transport',async()=>{
 const source='globalThis.probe=fetch("https://must-not-leave.invalid")';
 assert.throws(()=>runEdgeVm(source,{}),/EDGE_TEST_NETWORK_DISABLED/);
});

test('Kong/public issuer mismatch reproduces the local 401 before any RPC/provider',async()=>{
 const x=await handler([],{supabaseUrl:'http://kong:8000',issuer:'http://127.0.0.1:54321/auth/v1',geminiKey:undefined});
 assert.equal(x.response.status,401);assert.equal(x.result.error,'Authentication token issuer is invalid');
 assert.equal(x.consentCalls,0);assert.equal(x.adminCalls,0);assert.equal(x.providerCalls,0);
});
test('explicit local issuer passes Auth then stops at missing provider configuration without rewriting internal RPC URL',async()=>{
 const x=await handler([],{supabaseUrl:'http://kong:8000',issuer:'http://127.0.0.1:54321/auth/v1',localAuthIssuer:'http://127.0.0.1:54321/auth/v1',geminiKey:''});
 assert.equal(x.response.status,500);assert.equal(x.result.error,'Gemini API key is not configured');
 assert.equal(x.consentCalls,1);assert.equal(x.adminCalls,0);assert.equal(x.providerCalls,0);
});
for(const [label,options,status] of [
 ['hosted config leak',{supabaseUrl:'https://project-ref.supabase.co',localAuthIssuer:'http://127.0.0.1:54321/auth/v1'},500],
 ['other local project',{issuer:'http://127.0.0.1:55321/auth/v1'},401],
 ['service token',{claims:{role:'service_role'}},401],['anonymous user',{claims:{is_anonymous:true}},401],
 ['expired token',{claims:{exp:1}},401],['wrong audience',{claims:{aud:'anon'}},401],
 ['invalid subject',{claims:{sub:'invalid'}},401],
])test('local issuer remains fail-closed: '+label,async()=>{
 const x=await handler([],{supabaseUrl:'http://kong:8000',issuer:'http://127.0.0.1:54321/auth/v1',localAuthIssuer:'http://127.0.0.1:54321/auth/v1',geminiKey:'',...options});
 assert.equal(x.response.status,status);assert.equal(x.consentCalls,0);assert.equal(x.adminCalls,0);assert.equal(x.providerCalls,0);
});
test('hosted standard issuer still passes before provider configuration with no local setting',async()=>{
 const x=await handler([],{supabaseUrl:'https://project-ref.supabase.co',issuer:'https://project-ref.supabase.co/auth/v1',geminiKey:''});
 assert.equal(x.response.status,500);assert.equal(x.result.error,'Gemini API key is not configured');assert.equal(x.consentCalls,1);assert.equal(x.providerCalls,0);
});
test('unbounded legacy expiry is rejected at Edge',async()=>{
 const x=await handler([row(A,['2030-01-01-11'])],{expiry:'infinity'});assert.equal(x.response.status,403);
});

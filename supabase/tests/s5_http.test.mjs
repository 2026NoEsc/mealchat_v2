/** Isolated local PostgREST integration. No .env, remote URL, or existing JWT/key is read. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const db = 'supabase_db_mealchat_s1_a_20261017';
const rest = 'mealchat_s5_a_rest_test';
const origin = 'http://127.0.0.1:55321';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['pipe','pipe','pipe'] }).trim();
const sql = (query) => execFileSync('docker', ['exec','-i',db,'psql','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-f','-'], { input: query, encoding: 'utf8', windowsHide: true, stdio: ['pipe','pipe','pipe'] }).trim();
const uid = (i) => (0x10000000+i).toString(16)+'-0000-4000-8000-'+String(i).padStart(12,'0');
const room = '20000000-0000-4000-8000-000000000001';
let checks = 0, started = false, seeded = false;
function check(value, label) { if (!value) throw new Error('HTTP_ASSERTION_FAILED: '+label); checks++; console.log('ok '+checks+' - '+label); }
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: 'jwk' }), alg: 'RS256', use: 'sig', kid: 's1-ephemeral-local' };
function jwt(role, subject) {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const input = enc({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })+'.'+enc({ role, ...(subject ? { sub: subject } : {}), exp: Math.floor(Date.now()/1000)+900 });
  return input+'.'+crypto.sign('RSA-SHA256', Buffer.from(input), keys.privateKey).toString('base64url');
}
const credentials = { a: jwt('authenticated',uid(1)), b: jwt('authenticated',uid(2)), c: jwt('authenticated',uid(3)), g: jwt('authenticated',uid(7)), server: jwt('service_role') };
async function request(method, route, who, body) {
  const response = await fetch(origin+route, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: 'Bearer '+credentials[who] } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
const rpc = (name, who, body={}) => request('POST','/rpc/'+name,who,body);
try {
  check(/^(npipe|unix):\/\//.test(docker('context','inspect','--format','{{.Endpoints.docker.Host}}')), 'Docker endpoint is local');
  const identity = JSON.parse(docker('inspect','--format','{{json .NetworkSettings}}',db));
  check(identity.Ports['5432/tcp'].some((p)=>p.HostPort==='55322'), 'database is the disposable 55322 target');
  const network = Object.keys(identity.Networks).find((v)=>v.includes('mealchat_s1_a_20261017'));
  if (!network) throw new Error('Local test network mismatch');
  const fixture = await fs.readFile(path.join(here,'s1_fixture.sql'),'utf8');
  sql("begin; set local s1.tap='off';"+fixture+'commit;'); seeded=true;
  sql("insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('20000000-0000-4000-8000-000000000003','S1HTTP','Synthetic HTTP adversary room',current_date+1,clock_timestamp()+interval '1 day','"+uid(3)+"');");
  docker('run','--detach','--rm','--name',rest,'--network',network,'--publish','127.0.0.1:55321:3000',
    '-e','PGRST_DB_URI=postgres://authenticator:postgres@'+db+':5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
    '-e','PGRST_JWT_SECRET='+JSON.stringify({ keys: [jwk] }), 'postgrest/postgrest:v12.2.12'); started=true;
  let ready=false;
  for (let i=0;i<60;i++) { try { const r=await fetch(origin+'/'); if(r.ok) {ready=true; break;} } catch {} await new Promise((r)=>setTimeout(r,250)); }
  check(ready,'local PostgREST starts with an ephemeral public JWK');

  check((await rpc('get_food_profile_catalog_v2','a')).data?.contract_version===2,'signed JWT catalog contract v2');
  const cat='s5-food-2026-10-18-v1';
  const food={p_catalog_version:cat,p_preferences:{cuisines:['korean'],ingredients:[],forms:[],spice:null},p_expected_revision:'0'};
  check((await rpc('save_my_food_preferences_v2','a',food)).data?.revision==='1','JWT food save accepts versioned shape');
  check((await rpc('save_my_food_preferences_v2','a',food)).data?.code==='S1004','JWT stale CAS rejected');
  check((await rpc('get_my_food_preferences_v2','b')).data?.preferences && !(await rpc('get_my_food_preferences_v2','b')).data.preferences.cuisines,'other JWT cannot receive personal profile');
  const rawFood=await request('GET','/profile_food_preferences?select=profile_id,preferences&profile_id=eq.'+uid(1),'b');
  check(rawFood.data?.code==='42501'||(rawFood.status===200&&rawFood.data?.length===0),'raw foreign food is empty or forbidden');
  check((await rpc('get_my_food_preferences_v2','g')).data?.code==='S1001','required consent gate applies to v2');
  check((await rpc('get_my_food_preferences_v2')).data?.code==='42501','anon cannot call owner v2');
  check((await rpc('get_my_health_preferences_v2','a')).data?.code==='S1003','no health consent blocks v2 health only');
  const manifest=(await rpc('get_consent_manifest')).data, hd=manifest.documents.health;
  check((await rpc('set_optional_consent','a',{p_request_id:crypto.randomUUID(),p_kind:'health',p_action:'grant',p_document_version:hd.version,p_content_hash:hd.content_hash,p_expected_revision:'0',p_source:'food_step2'})).data?.status==='granted','JWT explicit health grant');
  const health={p_catalog_version:cat,p_allergy_codes:['egg','milk_dairy'],p_avoided_food_codes:['raw_fish'],p_diet_type_code:'vegan',p_additional_avoid_codes:[],p_expected_revision:'0',p_consent_revision:'1'};
  check((await rpc('save_my_health_preferences_v2','a',health)).data?.allergy_codes?.length===2,'JWT multiple allergy storage');
  const rawHealth=await request('GET','/profile_health_preferences?select=allergies,avoided_food_codes','b');
  check(rawHealth.data?.code==='42501'||(rawHealth.status===200&&rawHealth.data?.length===0),'raw foreign extended health is empty or forbidden');
  check((await rpc('set_room_recommendation_area_v2','b',{p_room_id:room,p_public_area_id:'local-dev-seoul-center',p_expected_revision:'0'})).data?.code==='42501','nonowner cannot configure public area');
  check((await rpc('set_room_recommendation_area_v2','a',{p_room_id:room,p_public_area_id:'local-dev-seoul-center',p_expected_revision:'0'})).status===200,'owner sets public area over JWT HTTP');
  check((await rpc('get_room_recommendation_settings_v2','c',{p_room_id:room})).data?.code==='42501','outsider cannot read room area');
  const id=crypto.randomUUID();
  check((await rpc('begin_room_recommendation_v2','a',{p_room_id:room,p_request_id:id,p_purpose:'places'})).data?.status==='pending','member starts place recommendation without availability');
  check((await rpc('claim_recommendation_work_v2','a',{p_request_id:id})).data?.code==='42501','user cannot claim server work');
  const work=(await rpc('claim_recommendation_work_v2','server',{p_request_id:id})).data;
  check(work?.work_token && work.keywords.includes('korean') && !JSON.stringify(work).includes('egg') && !JSON.stringify(work).includes(uid(1)),'worker receives deidentified step1 keywords and public area only');
  check((await request('GET','/profile_food_preferences?select=preferences','server')).data?.code==='42501','service JWT has no raw food SELECT grant');
  check((await request('GET','/profile_health_preferences?select=allergies','server')).data?.code==='42501','service JWT has no raw health SELECT grant');
  const final=(await rpc('finalize_recommendation_work_v2','server',{p_request_id:id,p_work_token:work.work_token,p_candidates:{places:[{id:'synthetic-poi',name:'Synthetic restaurant',address:'Synthetic public address',latitude:37.5665,longitude:126.978,cuisine_codes:['korean']}]},p_model_ranking:['synthetic-poi'],p_source:'rules'})).data;
  check(final?.source==='rules' && final.place_recommendations.length===1 && final.my_health_filter==='not_requested','worker finalizes DB-validated general result');
  check(!/keywords|work_token|profile_id|weights|allergy_codes/.test(JSON.stringify(final)),'client result excludes private aggregate health and work metadata');
  check((await rpc('validate_my_recommendation_v2','b',{p_request_id:id})).data?.code==='42501','ticket result is caller-owned');
  check((await rpc('validate_my_recommendation_v2','a',{p_request_id:id})).data?.status==='valid','caller validates own complete result');
  check((await rpc('mark_food_profile_prompt_v2','b',{p_action:'shown',p_expected_revision:'0'})).status===200,'another JWT records shown');
  check((await rpc('validate_my_recommendation_v2','a',{p_request_id:id})).data?.status==='valid','shown does not invalidate complete HTTP result');
  check((await rpc('save_my_food_preferences_v2','a',{...food,p_preferences:{},p_expected_revision:'1'})).status===200,'caller changes food after result');
  check((await rpc('validate_my_recommendation_v2','a',{p_request_id:id})).data?.code==='S5003','HTTP validates context invalidation');
  const bad=await fetch(origin+'/public_meeting_areas',{headers:{Authorization:'Bearer synthetic-invalid'}});
  check(bad.status===401,'PostgREST verifies cryptographic JWT signatures');
  const raced=crypto.randomUUID();
  const began=await Promise.all([rpc('begin_room_recommendation_v2','a',{p_room_id:room,p_request_id:raced,p_purpose:'places'}),rpc('begin_room_recommendation_v2','a',{p_room_id:room,p_request_id:raced,p_purpose:'places'})]);
  check(began.every(x=>x.data?.status==='pending'),'concurrent HTTP begin returns same pending ID');
  const claimed=await Promise.all([rpc('claim_recommendation_work_v2','server',{p_request_id:raced}),rpc('claim_recommendation_work_v2','server',{p_request_id:raced})]);
  check(claimed.filter(x=>x.data?.work_token).length===1&&claimed.filter(x=>x.data?.code==='42501').length===1,'signed worker JWT claims race has one capability winner');
  const winner=claimed.find(x=>x.data?.work_token).data;
  check((await rpc('fail_recommendation_work_v2','a',{p_request_id:raced,p_work_token:winner.work_token})).data?.code==='42501','caller JWT cannot cancel worker ticket');
  check((await rpc('fail_recommendation_work_v2','server',{p_request_id:raced,p_work_token:crypto.randomUUID()})).data?.code==='42501','worker JWT with wrong capability cannot cancel');
  const failed=await rpc('fail_recommendation_work_v2','server',{p_request_id:raced,p_work_token:winner.work_token});
  check(failed.status>=200&&failed.status<300,'correct worker capability records terminal provider failure');
  check((await rpc('begin_room_recommendation_v2','a',{p_room_id:room,p_request_id:raced,p_purpose:'places'})).data?.code==='S5006','failed ID replay is explicit through PostgREST');
  check((await rpc('begin_room_recommendation_v2','a',{p_room_id:room,p_request_id:crypto.randomUUID(),p_purpose:'places'})).data?.status==='pending','failed worker permits fresh ID within caller budget');
  console.log('S5 HTTP assertions: '+checks+' passed; real Auth issuance, Kong and live providers are unverified.');
} finally {
  if(started) { try { docker('stop',rest); } catch { throw new Error('Local PostgREST cleanup failed'); } }
  if(seeded) {
    const local=path.join(os.tmpdir(),'mealchat-s1-a-20261017');
    execFileSync('powershell.exe',['-NoProfile','-Command',"npx --yes supabase db reset --local --workdir '"+local.replaceAll("'","''")+"'; if ($LASTEXITCODE -ne 0) { throw 'Disposable reset failed' }"],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],encoding:'utf8'});
  }
}

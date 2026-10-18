/** Isolated local PostgREST integration. No .env, remote URL, or existing JWT/key is read. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { m7WithTestValues } from './s1_m7_local.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const db = 'supabase_db_mealchat_s1_a_20261017';
const rest = 'mealchat_s1_a_rest_test';
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
  const manifest = (await rpc('get_consent_manifest')).data;
  check(manifest?.contract_version===1,'anon HTTP manifest works');
  check((await rpc('get_my_consent_status','g')).data?.required?.status==='required','pending JWT status stays required');
  const pending = await request('GET','/public_profiles?select=id','g');
  check(pending.status===200 && pending.data.length===0,'pending JWT raw REST is empty');
  check((await rpc('toggle_vote','g',{ target_room: room,item_id:'50000000-0000-4000-8000-000000000001' })).data?.code==='S1001','pending JWT RPC is blocked before business data');
  check((await request('GET','/participants?select=personal_data','b')).data?.code==='42501','raw participant personal column denied through HTTP');
  check((await request('GET','/rooms?select=id,participants(personal_data)','b')).data?.code==='42501','embedded private participant column denied through HTTP');
  check((await request('GET','/dutch_pay_bills?select=bank_name','b')).data?.code==='42501','raw account denied through HTTP');
  const bill = sql("select id from public.dutch_pay_bills where room_id='"+room+"';");
  check((await rpc('get_settlement_payment_details','b',{ p_bill_id:bill })).data?.status==='open','fixed recipient JWT receives open bill account with profile switch off');
  const hidden = await rpc('get_settlement_payment_details','c',{p_bill_id:bill});
  const absent = await rpc('get_settlement_payment_details','c',{p_bill_id:'99000000-0000-4000-8000-000000000001'});
  check(hidden.status===absent.status && hidden.data.code==='P0002' && absent.data.code==='P0002','absent and unauthorized bill HTTP errors are indistinguishable');
  await rpc('set_profile_visibility','a',{p_field:'birthdate',p_visibility:'public',p_expected_revision:'0'});
  await rpc('set_profile_visibility','a',{p_field:'bank_account',p_visibility:'public',p_expected_revision:'1'});
  check((await rpc('invite_friend_to_room','c',{ target_room:'20000000-0000-4000-8000-000000000003',friend_id:uid(1) })).data?.code==='42501','one-way follower cannot force room admission through HTTP');
  const visible=(await rpc('get_visible_profile','c',{p_profile_id:uid(1)})).data;
  check(visible.relationship==='identity_only' && Object.keys(visible.fields).length===0,'denied forced admission leaves birth/account invisible');
  check((await rpc('invite_friend_to_room',undefined,{target_room:room,friend_id:uid(1)})).data?.code==='42501','anon forced-invite HTTP execution is closed');
  const hd=manifest.documents.health;
  check((await rpc('set_optional_consent','a',{p_request_id:crypto.randomUUID(),p_kind:'health',p_action:'grant',p_document_version:hd.version,p_content_hash:hd.content_hash,p_expected_revision:'0',p_source:'settings'})).data?.status==='granted','HTTP optional grant writes structured status');
  check((await rpc('save_my_health_preferences','a',{p_allergies:['test_allergy'],p_dietary_restrictions:[],p_expected_revision:'0',p_consent_revision:'1'})).data?.revision==='1','HTTP health save validates revision and catalog');
  const otherHealth=await request('GET','/profile_health_preferences?select=profile_id,allergies','b');
  const ownHealth=await request('GET','/profile_health_preferences?select=profile_id,allergies','a');
  check(otherHealth.status===200 && otherHealth.data.length===0 && ownHealth.data.length===1,'populated health row stays owner-only through real REST JWT');
  check((await request('POST','/profile_health_preferences','server',{profile_id:uid(1),consent_event_id:1})).data?.code==='42501','service JWT cannot directly write health');
  sql("delete from public.profile_private where id='"+uid(9)+"';");
  check((await request('POST','/profile_private','server',{id:uid(9)})).status===201,'service JWT can provision profile_private with checks');
  const members=await request('GET','/dutch_pay_members?select=id&bill_id=eq.'+bill,'a');
  for (const member of members.data) await rpc('set_settlement_completed','a',{target_member:member.id,completed:true});
  const closed=(await rpc('get_settlement_payment_details','b',{p_bill_id:bill})).data;
  check(closed.status==='completed' && closed.payment_details===null,'completion commit removes account in later HTTP read');
  check((await rpc('set_settlement_completed','a',{target_member:members.data[0].id,completed:false})).data?.code==='S1005','HTTP closed completion undo returns S1005');
  check((await request('GET','/dutch_pay_members?select=is_completed&bill_id=eq.'+bill,'a')).data.every(m=>m.is_completed===true),'HTTP rejected undo leaves every recipient complete');
  const next=await rpc('create_room_settlement_v2','a',{ target_room:room,bill_title:'Synthetic next HTTP bill',amount:7000,bank_name:'Synthetic bank',account_number:'1111',account_holder:'Synthetic A' });
  check(typeof next.data==='string' && next.data!==bill,'new explicit request after completion creates a different bill');
  const invalid=await fetch(origin+'/public_profiles?select=id',{headers:{Authorization:'Bearer synthetic-invalid-jwt'}});
  check(invalid.status===401,'PostgREST verifies JWT signatures rather than trusting claims');
  sql(m7WithTestValues());
  const activated=(await rpc('get_consent_manifest')).data;
  check(activated.bundle_version==='mealchat-2020-01-01-r2' && activated.documents.privacy.edition===2,'M7 HTTP manifest exposes the verified activated privacy 2 bundle');
  const oldStatus=(await rpc('get_my_consent_status','a')).data;
  check(oldStatus.required.status==='required','M7 HTTP previous-bundle user requires reconsent');
  check((await rpc('get_my_food_preferences','a')).data?.code==='S1001','M7 HTTP old approval cannot use ordinary APIs');
  const refs=Object.fromEntries(Object.entries(activated.documents).map(([kind,d])=>[kind,{version:d.version,content_hash:d.content_hash}]));
  const signup={p_request_id:crypto.randomUUID(),p_bundle_version:activated.bundle_version,p_documents:refs,p_choices:{service:true,privacy:true,health:false,marketing:false}};
  check((await rpc('complete_signup_consents','g',signup)).data?.required?.status==='accepted','M7 HTTP signup accepts explicit required choices with optional false');
  const signupStatus=(await rpc('get_my_consent_status','g')).data;
  check(signupStatus.health.status==='declined' && signupStatus.marketing.status==='declined','M7 HTTP signup persists both optional declines');
  await rpc('complete_signup_consents','g',signup);
  check((await request('GET','/profile_consents?select=id','g')).data.length===4,'M7 HTTP identical signup retry keeps exactly four events');
  const reconsent=await rpc('record_required_consents','a',{p_request_id:crypto.randomUUID(),p_bundle_version:activated.bundle_version,p_documents:{service:refs.service,privacy:refs.privacy},p_choices:{service:true,privacy:true}});
  check(reconsent.data?.required?.status==='accepted' && reconsent.data.health.revision===oldStatus.health.revision && reconsent.data.marketing.revision===oldStatus.marketing.revision,'M7 HTTP required reconsent preserves both optional consent revisions');
  check((await request('GET','/public_profiles?select=id','g')).data.length>0,'M7 HTTP signup opens ordinary data only after all required consents');
  console.log('HTTP assertions: '+checks+' passed; real Auth issuance and Kong are outside this test.');
} finally {
  if(started) { try { docker('stop',rest); } catch { throw new Error('Local PostgREST cleanup failed'); } }
  if(seeded) {
    const local=path.join(os.tmpdir(),'mealchat-s1-a-20261017');
    execFileSync('powershell.exe',['-NoProfile','-Command',"npx --yes supabase db reset --local --workdir '"+local.replaceAll("'","''")+"'; if ($LASTEXITCODE -ne 0) { throw 'Disposable reset failed' }"],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],encoding:'utf8'});
  }
}

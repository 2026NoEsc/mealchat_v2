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
const rest = 'mealchat_s4_a_rest_test';
const origin = 'http://127.0.0.1:55321';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['pipe','pipe','pipe'] }).trim();
const sql = (query) => execFileSync('docker', ['exec','-i',db,'psql','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-f','-'], { input: query, encoding: 'utf8', windowsHide: true, stdio: ['pipe','pipe','pipe'] }).trim();
const uid = (i) => (0x10000000+i).toString(16)+'-0000-4000-8000-'+String(i).padStart(12,'0');
const room = '24000000-0000-4000-8000-000000000001';
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
  const s1=await fs.readFile(path.join(here,'s1_fixture.sql'),'utf8');
  const fixture=(await fs.readFile(path.join(here,'s4_fixture.sql'),'utf8')).replace('\\ir s1_fixture.sql',()=>s1);
  sql("begin; set local s1.tap='off';"+fixture+'commit;'); seeded=true;
  sql("insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('20000000-0000-4000-8000-000000000003','S1HTTP','Synthetic HTTP adversary room',current_date+1,clock_timestamp()+interval '1 day','"+uid(3)+"');");
  docker('run','--detach','--rm','--name',rest,'--network',network,'--publish','127.0.0.1:55321:3000',
    '-e','PGRST_DB_URI=postgres://authenticator:postgres@'+db+':5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
    '-e','PGRST_JWT_SECRET='+JSON.stringify({ keys: [jwk] }), 'postgrest/postgrest:v12.2.12'); started=true;
  let ready=false;
  for (let i=0;i<60;i++) { try { const r=await fetch(origin+'/'); if(r.ok) {ready=true; break;} } catch {} await new Promise((r)=>setTimeout(r,250)); }
  check(ready,'local PostgREST starts with an ephemeral public JWK');


  const state=async(who='a')=>(await rpc('get_room_s4_state',who,{p_room_id:room})).data;
  const day=new Date(Date.now()+2*86400000).toISOString().slice(0,10),slots=[day+'-11',day+'-12'];
  const time={starts_at:day+'T11:00:00+09:00',ends_at:day+'T13:00:00+09:00',time_zone:'Asia/Seoul'};
  check((await rpc('get_s4_capabilities','a')).data?.atomic_confirmation===true,'signed JWT sees S4 capability');
  check((await state()).availability.eligible_count===2,'HTTP state excludes NULL profile from eligible quorum');
  for(const who of ['a','b'])for(const name of ['create_room_settlement_v2','create_room_settlement']) {
   const denied=await rpc(name,who,{target_room:room,bill_title:'Too early',amount:2000,bank_name:'Synthetic',account_number:'0000',account_holder:'Synthetic'});
   check(denied.data?.code==='S4008'&&denied.data?.hint==='operation=settlement',who+' cannot bypass owner confirmation through '+name);
  }
  for(const [who,code] of [['c','42501'],['g','S1001'],['server','42501'],[undefined,'42501']]) {
   check((await rpc('get_room_s4_state',who,{p_room_id:room})).data?.code===code,'GET boundary for '+String(who));
   check((await rpc('submit_room_availability_v1',who,{p_room_id:room,p_slot_keys:slots,p_expected_revision:'0',p_request_id:crypto.randomUUID()})).data?.code===code,'submit boundary for '+String(who));
  }
  check((await rpc('get_room_s4_state','a',{p_room_id:'not-a-uuid'})).data?.code==='22P02','typed UUID binding exposes documented INVALID_INPUT code');
  check((await rpc('select_room_meeting_time_v1','b',{p_room_id:room,p_time:time,p_expected_revision:(await state()).revision,p_request_id:crypto.randomUUID()})).data?.code==='42501','mate cannot select time');
  check((await rpc('select_room_meeting_time_v1','a',{p_room_id:room,p_time:null,p_expected_revision:(await state()).revision,p_request_id:crypto.randomUUID()})).data?.code==='S4004','incomplete HTTP roster blocks place entry');
  check((await request('PATCH','/rooms?id=eq.'+room,'a',{is_confirmed:true})).data?.code==='42501','raw room mutation remains denied');
  check((await request('PATCH','/participants?room_id=eq.'+room,'b',{schedule:{slots}})).data?.code==='42501','raw participant mutation remains denied');
  const submit=async(who)=>rpc('submit_room_availability_v1',who,{p_room_id:room,p_slot_keys:slots,p_expected_revision:(await state()).revision,p_request_id:crypto.randomUUID()});
  check((await submit('a')).data?.outcome==='applied','owner HTTP submits availability');
  check((await submit('b')).data?.state.availability.all_submitted===true,'mate HTTP completes eligible roster');
  const before=(await state()).revision,selectId=crypto.randomUUID(),selection={p_room_id:room,p_time:time,p_expected_revision:before,p_request_id:selectId};
  check((await rpc('select_room_meeting_time_v1','a',selection)).data?.state.stage==='place','HTTP time and stage save atomically');
  check((await rpc('select_room_meeting_time_v1','a',selection)).data?.outcome==='replayed','HTTP stale-revision request replay succeeds');
  check((await rpc('select_room_meeting_time_v1','a',{...selection,p_time:null})).data?.code==='S1007','HTTP reused ID with different payload conflicts');
  const item=(await rpc('add_voting_item','a',{target_room:room,item_kind:'menu',item_label:'Synthetic HTTP restaurant'})).data;
  check(typeof item==='string'&&item.length===36,'legacy candidate wrapper retains UUID return');
  check((await rpc('toggle_vote','a',{target_room:room,item_id:item})).data===true,'owner HTTP vote');
  const insufficient=await rpc('confirm_room_appointment_v1','a',{p_room_id:room,p_restaurant_item_id:item,p_expected_revision:(await state()).revision,p_request_id:crypto.randomUUID()});
  check(insufficient.data?.code==='S4008'&&insufficient.data?.hint==='operation=vote_confirmation','HTTP vote error has a distinct machine-readable operation hint');
  check((await rpc('toggle_vote','b',{target_room:room,item_id:item})).data===true,'mate HTTP second vote');
  check((await state()).stage==='place','all HTTP votes never auto-confirm');
  const confirmation={p_room_id:room,p_restaurant_item_id:item,p_expected_revision:(await state()).revision,p_request_id:crypto.randomUUID()};
  const attempts=await Promise.all([rpc('confirm_room_appointment_v1','a',confirmation),rpc('confirm_room_appointment_v1','a',confirmation)]);
  check(attempts.every(x=>x.status===200)&&attempts.map(x=>x.data.outcome).sort().join(',')==='applied,replayed','concurrent signed JWT confirmations apply once and replay once');
  const after=await state();
  check(after.confirmation_status==='owner_confirmed'&&after.restaurant.item_id===item&&after.meeting_time.starts_at===day+'T02:00:00.000000Z','HTTP final DTO matches canonical structured fields');
  check((await request('GET','/messages?select=event_key&room_id=eq.'+room+'&event_key=eq.appointment-confirmed:'+room,'a')).data?.length===1,'HTTP client sees one system event');
  check((await rpc('toggle_vote','b',{target_room:room,item_id:item})).data?.code==='S4003','HTTP confirmed vote mutation is closed');
  check((await rpc('advance_room_stage','a',{target_room:room,next_stage:'confirmed'})).data==='confirmed','legacy HTTP follow-up remains no-op');
  const bill=await rpc('create_room_settlement_v2','b',{target_room:room,bill_title:'Confirmed bill',amount:2000,bank_name:'Synthetic',account_number:'0000',account_holder:'Synthetic B'});
  check(typeof bill.data==='string'&&bill.data.length===36,'confirmed HTTP mate may create settlement with a NULL-profile display row present');
  check((await request('GET','/dutch_pay_members?select=profile_id&bill_id=eq.'+bill.data,'b')).data?.length===2,'HTTP settlement recipient snapshot excludes the display-only row');
  const recipients=await request('GET','/dutch_pay_members?select=id&is_completed=eq.false&bill_id=eq.'+bill.data,'b');
  for(const member of recipients.data) check((await rpc('set_settlement_completed','b',{target_member:member.id,completed:true})).status===204,'HTTP void recipient completion returns 204');
  check((await state()).stage==='done','HTTP original bill completes the room');
  const repeated=await rpc('create_room_settlement_v2','b',{target_room:room,bill_title:'Next confirmed bill',amount:3000,bank_name:'Synthetic',account_number:'1111',account_holder:'Synthetic B'});
  check(typeof repeated.data==='string'&&repeated.data!==bill.data,'real owner-confirmed done room permits a new HTTP bill');
  const restartedRoom=(await request('GET','/rooms?select=stage,expires_at&id=eq.'+room,'b')).data?.[0];
  check(restartedRoom?.stage==='settling'&&Number.isFinite(Date.parse(restartedRoom?.expires_at))&&Date.parse(restartedRoom.expires_at)<=Date.now()+7*86400000,'REST returns settling and a finite seven-day restart deadline');
  check((await rpc('get_settlement_payment_details','a',{p_bill_id:bill.data})).data?.payment_details===null,'re-settlement leaves the old HTTP account closed');
  const pendingRestart=await request('GET','/dutch_pay_members?select=id&is_completed=eq.false&bill_id=eq.'+repeated.data,'b');
  for(const member of pendingRestart.data) await rpc('set_settlement_completed','b',{target_member:member.id,completed:true});
  const finishedRestart=(await request('GET','/rooms?select=stage,expires_at&id=eq.'+room,'b')).data?.[0];
  check(finishedRestart?.stage==='done'&&Number.isFinite(Date.parse(finishedRestart.expires_at))&&Date.parse(finishedRestart.expires_at)>Date.now(),'REST returns done and a new finite deadline after restart completes');
  for(const point of [0x200B,0x200F,0x202A,0x202E,0x2060,0x2064,0xFEFF]) {
    const invalidName=await rpc('add_voting_item','c',{target_room:'24000000-0000-4000-8000-000000000002',item_kind:'time',item_label:'Cafe'+String.fromCodePoint(point)});
    check(invalidName.data?.code==='S4002','HTTP format character is rejected: U+'+point.toString(16));
  }
  console.log('S4 HTTP assertions: '+checks+' passed; Auth issuance/Kong/live providers remain unverified.');
} finally {
  if(started) { try { docker('stop',rest); } catch { throw new Error('Local PostgREST cleanup failed'); } }
  if(seeded) {
    const local=path.join(os.tmpdir(),'mealchat-s1-a-20261017');
    execFileSync('powershell.exe',['-NoProfile','-Command',"npx --yes supabase db reset --local --workdir '"+local.replaceAll("'","''")+"'; if ($LASTEXITCODE -ne 0) { throw 'Disposable reset failed' }"],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],encoding:'utf8'});
  }
}

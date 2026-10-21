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
const rest = 'mealchat_s3_a_rest_test';
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
function assertResetTarget() {
  const config = path.join(os.tmpdir(), 'mealchat-s1-a-20261017', 'supabase', 'config.toml');
  return fs.readFile(config, 'utf8').then(raw => {
    const value=raw.replace(/^\uFEFF/,'');
    if (!/^project_id\s*=\s*"mealchat_s1_a_20261017"\s*$/m.test(value)
      || !/^\[db\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*55322\s*$/ms.test(value)
      || !/^\[api\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*55321\s*$/ms.test(value)) throw new Error('Refuse non-isolated reset');
  });
}
try {
  await assertResetTarget();
  check(/^(npipe|unix):\/\//.test(docker('context','inspect','--format','{{.Endpoints.docker.Host}}')), 'Docker endpoint is local');
  const identity = JSON.parse(docker('inspect','--format','{{json .NetworkSettings}}',db));
  check(identity.Ports['5432/tcp'].some(p=>p.HostPort==='55322'), 'only disposable 55322 DB is accepted');
  const network=Object.keys(identity.Networks).find(v=>v.includes('mealchat_s1_a_20261017'));
  if(!network) throw new Error('Local test network mismatch');
  const held=await fs.readFile(path.join(root,'supabase/release/s3_activate_lifecycle.sql'),'utf8');
  const activation=held.slice(held.indexOf('-- D8:')).replace(/^commit;\s*$/m,'');
  docker('cp',here+'/.',db+':/tmp/s3_http');
  // Synthetic fixture activation deliberately omits release admission; this is
  // HTTP boundary evidence, not beta/scheduler/remote readiness evidence.
  const fixture=await fs.readFile(path.join(here,'s3_fixture.sql'),'utf8');
  const expanded=fixture.replace('\\ir s3_activation_test_body.sql',()=>activation);
  const fixturePath=path.join(os.tmpdir(),'mealchat-s3-http-fixture.sql');
  await fs.writeFile(fixturePath,expanded,'utf8');
  try { docker('cp',fixturePath,db+':/tmp/s3_http/s3_fixture_expanded.sql'); }
  finally { await fs.unlink(fixturePath); }
  sql("begin; set local s1.tap='off';\\i /tmp/s3_http/s3_fixture_expanded.sql\ncommit;"); seeded=true;
  const target=sql("select id from public.rooms where title='Synthetic S3' order by created_at desc limit 1;");
  docker('run','--detach','--rm','--name',rest,'--network',network,'--publish','127.0.0.1:55321:3000',
    '-e','PGRST_DB_URI=postgres://authenticator:postgres@'+db+':5432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
    '-e','PGRST_JWT_SECRET='+JSON.stringify({keys:[jwk]}),'postgrest/postgrest:v12.2.12'); started=true;
  let ready=false;
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/')).ok){ready=true;break;}}catch{} await new Promise(resolve=>setTimeout(resolve,250));}
  check(ready,'isolated PostgREST with ephemeral public JWK is ready');
  for(const who of [undefined,'server']) check((await rpc('get_s3_capabilities',who)).data?.code==='42501','probe denied to '+String(who));
  check((await rpc('get_s3_capabilities','a')).data?.owner_transfer===true,'authenticated caller sees full S3 capability');
  check((await rpc('get_room_lifecycle_v1','c',{p_room_id:target})).data?.code==='42501','outsider cannot read lifecycle');
  check((await rpc('get_room_lifecycle_v1','g',{p_room_id:target})).data?.code==='S1001','required terms still gate S3');
  check((await request('POST','/rooms','a',{code:'ABCDEF',title:'Forged',owner_id:uid(1),meeting_date:'2026-10-22',expires_at:'infinity'})).data?.code==='42501','direct room INSERT is denied over HTTP');
  check((await rpc('post_room_system_message','a',{target_room:target,body:'Forged'})).data?.code==='42501','R1 is denied over HTTP');
  for(let i=1;i<=5;i++) {
    const failure=await rpc('preview_room_invite_v1','c',{p_code:'ZZZZZZ'});
    check(failure.status===200&&failure.data?.reason===(i===5?'INVITE_RATE_LIMITED':'INVITE_UNAVAILABLE'),'failed lookup '+i+' is committed as an envelope');
  }
  check(sql("select failure_count from private.s3_invite_limits where actor_id='"+uid(3)+"';")==='5','five failures survive separate HTTP transactions');
  const denied=await rpc('join_room_by_code','c',{room_code:'ABCDEF'});
  check(denied.status===200&&denied.data===null,'legacy join retains NULL contract and shared limiter');
  const state=await rpc('get_room_lifecycle_v1','a',{p_room_id:target});
  check(state.data?.invite?.code?.length===6,'current member can read shareable code');
  credentials.d=jwt('authenticated',uid(4)); credentials.e=jwt('authenticated',uid(5));
  let preview=await rpc('preview_room_invite_v1','d',{p_code:state.data.invite.code});
  check(preview.data?.outcome==='preview'&&!('room_id' in preview.data)&&!('members' in preview.data),'preview projection excludes UUID and member identities');
  check((await rpc('join_room_invite_v1','e',{p_preview_id:preview.data.preview_id,p_request_id:crypto.randomUUID()})).data?.reason==='INVITE_UNAVAILABLE','opaque preview is bound to its actor');
  sql("update public.rooms set title='Synthetic changed HTTP preview' where id='"+target+"';");
  check((await rpc('join_room_invite_v1','d',{p_preview_id:preview.data.preview_id,p_request_id:crypto.randomUUID()})).data?.reason==='PREVIEW_STALE','HTTP stale preview returns a display conflict');
  check(sql("select failure_count from private.s3_invite_limits where actor_id='"+uid(4)+"';")==='0','HTTP stale preview commits no guess failure');
  sql("update private.s3_invite_previews set expires_at=clock_timestamp()-interval '1 second' where id='"+preview.data.preview_id+"';");
  check((await rpc('join_room_invite_v1','d',{p_preview_id:preview.data.preview_id,p_request_id:crypto.randomUUID()})).data?.reason==='INVITE_UNAVAILABLE','HTTP expired preview returns the uniform rejection');
  check(sql("select failure_count from private.s3_invite_limits where actor_id='"+uid(4)+"';")==='0','HTTP expired preview commits no guess failure');
  preview=await rpc('preview_room_invite_v1','d',{p_code:state.data.invite.code});
  const requestId=crypto.randomUUID();
  const joined=await rpc('join_room_invite_v1','d',{p_preview_id:preview.data.preview_id,p_request_id:requestId});
  check(joined.data?.room_id===target,'explicit join succeeds');
  check((await rpc('join_room_invite_v1','d',{p_preview_id:preview.data.preview_id,p_request_id:requestId})).data?.outcome==='replayed','same ID replays without duplicate admission');
  check(sql("select count(*) from public.messages where room_id='"+target+"' and event_key='member-joined:"+target+":"+uid(4)+":"+requestId+"';")==='1','join server event is emitted exactly once');
  const member=await rpc('get_room_lifecycle_v1','b',{p_room_id:target});
  check((await rpc('leave_room_member_v1','b',{p_room_id:target,p_expected_revision:member.data.revision,p_request_id:crypto.randomUUID()})).data?.outcome==='applied','member leave works over HTTP');
  check((await rpc('get_room_lifecycle_v1','b',{p_room_id:target})).data?.code==='42501','departed caller loses HTTP room access');
  console.log('S3 HTTP: '+checks+' passed; synthetic JWT roles, not Auth issuance or UI E2E.');
} finally {
  if(started) docker('stop',rest);
  if(seeded) {
    await assertResetTarget();
    const local=path.join(os.tmpdir(),'mealchat-s1-a-20261017');
    execFileSync('powershell.exe',['-NoProfile','-Command',"npx --yes supabase db reset --local --workdir '"+local.replaceAll("'","''")+"'; if ($LASTEXITCODE -ne 0) { throw 'Disposable reset failed' }"],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],encoding:'utf8'});
  }
}

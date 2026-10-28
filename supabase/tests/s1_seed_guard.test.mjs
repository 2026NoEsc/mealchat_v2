// Replays the real seed inside rollback-only local SQL; no production bypass/flags.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const container='supabase_db_mealchat_s1_a_20261017';
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024,timeout:60000});
if(!/^(npipe|unix):\/\//.test(docker(['context','inspect','--format','{{.Endpoints.docker.Host}}'])))throw new Error('Local Docker only');
if(!docker(['inspect','--format','{{json .NetworkSettings.Ports}}',container]).includes('55322'))throw new Error('Wrong local port');
const sql=input=>docker(['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-Atq','-v','ON_ERROR_STOP=1','-f','-'],input);
const seed=readFileSync(new URL('../seed.sql',import.meta.url),'utf8');
const first=seed.indexOf('begin;'),last=seed.lastIndexOf('\ncommit;');
if(first<0||last<=first||!seed.includes('do $s1_local_seed_guard$'))throw new Error('Guarded seed transaction not found');
const body=seed.slice(first+6,last);
const publication=body.slice(body.indexOf('do $s1_activate$'));
if(!publication.includes('S1_LOCAL_SEED_NONLOCAL_STATE'))throw new Error('Locked publication guard missing');
if(body.includes('$seed_replay_source$'))throw new Error('Seed delimiter collision');
const signature="md5(jsonb_build_object('documents',(select jsonb_agg(to_jsonb(d) order by id) from public.consent_documents d),'bundles',(select jsonb_agg(to_jsonb(t) order by id) from public.terms_versions t),'states',(select jsonb_agg(to_jsonb(s) order by profile_id,kind) from public.profile_consent_states s),'events',(select jsonb_agg(to_jsonb(e) order by id) from public.profile_consents e),'users',(select count(*) from auth.users),'profiles',(select count(*) from public.profiles))::text)";
const before=sql('select '+signature+';').trim();
const blocked=(label)=>`update seed_snapshot set fingerprint=pg_temp.seed_signature();
select is(pg_temp.replay_seed(),'55000:S1_LOCAL_SEED_NONLOCAL_STATE', '${label} is rejected');
select is(pg_temp.seed_signature(),(select fingerprint from seed_snapshot),'${label} preserves all records and current flags');\n`;
let q=`begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(19);
create function pg_temp.seed_signature() returns text language sql volatile as $sig$select ${signature}$sig$;
create temporary table seed_snapshot as select pg_temp.seed_signature() as fingerprint;
create function pg_temp.replay_seed() returns text language plpgsql as $seed_replay_fn$
begin
 execute $seed_replay_source$${body}$seed_replay_source$;
 return '00000';
exception when others then return sqlstate||':'||sqlerrm;
end;
$seed_replay_fn$;
create function pg_temp.replay_publication() returns text language plpgsql as $seed_publication_fn$
begin
 execute $seed_replay_source$${publication}$seed_replay_source$;
 return '00000';
exception when others then return sqlstate||':'||sqlerrm;
end;
$seed_publication_fn$;
select ok(exists(select 1 from public.terms_versions where version='2026-08-17' and service_document_id is null and privacy_document_id is null and published_at is null and change_summary=''),'local reset retains the unlinked legacy bootstrap bundle');
select is(pg_temp.replay_seed(),'00000','known pristine local-dev catalog can be seeded again');
select is(pg_temp.seed_signature(),(select fingerprint from seed_snapshot),'idempotent local seeding preserves existing local records');
insert into public.consent_documents(kind,version,edition,effective_from,is_current,canonical_content,content_hash)
select kind,'privacy-2026-10-20-v2',edition,effective_from,false,canonical_content,content_hash from public.consent_documents where kind='privacy';
`;
q+=blocked('nonlocal draft document');
q+=`delete from public.consent_documents where version='privacy-2026-10-20-v2';
insert into public.consent_documents(kind,version,edition,effective_from,is_current,canonical_content,content_hash)
select kind,'privacy-local-dev-forged-v2',edition,effective_from,false,canonical_content,content_hash from public.consent_documents where kind='privacy';
`;
q+=blocked('unrecognized local-dev document');
q+=`delete from public.consent_documents where version='privacy-local-dev-forged-v2';
insert into public.terms_versions(version,is_current) values('mealchat-2026-10-20-r2',false);
`;
q+=blocked('nonlocal bundle');
q+=`delete from public.terms_versions where version='mealchat-2026-10-20-r2';
update public.terms_versions set published_at=clock_timestamp() where version='2026-08-17';
`;
q+=blocked('published legacy bundle');
q+=`update public.terms_versions set published_at=null,service_document_id=(select id from public.consent_documents where kind='service') where version='2026-08-17';
`;
q+=blocked('linked legacy bundle');
q+=`update public.terms_versions set service_document_id=null where version='2026-08-17';
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('97000001-0000-4000-8000-000000000001','authenticated','authenticated','seed-guard@example.invalid','{}','{"name":"Seed guard fixture"}',clock_timestamp(),clock_timestamp());
`;
q+=blocked('populated legacy-compatible database');
q+=`delete from auth.users where id='97000001-0000-4000-8000-000000000001';
do $cleanup$ begin if exists(select 1 from auth.users) or exists(select 1 from public.profiles) then raise exception 'Synthetic cleanup failed'; end if; end; $cleanup$;
insert into public.consent_documents(kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash)
select kind,'privacy-2026-10-21-v2',edition,effective_from,clock_timestamp(),false,canonical_content,content_hash from public.consent_documents where kind='privacy';
update public.consent_documents set is_current=false where kind='privacy';
update public.consent_documents set is_current=true where version='privacy-2026-10-21-v2';
`;
q+=blocked('published current nonlocal document');
q+=`select is(pg_temp.replay_publication(),'55000:S1_LOCAL_SEED_NONLOCAL_STATE','publication lock recheck rejects a nonlocal document appearing after preflight');
select is(pg_temp.seed_signature(),(select fingerprint from seed_snapshot),'locked recheck failure preserves every current flag and record');`;
q+='select * from finish(); rollback;';
const output=sql(q);process.stdout.write(output);
if(/^not ok\b|Looks like you/m.test(output)||!output.includes('1..19'))throw new Error('Seed guard SQL failed');
if(sql('select '+signature+';').trim()!==before)throw new Error('Seed guard test changed the local catalog');
console.log('Seed guard SQL: 19/19; complete rollback verified.');

param(
  [string]$DockerExe = 'docker',
  [string]$Container = 'supabase_db_mealchat_s1_a_20261017'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
# This test deliberately refuses the ordinary development/remote databases.
if ($Container -ne 'supabase_db_mealchat_s1_a_20261017') {
  throw 'Only the disposable S1-A local container is accepted.'
}
$endpoint = & $DockerExe context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or $endpoint -notmatch '^(npipe|unix)://') {
  throw 'A local Docker endpoint is required.'
}
$identity = & $DockerExe inspect --format '{{.Name}} {{json .NetworkSettings.Ports}}' $Container
if ($LASTEXITCODE -ne 0 -or $identity -notmatch '55322') {
  throw 'The disposable local database must use host port 55322.'
}
Write-Output "Local target: $endpoint / $identity"

# Synthetic legal documents and accepted users are transaction-local test data,
# not M7 seeds. A failed psql session also rolls everything back on disconnect.
$fixturePath = Join-Path $PSScriptRoot '../supabase/tests/s1_fixture.sql'
$fixture = Get-Content -LiteralPath $fixturePath -Raw -Encoding UTF8
$sql = @'
begin;
do $$ begin
  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version = '20260823072701'
  ) then
    raise exception 'S1 compatibility test requires additive settlement hardening.';
  end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261017095000') then
    raise exception 'S1 compatibility test requires migrations through M6.';
  end if;
end; $$;
set local s1.tap='off';
'@ + [Environment]::NewLine + $fixture + [Environment]::NewLine + @'
-- v1/v2 signatures remain callable; forced admission and all direct notification
-- inserts are closed. Check catalog ACL and actual authenticated execution.
select pg_temp.check(has_function_privilege('authenticated','public.create_room_settlement(uuid,text,integer,text,text,text)','EXECUTE'),'settlement v1 remains executable');
select pg_temp.check(has_function_privilege('authenticated','public.create_room_settlement_v2(uuid,text,integer,text,text,text)','EXECUTE'),'settlement v2 remains executable');
select pg_temp.check(not has_function_privilege('authenticated','public.invite_friend_to_room(uuid,uuid)','EXECUTE'),'forced invite denied to authenticated');
select pg_temp.check(not has_function_privilege('anon','public.invite_friend_to_room(uuid,uuid)','EXECUTE'),'forced invite denied to anon');
select pg_temp.check(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.invite_friend_to_room(uuid,uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'forced invite denied to PUBLIC');
select pg_temp.check(has_function_privilege('authenticated','public.post_room_system_message(uuid,text)','EXECUTE'),'member system message RPC remains executable');
select pg_temp.check(not has_column_privilege('authenticated','public.notifications','room_id','INSERT'),'legacy notification direct insert closed');
select pg_temp.check(not has_column_privilege('authenticated','public.notifications','settlement_id','INSERT'),'linked notification direct insert closed');
select pg_temp.check(not has_table_privilege('authenticated','public.rooms','UPDATE'),'room direct update closed');
select pg_temp.check(not has_table_privilege('authenticated','public.dutch_pay_bills','INSERT'),'bill direct insert closed');

insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id)
values
 ('a1a1a1a1-1111-1111-1111-111111111111','ADDITV01','Additive v1',current_date+1,clock_timestamp()+interval '7 days','10000001-0000-4000-8000-000000000001'),
 ('a1a1a1a1-2222-2222-2222-222222222222','ADDITV02','Additive v2',current_date+1,clock_timestamp()+interval '7 days','10000001-0000-4000-8000-000000000001');
insert into public.participants(room_id,profile_id,name)
values
 ('a1a1a1a1-1111-1111-1111-111111111111','10000002-0000-4000-8000-000000000002','Additive B'),
 ('a1a1a1a1-2222-2222-2222-222222222222','10000002-0000-4000-8000-000000000002','Additive B');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
-- Fixture A follows H unilaterally; pending invitation elsewhere grants no membership.
select pg_temp.check(pg_temp.sqlstate_of($q$select public.invite_friend_to_room('a1a1a1a1-1111-1111-1111-111111111111','10000008-0000-4000-8000-000000000008')$q$)='42501','one-way follow cannot force admission');
select pg_temp.check(not exists(select 1 from public.participants where room_id='a1a1a1a1-1111-1111-1111-111111111111' and profile_id='10000008-0000-4000-8000-000000000008'),'denied forced invite creates no participant');
select pg_temp.check(public.get_visible_profile('10000008-0000-4000-8000-000000000008')->>'relationship'='identity_only','denied forced invite preserves identity_only');
-- S4 rejects both legacy signatures until the appointment is confirmed.
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement('a1a1a1a1-1111-1111-1111-111111111111','Legacy dinner',20000,'Test bank','100-200','Additive A')$q$)='S4008','v1 rejects settlement before confirmation');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement_v2('a1a1a1a1-2222-2222-2222-222222222222','Current dinner',30000,'Test bank','300-400','Additive A')$q$)='S4008','v2 rejects settlement before confirmation');
reset role;
-- Trusted owner-confirmed fixtures, matching supabase/tests/s4_restart.sql.
-- The settlement calls below still run as the authenticated fixture owner.
update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id
where id in('a1a1a1a1-1111-1111-1111-111111111111','a1a1a1a1-2222-2222-2222-222222222222');
set local role authenticated;
insert into pg_temp.s1_ids values('compat-v1',public.create_room_settlement('a1a1a1a1-1111-1111-1111-111111111111','Legacy dinner',20000,'Test bank','100-200','Additive A'));
select pg_temp.check(public.create_room_settlement('a1a1a1a1-1111-1111-1111-111111111111','Legacy dinner',20000,'Test bank','100-200','Additive A')=(select v from pg_temp.s1_ids where k='compat-v1'),'v1 retry reuses active bill');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.notifications(room_id,title,message,bank_name,account_number,amount) values('a1a1a1a1-1111-1111-1111-111111111111','Legacy notification','Legacy notification','Test bank','100-200',10000)$q$)='42501','legacy notification insert returns 42501');
select pg_temp.check(public.post_room_system_message('a1a1a1a1-1111-1111-1111-111111111111','Legacy system message') is not null,'member system message RPC succeeds');
reset role;
-- Historical unlinked data may still exist; only the trusted fixture owner writes it.
insert into public.notifications(room_id,title,message,amount)
values('a1a1a1a1-1111-1111-1111-111111111111','Historical notification','Historical notification',10000);
set local role authenticated;
select pg_temp.check((select count(*)=1 from public.notifications where room_id='a1a1a1a1-1111-1111-1111-111111111111'),'v1 hides historical unlinked notifications');
select pg_temp.check((select count(*)=1 from public.notifications where settlement_id=(select v from pg_temp.s1_ids where k='compat-v1')),'v1 emits one visible linked notification');
select pg_temp.check((select count(*)=0 from public.messages where room_id='a1a1a1a1-1111-1111-1111-111111111111' and event_key like 'settlement-created:%'),'v1 emits no v2 fixed event');
select pg_temp.check((select count(*)=1 from public.messages where room_id='a1a1a1a1-1111-1111-1111-111111111111' and kind='system' and event_key is null),'v1 member system message remains available');
select pg_temp.check((select count(*)=2 from public.dutch_pay_members where bill_id=(select v from pg_temp.s1_ids where k='compat-v1')),'v1 fixes two recipients');
insert into pg_temp.s1_ids values('compat-v2',public.create_room_settlement_v2('a1a1a1a1-2222-2222-2222-222222222222','Current dinner',30000,'Test bank','300-400','Additive A'));
select pg_temp.check(public.create_room_settlement_v2('a1a1a1a1-2222-2222-2222-222222222222','Current dinner',30000,'Test bank','300-400','Additive A')=(select v from pg_temp.s1_ids where k='compat-v2'),'v2 retry reuses active bill');
select pg_temp.check((select count(*)=1 from public.dutch_pay_bills where id=(select v from pg_temp.s1_ids where k='compat-v2')),'v2 creates one bill');
select pg_temp.check((select count(*)=2 from public.dutch_pay_members where bill_id=(select v from pg_temp.s1_ids where k='compat-v2')),'v2 fixes two recipients');
select pg_temp.check((select count(*)=1 from public.notifications where settlement_id=(select v from pg_temp.s1_ids where k='compat-v2')),'v2 emits one linked notification');
select pg_temp.check((select count(*)=1 from public.messages where room_id='a1a1a1a1-2222-2222-2222-222222222222' and event_key like 'settlement-created:%'),'v2 emits one fixed event');
rollback;
'@

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$lines = @($sql | & $DockerExe exec -i $Container psql -U postgres -d postgres -X -Atq -v ON_ERROR_STOP=1 -f - 2>&1)
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($exitCode -ne 0) { throw ($lines -join [Environment]::NewLine) }
$checks = @($lines | Where-Object { $_ -match '^ok - ' })
if ($checks.Count -ne 29) { throw "Expected 29 fixture/compatibility checks, got $($checks.Count)." }
[pscustomobject]@{
  Phase = 'S1 v1/v2 compatibility and closed privilege boundary'
  Checks = $checks.Count
  SensitiveDirectWritesClosed = $true
  FixtureRolledBack = $true
  Result = 'PASS'
} | Format-List

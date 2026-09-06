param(
  [string]$DockerExe = 'C:\Users\PC\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe',
  [string]$Container = 'supabase_db_mealchat_v2'
)

$ErrorActionPreference = 'Stop'

$userA = 'a1a1a1a1-0000-0000-0000-0000000000a1'
$userB = 'b2b2b2b2-0000-0000-0000-0000000000b2'
$roomV1 = 'a1a1a1a1-1111-1111-1111-111111111111'
$roomV2 = 'a1a1a1a1-2222-2222-2222-222222222222'

function Invoke-LocalPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $lines = & $DockerExe exec $Container psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -Atq -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($lines -join "`n")
  }
  return ($lines -join "`n").Trim()
}

function Find-Uuid {
  param([Parameter(Mandatory = $true)][string]$Output)

  $match = [regex]::Match(
    $Output,
    '(?im)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  if (-not $match.Success) {
    throw "Expected a UUID result, received: $Output"
  }
  return $match.Value.ToLowerInvariant()
}

$cleanupSql = @"
delete from public.rooms where id in ('$roomV1'::uuid, '$roomV2'::uuid);
delete from auth.users where id in ('$userA'::uuid, '$userB'::uuid);
"@

try {
  $latestMigration = Invoke-LocalPsql -Sql @"
select version from supabase_migrations.schema_migrations order by version desc limit 1;
"@
  if ($latestMigration -ne '20260823072701') {
    throw "Additive compatibility test requires migration 20260823072701, found $latestMigration."
  }

  Invoke-LocalPsql -Sql $cleanupSql | Out-Null

  Invoke-LocalPsql -Sql @"
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('$userA', 'authenticated', 'authenticated', 'additive-a@example.invalid',
   '{}'::jsonb, '{"name":"Additive A"}'::jsonb, now(), now()),
  ('$userB', 'authenticated', 'authenticated', 'additive-b@example.invalid',
   '{}'::jsonb, '{"name":"Additive B"}'::jsonb, now(), now());

insert into public.rooms (
  id, code, title, meeting_date, expires_at, owner_id,
  is_confirmed, confirmed_slot, color, location_name
)
values
  ('$roomV1', 'ADDITV01', 'Additive v1', current_date + 1,
   now() + interval '7 days', '$userA', false, null, '#23A455', 'Test location'),
  ('$roomV2', 'ADDITV02', 'Additive v2', current_date + 1,
   now() + interval '7 days', '$userA', false, null, '#23A455', 'Test location');

insert into public.participants (room_id, profile_id, name, avatar_color)
values
  ('$roomV1', '$userB', 'Additive B', '#3366FF'),
  ('$roomV2', '$userB', 'Additive B', '#3366FF');
"@ | Out-Null

  $privileges = Invoke-LocalPsql -Sql @"
select json_build_object(
  'v1_execute', has_function_privilege(
    'authenticated',
    'public.create_room_settlement(uuid,text,integer,text,text,text)',
    'EXECUTE'
  ),
  'v2_execute', has_function_privilege(
    'authenticated',
    'public.create_room_settlement_v2(uuid,text,integer,text,text,text)',
    'EXECUTE'
  ),
  'forced_invite_execute', has_function_privilege(
    'authenticated', 'public.invite_friend_to_room(uuid,uuid)', 'EXECUTE'
  ),
  'generic_system_execute', has_function_privilege(
    'authenticated', 'public.post_room_system_message(uuid,text)', 'EXECUTE'
  ),
  'legacy_notification_insert', has_column_privilege(
    'authenticated', 'public.notifications', 'room_id', 'INSERT'
  ),
  'linked_notification_insert', has_column_privilege(
    'authenticated', 'public.notifications', 'settlement_id', 'INSERT'
  ),
  'room_update', has_table_privilege('authenticated', 'public.rooms', 'UPDATE'),
  'bill_insert', has_table_privilege(
    'authenticated', 'public.dutch_pay_bills', 'INSERT'
  )
)::text;
"@ | ConvertFrom-Json

  if (
    -not $privileges.v1_execute -or
    -not $privileges.v2_execute -or
    -not $privileges.forced_invite_execute -or
    -not $privileges.generic_system_execute -or
    -not $privileges.legacy_notification_insert -or
    $privileges.linked_notification_insert -or
    $privileges.room_update -or
    $privileges.bill_insert
  ) {
    throw 'Additive privilege boundary does not match the compatibility contract.'
  }

  $v1Sql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select public.create_room_settlement(
  '$roomV1'::uuid, 'Legacy dinner', 20000,
  'Test bank', '100-200', 'Additive A'
);
commit;
"@
  $v1Bill = Find-Uuid -Output (Invoke-LocalPsql -Sql $v1Sql)
  $v1Retry = Find-Uuid -Output (Invoke-LocalPsql -Sql $v1Sql)
  if ($v1Bill -ne $v1Retry) {
    throw 'Settlement v1 retry returned a different active bill.'
  }

  Invoke-LocalPsql -Sql @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
insert into public.notifications (
  room_id, title, message, bank_name, account_number, amount
)
values (
  '$roomV1'::uuid, 'Legacy notification', 'Legacy notification',
  'Test bank', '100-200', 10000
);
select public.post_room_system_message('$roomV1'::uuid, 'Legacy system message');
commit;
"@ | Out-Null

  $v1Visible = Invoke-LocalPsql -Sql @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select json_build_object(
  'visible_notifications', (
    select count(*) from public.notifications where room_id = '$roomV1'::uuid
  ),
  'linked_notifications', (
    select count(*) from public.notifications where settlement_id = '$v1Bill'::uuid
  ),
  'fixed_events', (
    select count(*) from public.messages
    where room_id = '$roomV1'::uuid and event_key like 'settlement-created:%'
  ),
  'legacy_system_messages', (
    select count(*) from public.messages
    where room_id = '$roomV1'::uuid and kind = 'system' and event_key is null
  )
)::text;
commit;
"@ | ConvertFrom-Json

  $v1Total = Invoke-LocalPsql -Sql @"
select json_build_object(
  'total_notifications', (
    select count(*) from public.notifications where room_id = '$roomV1'::uuid
  ),
  'members', (
    select count(*) from public.dutch_pay_members where bill_id = '$v1Bill'::uuid
  )
)::text;
"@ | ConvertFrom-Json

  if (
    $v1Visible.visible_notifications -ne 1 -or
    $v1Visible.linked_notifications -ne 1 -or
    $v1Visible.fixed_events -ne 0 -or
    $v1Visible.legacy_system_messages -ne 1 -or
    $v1Total.total_notifications -ne 2 -or
    $v1Total.members -ne 2
  ) {
    throw 'Settlement v1 additive behavior is not compatible or leaks legacy notification data.'
  }

  $v2Bill = Find-Uuid -Output (Invoke-LocalPsql -Sql @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select public.create_room_settlement_v2(
  '$roomV2'::uuid, 'Current dinner', 30000,
  'Test bank', '300-400', 'Additive A'
);
commit;
"@)

  $v2State = Invoke-LocalPsql -Sql @"
select json_build_object(
  'bills', (
    select count(*) from public.dutch_pay_bills where id = '$v2Bill'::uuid
  ),
  'members', (
    select count(*) from public.dutch_pay_members where bill_id = '$v2Bill'::uuid
  ),
  'linked_notifications', (
    select count(*) from public.notifications where settlement_id = '$v2Bill'::uuid
  ),
  'fixed_events', (
    select count(*) from public.messages
    where room_id = '$roomV2'::uuid and event_key like 'settlement-created:%'
  )
)::text;
"@ | ConvertFrom-Json

  if (
    $v2State.bills -ne 1 -or
    $v2State.members -ne 2 -or
    $v2State.linked_notifications -ne 1 -or
    $v2State.fixed_events -ne 1
  ) {
    throw 'Settlement v2 additive behavior is incomplete or duplicated.'
  }

  [pscustomobject]@{
    Phase = '20260823072701 additive'
    V1LinkedVisibleNotifications = $v1Visible.linked_notifications
    V1LegacyVisibleNotifications = $v1Visible.visible_notifications - $v1Visible.linked_notifications
    V1LegacySystemMessages = $v1Visible.legacy_system_messages
    V2LinkedNotifications = $v2State.linked_notifications
    V2FixedEvents = $v2State.fixed_events
    SensitiveDirectWritesClosed = $true
    Result = 'PASS'
  } | Format-List
}
finally {
  Invoke-LocalPsql -Sql $cleanupSql | Out-Null
}

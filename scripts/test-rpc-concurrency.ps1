param(
  [string]$DockerExe = 'C:\Users\PC\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe',
  [string]$Container = 'supabase_db_mealchat_v2'
)

$ErrorActionPreference = 'Stop'

$userA = 'dddddddd-0000-0000-0000-0000000000a1'
$userB = 'eeeeeeee-0000-0000-0000-0000000000b2'
$roomId = 'dddddddd-1111-1111-1111-111111111111'

function Invoke-LocalPsql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $lines = & $DockerExe exec $Container psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -Atq -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($lines -join "`n")
  }
  return ($lines -join "`n").Trim()
}

function Start-LocalPsqlJob {
  param([Parameter(Mandatory = $true)][string]$Sql)

  return Start-Job -ScriptBlock {
    param($DockerPath, $ContainerName, $Statement)
    $lines = & $DockerPath exec $ContainerName psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -Atq -c $Statement 2>&1
    [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = ($lines -join "`n").Trim()
    }
  } -ArgumentList $DockerExe, $Container, $Sql
}

function Receive-CheckedJob {
  param([Parameter(Mandatory = $true)]$Job)

  Wait-Job -Job $Job | Out-Null
  $result = Receive-Job -Job $Job
  Remove-Job -Job $Job
  if ($null -eq $result -or $result.ExitCode -ne 0) {
    throw "Concurrent psql session failed: $($result.Output)"
  }
  return [string]$result.Output
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
delete from public.rooms where id = '$roomId'::uuid;
delete from auth.users where id in ('$userA'::uuid, '$userB'::uuid);
"@

try {
  Invoke-LocalPsql -Sql $cleanupSql | Out-Null

  $seedSql = @"
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('$userA', 'authenticated', 'authenticated', 'concurrency-a@example.invalid',
   '{}'::jsonb, '{"name":"Concurrency A"}'::jsonb, now(), now()),
  ('$userB', 'authenticated', 'authenticated', 'concurrency-b@example.invalid',
   '{}'::jsonb, '{"name":"Concurrency B"}'::jsonb, now(), now());

insert into public.follows (follower_id, following_id, role)
values ('$userA', '$userB', 'mate');

insert into public.rooms (
  id, code, title, meeting_date, expires_at, owner_id,
  is_confirmed, confirmed_slot, color, location_name
)
values (
  '$roomId', 'CONCUR01', 'Concurrency room', current_date + 1,
  now() + interval '7 days', '$userA', false, null, '#23A455', 'Test location'
);
"@
  Invoke-LocalPsql -Sql $seedSql | Out-Null

  $createInvitationSql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select public.create_room_invitation('$roomId'::uuid, '$userB'::uuid);
commit;
"@
  $invitationId = Find-Uuid -Output (Invoke-LocalPsql -Sql $createInvitationSql)

  $acceptFirstSql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userB';
set local "request.jwt.claims" = '{"sub":"$userB","role":"authenticated"}';
select public.accept_room_invitation('$invitationId'::uuid);
select pg_sleep(4);
commit;
-- concurrency-accept-first
"@
  $acceptSecondSql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userB';
set local "request.jwt.claims" = '{"sub":"$userB","role":"authenticated"}';
select public.accept_room_invitation('$invitationId'::uuid);
commit;
-- concurrency-accept-second
"@

  $acceptFirstJob = Start-LocalPsqlJob -Sql $acceptFirstSql
  Start-Sleep -Milliseconds 1000
  $acceptSecondJob = Start-LocalPsqlJob -Sql $acceptSecondSql
  $acceptFirstOutput = Receive-CheckedJob -Job $acceptFirstJob
  $acceptSecondOutput = Receive-CheckedJob -Job $acceptSecondJob
  $acceptFirstRoom = Find-Uuid -Output $acceptFirstOutput
  $acceptSecondRoom = Find-Uuid -Output $acceptSecondOutput

  if ($acceptFirstRoom -ne $roomId -or $acceptSecondRoom -ne $roomId) {
    throw 'Concurrent invitation acceptance did not return the same room.'
  }

  $acceptState = Invoke-LocalPsql -Sql @"
select json_build_object(
  'participant_count', (
    select count(*) from public.participants
    where room_id = '$roomId'::uuid and profile_id = '$userB'::uuid
  ),
  'invitation_status', (
    select status from public.room_invitations where id = '$invitationId'::uuid
  )
)::text;
"@ | ConvertFrom-Json

  if ($acceptState.participant_count -ne 1 -or $acceptState.invitation_status -ne 'accepted') {
    throw 'Concurrent invitation acceptance produced duplicate or invalid state.'
  }

  $settlementFirstSql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select public.create_room_settlement_v2(
  '$roomId'::uuid, 'Concurrency dinner', 30000,
  'Test bank', '111-222', 'Concurrency A'
);
select pg_sleep(4);
commit;
-- concurrency-settlement-first
"@
  $settlementSecondSql = @"
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '$userA';
set local "request.jwt.claims" = '{"sub":"$userA","role":"authenticated"}';
select public.create_room_settlement_v2(
  '$roomId'::uuid, 'Concurrency dinner', 30000,
  'Test bank', '111-222', 'Concurrency A'
);
commit;
-- concurrency-settlement-second
"@

  $settlementFirstJob = Start-LocalPsqlJob -Sql $settlementFirstSql
  Start-Sleep -Milliseconds 1000
  $settlementSecondJob = Start-LocalPsqlJob -Sql $settlementSecondSql
  $settlementFirstOutput = Receive-CheckedJob -Job $settlementFirstJob
  $settlementSecondOutput = Receive-CheckedJob -Job $settlementSecondJob
  $firstBill = Find-Uuid -Output $settlementFirstOutput
  $secondBill = Find-Uuid -Output $settlementSecondOutput

  if ($firstBill -ne $secondBill) {
    throw 'Concurrent settlement creation returned different active bills.'
  }

  $settlementState = Invoke-LocalPsql -Sql @"
select json_build_object(
  'bill_count', (
    select count(*) from public.dutch_pay_bills where room_id = '$roomId'::uuid
  ),
  'member_count', (
    select count(*) from public.dutch_pay_members where bill_id = '$firstBill'::uuid
  ),
  'notification_count', (
    select count(*) from public.notifications where settlement_id = '$firstBill'::uuid
  ),
  'event_count', (
    select count(*) from public.messages
    where room_id = '$roomId'::uuid and event_key like 'settlement-created:%'
  )
)::text;
"@ | ConvertFrom-Json

  if (
    $settlementState.bill_count -ne 1 -or
    $settlementState.member_count -ne 2 -or
    $settlementState.notification_count -ne 1 -or
    $settlementState.event_count -ne 1
  ) {
    throw 'Concurrent settlement creation produced duplicate or incomplete state.'
  }

  [pscustomobject]@{
    InvitationAcceptSessions = 2
    InvitationParticipantRows = $acceptState.participant_count
    SettlementCreateSessions = 2
    SettlementBills = $settlementState.bill_count
    SettlementMembers = $settlementState.member_count
    SettlementNotifications = $settlementState.notification_count
    SettlementEvents = $settlementState.event_count
    Result = 'PASS'
  } | Format-List
}
finally {
  Invoke-LocalPsql -Sql $cleanupSql | Out-Null
}

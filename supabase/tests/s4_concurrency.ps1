param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$UserA = '10000001-0000-4000-8000-000000000001'
$UserB = '10000002-0000-4000-8000-000000000002'
$Room = '20000000-0000-4000-8000-000000000001'
function User-Sql([string]$Subject,[string]$Body) {
    return "set local role authenticated; select set_config('request.jwt.claims','{""sub"":""$Subject"",""role"":""authenticated""}',true); $Body"
}
function Grant-Health([int]$Revision) {
    return "select public.set_optional_consent(gen_random_uuid(),'health','grant',(public.get_consent_manifest()->'documents'->'health'->>'version'),(public.get_consent_manifest()->'documents'->'health'->>'content_hash'),$Revision,'settings');"
}
function Race-Sql([string]$First,[string]$Second,[string]$Expected='00000',[string]$BeforeCommit='',[switch]$NonBlocking) {
    $Name = 's4_a_race_first'
    $WaiterName = 's4_a_race_waiter'
    $WaiterJob = $null
    # Keep psql's stdin open: COMMIT is sent only after the waiter is observed.
    # Process startup speed therefore cannot turn a race into two sequential calls.
    $StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $StartInfo.FileName = $DockerExe
    $StartInfo.Arguments = "exec -i $Container psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f -"
    $StartInfo.UseShellExecute = $false
    $StartInfo.CreateNoWindow = $true
    $StartInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $StartInfo.RedirectStandardInput = $true
    $StartInfo.RedirectStandardOutput = $true
    $StartInfo.RedirectStandardError = $true
    $Holder = [System.Diagnostics.Process]::new()
    $Holder.StartInfo = $StartInfo
    if (-not $Holder.Start()) { throw 'Cannot start lock holder' }
    $HolderOutput = $Holder.StandardOutput.ReadToEndAsync()
    $HolderError = $Holder.StandardError.ReadToEndAsync()
    try {
        $Holder.StandardInput.WriteLine("set application_name='$Name'; begin; set local statement_timeout='15s'; $First")
        $Holder.StandardInput.Flush()
        $Ready = $false
        for ($Try=0; $Try -lt 80; $Try++) {
            $Active = Invoke-S1Sql "select exists(select 1 from pg_stat_activity where application_name='$Name' and state='idle in transaction' and wait_event='ClientRead');" $Container
            if ($Active.Trim() -eq 't') { $Ready=$true; break }
            if ($Holder.HasExited) { throw "Lock holder failed: $($HolderError.Result)" }
            Start-Sleep -Milliseconds 100
        }
        if (-not $Ready) { throw 'First connection did not reach the lock-held synchronization point' }
        # Invoker wrapper records the expected SQLSTATE without printing payloads.
        $Wrapper = 'create function pg_temp.state_of(command text) returns text language plpgsql as $$ begin execute command; return ''00000''; exception when others then return sqlstate; end; $$;'
        $SecondSql = "set application_name='$WaiterName'; begin; set local statement_timeout='15s'; $Wrapper select pg_temp.state_of(`$race`$$Second`$race`$); commit;"
        if ($NonBlocking) { $SecondSql=$SecondSql.Replace("set local statement_timeout='15s';","set local statement_timeout='15s'; set local lock_timeout='500ms';") }
        $WaiterJob = Start-Job -ArgumentList $DockerExe,$Container,$SecondSql -ScriptBlock {
            param($Exe,$DbContainer,$Sql)
            $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
            $Output = @($Sql | & $Exe exec -i $DbContainer psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f - 2>&1)
            if ($LASTEXITCODE -ne 0) { throw ($Output -join [Environment]::NewLine) }
            return $Output
        }
        if ($NonBlocking) {
            $Result = (Receive-Job $WaiterJob -Wait -ErrorAction Stop) -join [Environment]::NewLine
            if ($Result -notmatch "(?m)^$Expected\s*$") { throw "Unexpected nonblocking reader/writer outcome; expected $Expected" }
            $Holder.StandardInput.WriteLine($BeforeCommit + ' commit;')
            $Holder.StandardInput.Close()
            if (-not $Holder.WaitForExit(10000) -or $Holder.ExitCode -ne 0) { throw 'Nonblocking holder commit failed' }
            return
        }
        $Blocked = $false
        for ($Try=0; $Try -lt 80; $Try++) {
            $Observed = Invoke-S1Sql "select exists(select 1 from pg_stat_activity waiter join pg_stat_activity holder on holder.pid=any(pg_blocking_pids(waiter.pid)) where waiter.application_name='$WaiterName' and holder.application_name='$Name' and waiter.wait_event_type='Lock');" $Container
            if ($Observed.Trim() -eq 't') { $Blocked=$true; break }
            if ($WaiterJob.State -in @('Completed','Failed') -or $Holder.HasExited) { break }
            Start-Sleep -Milliseconds 100
        }
        if (-not $Blocked) {
            $WaiterResult = if ($WaiterJob.State -in @('Completed','Failed')) { (Receive-Job $WaiterJob -ErrorAction Continue) -join ' ' } else { 'still running' }
            throw "The second connection was not observed waiting on the first connection lock; waiter=$WaiterResult"
        }
        $Holder.StandardInput.WriteLine($BeforeCommit + ' commit;')
        $Holder.StandardInput.Close()
        if (-not $Holder.WaitForExit(10000)) { throw 'Lock holder commit timed out' }
        if ($Holder.ExitCode -ne 0) { throw "Lock holder commit failed: $($HolderError.Result)" }
        $Result = (Receive-Job $WaiterJob -Wait -ErrorAction Stop) -join [Environment]::NewLine
        if ($Result -notmatch "(?m)^$Expected\s*$") { throw "Unexpected waiter outcome; expected $Expected" }
    } finally {
        if (-not $Holder.HasExited) {
            $Holder.StandardInput.WriteLine('rollback;')
            $Holder.StandardInput.Close()
            if (-not $Holder.WaitForExit(10000)) { $Holder.Kill() }
        }
        if ($null -ne $WaiterJob) {
            if ($WaiterJob.State -eq 'Running') { Stop-Job $WaiterJob }
            Remove-Job $WaiterJob -Force
        }
        $Holder.Dispose()
    }
}
function Assert-Sql([string]$Expression,[string]$Label) {
    $Value = Invoke-S1Sql "select ($Expression);" $Container
    if ($Value.Trim() -ne 't') { throw "Concurrency assertion failed: $Label" }
    Write-Output "ok - $Label"
}

# Synthetic fixture is committed only in the disposable 55322 database and reset in finally.
$Fixture=(Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_fixture.sql'))
$A=$UserA; $B=$UserB; $C='10000003-0000-4000-8000-000000000003'
$Item='94000000-0000-4000-8000-000000000001'
$Other='94000000-0000-4000-8000-000000000002'
$Slots="array[to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-11']"
$Time="jsonb_build_object('starts_at',((clock_timestamp() at time zone 'Asia/Seoul')::date+1)::text||'T11:00:00+09:00','ends_at',((clock_timestamp() at time zone 'Asia/Seoul')::date+1)::text||'T12:00:00+09:00','time_zone','Asia/Seoul')"
function New-Room([int]$Number,[string]$Stage='scheduling',[int]$Votes=2) {
 $script:R='25000000-0000-4000-8000-'+$Number.ToString('000000000000')
 $Sql="insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('$R','RACE$Number','Synthetic race',current_date+1,clock_timestamp()+interval '4 days','$A'); insert into public.participants(room_id,profile_id,name) values('$R','$B','Synthetic B'); update public.participants set schedule=jsonb_build_object('slots',$Slots) where room_id='$R';"
 if ($Stage -eq 'place') { $Sql+="update public.rooms set stage='place',meeting_starts_at=($Time->>'starts_at')::timestamptz,meeting_ends_at=($Time->>'ends_at')::timestamptz,meeting_time_zone='Asia/Seoul',voting_items=jsonb_build_array(jsonb_build_object('id','$Item','kind','menu','label','Synthetic one','created_by','$A'),jsonb_build_object('id','$Other','kind','menu','label','Synthetic two','created_by','$A')) where id='$R'; update public.participants set voted_items=jsonb_build_array('$Item'::text) where room_id='$R' and (profile_id='$A' or $Votes=2);" }
 Invoke-S1Sql $Sql $Container | Out-Null
 $script:Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
}
function Select-Time { return "select public.select_room_meeting_time_v1('$R',$Time,$Rev,gen_random_uuid());" }
function Confirm { return "select public.confirm_room_appointment_v1('$R','$Item',$Rev,gen_random_uuid());" }
try {
 Invoke-S1Sql ("begin; set local s1.tap='off';"+$Fixture+'commit;') $Container | Out-Null
 New-Room 1
 Race-Sql (User-Sql $B "select public.set_my_availability('$R','{}');") (User-Sql $A "select public.advance_room_stage('$R','place');") 'S4004'
 Assert-Sql "(select stage='scheduling' from public.rooms where id='$R')" 'withdrawal before transition prevents incomplete advance'
 New-Room 2
 Race-Sql (User-Sql $A "select public.advance_room_stage('$R','place');") (User-Sql $B "select public.set_my_availability('$R','{}');")
 Assert-Sql "(select stage='place' and meeting_starts_at is null from public.rooms where id='$R') and (select schedule->'slots'='[]'::jsonb from public.participants where room_id='$R' and profile_id='$B')" 'time-unselected place preserves the approved schedule-edit exception'
 New-Room 3
 Invoke-S1Sql "update public.participants set schedule='{}' where room_id='$R' and profile_id='$B';" $Container | Out-Null
 Race-Sql (User-Sql $B "select public.set_my_availability('$R',$Slots);") (User-Sql $A "select public.advance_room_stage('$R','place');")
 Assert-Sql "(select stage='place' from public.rooms where id='$R')" 'last submission before transition is observed'
 New-Room 4
 # Both legal ranges have a full attendee; the loser must fail CAS rather than overwrite.
 Invoke-S1Sql "update public.participants set schedule=jsonb_build_object('slots',$Slots||array[to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-12']) where room_id='$R';" $Container | Out-Null
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 $Later="jsonb_build_object('starts_at',($Time->>'starts_at')::timestamptz+interval '1 hour','ends_at',($Time->>'ends_at')::timestamptz+interval '1 hour','time_zone','Asia/Seoul')"
 Race-Sql (User-Sql $A (Select-Time)) (User-Sql $A "select public.select_room_meeting_time_v1('$R',$Later,$Rev,gen_random_uuid());") 'S4005'
 Assert-Sql "(select meeting_starts_at=($Time->>'starts_at')::timestamptz from public.rooms where id='$R')" 'two devices with one revision have one time winner'
 New-Room 5 'place' 1
 Race-Sql (User-Sql $B "select public.toggle_vote('$R','$Item');") (User-Sql $A (Confirm)) 'S4005'
 Assert-Sql "(select stage='place' from public.rooms where id='$R')" 'last vote invalidates an old owner confirmation revision'
 New-Room 6 'place'
 Race-Sql (User-Sql $A (Confirm)) (User-Sql $B "select public.toggle_vote('$R','$Item');") 'S4003'
 Assert-Sql "(select count(*)=1 from public.messages where event_key='appointment-confirmed:$R')" 'confirmation before vote freezes votes and emits one event'
 New-Room 7 'place'
 Race-Sql (User-Sql $A "select public.remove_voting_item('$R','$Item');") (User-Sql $A (Confirm)) 'S4005'
 Assert-Sql "not exists(select 1 from public.participants where room_id='$R' and voted_items?'$Item')" 'candidate deletion removes orphan votes before confirmation'
 New-Room 8 'place'
 Race-Sql (User-Sql $B "select public.add_voting_item('$R','menu','New candidate');") (User-Sql $A (Confirm)) 'S4005'
 Assert-Sql "(select stage='place' from public.rooms where id='$R')" 'candidate addition invalidates stale confirmation'
 New-Room 9
 Race-Sql (User-Sql $C "select public.join_room_by_code('RACE9');") (User-Sql $A "select public.advance_room_stage('$R','place');") 'S4004'
 Assert-Sql "(select count(*)=3 from public.participants where room_id='$R')" 'join before advance updates actual quorum'
 New-Room 10
 Race-Sql (User-Sql $A "select public.advance_room_stage('$R','place');") (User-Sql $C "select public.join_room_by_code('RACE10');")
 Assert-Sql "(select stage='place' from public.rooms where id='$R') and (select schedule='{}' from public.participants where room_id='$R' and profile_id='$C')" 'join after advance preserves stage and leaves new member unsubmitted'
 New-Room 11
 Invoke-S1Sql "insert into public.follows(follower_id,following_id,role) values('$A','$C','mate') on conflict do nothing;" $Container | Out-Null
 $Invite=(Invoke-S1Sql ("begin;"+(User-Sql $A "select public.create_room_invitation('$R','$C');")+'commit;') $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 Race-Sql (User-Sql $C "select public.accept_room_invitation('$Invite');") (User-Sql $A "select public.advance_room_stage('$R','place');") 'S4004'
 Assert-Sql "(select count(*)=3 from public.participants where room_id='$R')" 'invitation acceptance before advance updates quorum'
 New-Room 12
 Race-Sql (User-Sql $A "select public.leave_room('$R');") (User-Sql $B "select public.submit_room_availability_v1('$R',$Slots,$Rev,gen_random_uuid());") '42501'
 Assert-Sql "not exists(select 1 from private.s4_requests where room_id='$R') and not exists(select 1 from public.messages where room_id='$R')" 'room close before save leaves no orphan ledger or event'
 New-Room 13 'place'
 $Request='65000000-0000-4000-8000-000000000001'
 $Same="select public.confirm_room_appointment_v1('$R','$Item',$Rev,'$Request');"
 Race-Sql (User-Sql $A $Same) (User-Sql $A $Same)
 Assert-Sql "(select count(*)=1 from private.s4_requests where request_id='$Request') and (select count(*)=1 from public.messages where event_key='appointment-confirmed:$R')" 'parallel identical request replays with one ledger and one event'
 New-Room 14
 $R1=$R; $Rev1=$Rev
 New-Room 15
 Race-Sql (User-Sql $A "select public.select_room_meeting_time_v1('$R1',$Time,$Rev1,'65000000-0000-4000-8000-000000000002');") (User-Sql $A "select public.select_room_meeting_time_v1('$R',$Time,$Rev,'65000000-0000-4000-8000-000000000002');") 'S1007'
 Assert-Sql "(select count(*)=1 from private.s4_requests where request_id='65000000-0000-4000-8000-000000000002') and (select stage='place' and meeting_starts_at is not null from public.rooms where id='$R1') and (select stage='scheduling' and meeting_starts_at is null from public.rooms where id='$R')" 'cross-room request collision rolls back the loser time and stage'
 New-Room 16
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0));" (User-Sql $A (Select-Time)) '42501' "update public.rooms set expires_at=clock_timestamp()-interval '1 microsecond' where id='$R';"
 Assert-Sql "(select stage='scheduling' from public.rooms where id='$R')" 'room expiry is rechecked after waiting for room lock'
 New-Room 17 'place'
 $RejectedSettlement="select pg_advisory_xact_lock(hashtextextended('$R',0)); do `$guard`$ begin begin perform public.create_room_settlement_v2('$R','Synthetic race bill',2000,'Synthetic','0000','Synthetic A'); raise exception 'EARLY_SETTLEMENT_ACCEPTED'; exception when sqlstate 'S4008' then null; end; end; `$guard`$;"
 Race-Sql (User-Sql $A $RejectedSettlement) (User-Sql $A (Confirm))
 Assert-Sql "(select stage='confirmed' from public.rooms where id='$R') and not exists(select 1 from public.dutch_pay_bills where room_id='$R')" 'rejected preconfirmation settlement cannot bypass or invalidate the later owner decision'
 New-Room 18 'place'
 Race-Sql (User-Sql $A (Confirm)) (User-Sql $A "select public.create_room_settlement_v2('$R','Synthetic race bill',2000,'Synthetic','0000','Synthetic A');")
 Assert-Sql "(select stage='settling' and appointment_confirmed_at is not null from public.rooms where id='$R')" 'confirmation before settlement preserves owner evidence'
 New-Room 19 'place'
 Invoke-S1Sql ("begin;"+(User-Sql $A "select public.set_room_recommendation_area_v2('$R','local-dev-seoul-center',0); select public.begin_room_recommendation_v2('$R','65000000-0000-4000-8000-000000000003','places');")+'commit;') $Container | Out-Null
 $Token=(Invoke-S1Sql "begin;set local role service_role;select set_config('request.jwt.claims','{""role"":""service_role""}',true);select public.claim_recommendation_work_v2('65000000-0000-4000-8000-000000000003')->>'work_token';commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 $Finalize="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('65000000-0000-4000-8000-000000000003','$Token','{""places"":[]}','[]','rules');"
 Race-Sql (User-Sql $A (Confirm)) $Finalize 'S5003'
 Assert-Sql "(select status='working' from private.recommendation_requests where request_id='65000000-0000-4000-8000-000000000003')" 'S5 waiting finalize rejects context changed by S4 confirmation'
 New-Room 20 'place'
 Race-Sql (User-Sql $A "select public.set_room_recommendation_area_v2('$R','local-dev-seoul-center',0);") (User-Sql $A (Confirm))
 Assert-Sql "(select stage='confirmed' from public.rooms where id='$R')" 'S5 area writer and S4 confirmation share lock order without deadlock'
 New-Room 22 'place' 1
 Invoke-S1Sql "delete from public.participants where room_id='$R' and profile_id='$B';" $Container | Out-Null
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 Race-Sql (User-Sql $C "select public.join_room_by_code('RACE22');") (User-Sql $A (Confirm)) 'S4005'
 Assert-Sql "(select stage='place' from public.rooms where id='$R') and private.s4_leader('$R')->>'leading_votes'='1' and private.s4_leader('$R')->>'required_votes'='2'" 'join before final confirmation changes a solo majority into an insufficient vote'
 New-Room 23 'place'
 Race-Sql (User-Sql $A (Confirm)) (User-Sql $C "select public.join_room_by_code('RACE23');")
 Assert-Sql "(select stage='confirmed' and appointment_confirmed_at is not null from public.rooms where id='$R') and (select count(*)=3 from public.participants where room_id='$R') and (select count(*)=1 from public.messages where event_key='appointment-confirmed:$R')" 'join after final confirmation preserves the recorded decision and single event'
 New-Room 24 'place'
 Invoke-S1Sql ("begin;"+(User-Sql $A (Confirm))+'commit;') $Container | Out-Null
 Invoke-S1Sql ("begin;"+(User-Sql $A "select public.create_room_settlement_v2('$R','Synthetic completion race',2000,'Synthetic','0000','Synthetic A');")+'commit;') $Container | Out-Null
 $Bill=(Invoke-S1Sql "select id from public.dutch_pay_bills where room_id='$R';" $Container).Trim()
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 Race-Sql (User-Sql $A "select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id='$Bill';") (User-Sql $A (Select-Time)) 'S4005'
 Assert-Sql "(select stage='done' and meeting_starts_at=($Time->>'starts_at')::timestamptz from public.rooms where id='$R') and (select payment_disclosure_closed_at is not null and account_number='' from public.dutch_pay_bills where id='$Bill')" 'settlement completion before time selection preserves done and closed disclosure'
 # An unselected legacy place can be edited, but not across a winning owner time selection.
 New-Room 40
 Invoke-S1Sql "update public.rooms set stage='place' where id='$R';" $Container | Out-Null
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 $Resubmit="select public.submit_room_availability_v1('$R',$Slots||array[to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-12'],$Rev,gen_random_uuid());"
 Race-Sql (User-Sql $B $Resubmit) (User-Sql $A (Select-Time)) 'S4005'
 Assert-Sql "(select stage='place' and meeting_starts_at is null from public.rooms where id='$R') and (select jsonb_array_length(schedule->'slots')=2 from public.participants where room_id='$R' and profile_id='$B')" 'unselected place resubmission invalidates a waiting stale owner time selection'
 New-Room 41
 Invoke-S1Sql "update public.rooms set stage='place' where id='$R';" $Container | Out-Null
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 $Resubmit="select public.submit_room_availability_v1('$R',$Slots||array[to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-12'],$Rev,gen_random_uuid());"
 Race-Sql (User-Sql $A (Select-Time)) (User-Sql $B $Resubmit) 'S4005'
 $Frozen="do `$guard`$ begin begin perform public.set_my_availability('$R',$Slots); raise exception 'FROZEN_PLACE_ACCEPTED'; exception when sqlstate 'S4003' then null; end; end; `$guard`$;"
 Invoke-S1Sql ("begin;"+(User-Sql $B $Frozen)+'commit;') $Container | Out-Null
 Assert-Sql "(select meeting_starts_at is not null from public.rooms where id='$R') and (select jsonb_array_length(schedule->'slots')=1 from public.participants where room_id='$R' and profile_id='$B')" 'owner selection before place resubmission preserves the selected time and rejects a fresh legacy retry'
 # A held reader must not block another member's S1 profile/consent writer, or vice versa.
 $ReadEndpoints=@('get_room_s4_state','room_availability_status','room_availability_cells','preview_room_meeting_time_v1')
 foreach ($Endpoint in $ReadEndpoints) {
  New-Room (30+$ReadEndpoints.IndexOf($Endpoint))
  $Read=if($Endpoint -eq 'preview_room_meeting_time_v1'){"select public.$Endpoint('$R',$Time->>'starts_at',$Time->>'ends_at','Asia/Seoul');"}else{"select public.$Endpoint('$R');"}
  $Consent="select public.set_optional_consent(gen_random_uuid(),'marketing','withdraw',null,null,null,'settings');"
  Race-Sql (User-Sql $A $Read) (User-Sql $B $Consent) -NonBlocking
  Assert-Sql "(select status='withdrawn' from public.profile_consent_states where profile_id='$B' and kind='marketing')" "$Endpoint reader does not block another member consent writer"
  Race-Sql (User-Sql $B $Consent) (User-Sql $A $Read) -NonBlocking
  Assert-Sql "(select stage='scheduling' from public.rooms where id='$R')" "$Endpoint reads while another member profile is locked"
 }
 New-Room 42
 $Preview="select public.preview_room_meeting_time_v1('$R',$Time->>'starts_at',$Time->>'ends_at','Asia/Seoul');"
 Race-Sql (User-Sql $B $Preview) (User-Sql $A (Select-Time)) -NonBlocking
 Assert-Sql "(select stage='place' and meeting_starts_at is not null from public.rooms where id='$R')" 'held preview does not block owner room/profile/advisory writer'
 New-Room 43
 $PreviewSnapshot="do `$snapshot`$ declare info jsonb; begin info:=public.preview_room_meeting_time_v1('$R',$Time->>'starts_at',$Time->>'ends_at','Asia/Seoul'); if info->>'revision'<>'$Rev' or info->>'available_count'<>'2' then raise exception 'PREVIEW_SNAPSHOT_MISMATCH'; end if; end; `$snapshot`$;"
 Race-Sql (User-Sql $A (Select-Time)) (User-Sql $B $PreviewSnapshot) -NonBlocking
 Assert-Sql "(select stage='place' and s4_revision>$Rev from public.rooms where id='$R')" 'preview reads a consistent old snapshot while a writer holds all room/profile locks'
 # Membership closure is serialized with new settlement creation in both orders.
 $H='10000008-0000-4000-8000-000000000008'
 foreach ($Number in 44..49) {
  New-Room $Number
  Invoke-S1Sql "update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id where id='$R';" $Container | Out-Null
  $StartBill="select public.create_room_settlement_v2('$R','Race settlement',3000,'Synthetic','0000','B');"
  $Join="select public.join_room_by_code('RACE$Number');"
  $Invite="select public.create_room_invitation('$R','$H');"
  $Accept="select public.accept_room_invitation((select id from public.room_invitations where room_id='$R' and invitee_id='$H'));"
  switch ($Number) {
   44 {
    Race-Sql (User-Sql $B $StartBill) (User-Sql $C $Join) 'S4003'
    Assert-Sql "(select count(*)=2 from public.participants where room_id='$R')" 'new settlement before code join rejects the waiting unrelated user'
   }
   45 {
    Race-Sql (User-Sql $C $Join) (User-Sql $B $StartBill)
    Assert-Sql "(select count(*)=3 from public.dutch_pay_members m join public.dutch_pay_bills b on b.id=m.bill_id where b.room_id='$R')" 'code join before settlement is included in the receipt snapshot'
   }
   46 {
    Race-Sql (User-Sql $B $StartBill) (User-Sql $A $Invite) 'S4003'
    Assert-Sql "not exists(select 1 from public.room_invitations where room_id='$R')" 'new settlement before invite creation leaves no invitation'
   }
   47 {
    Invoke-S1Sql ("begin;"+(User-Sql $A $Invite)+'commit;') $Container | Out-Null
    Race-Sql (User-Sql $B $StartBill) (User-Sql $H $Accept) 'S4003'
    Assert-Sql "(select status='expired' and responded_at is not null from public.room_invitations where room_id='$R' and invitee_id='$H') and not exists(select 1 from public.participants where room_id='$R' and profile_id='$H')" 'new settlement expires pending invitation before the waiting acceptance and preserves membership'
   }
   48 {
    Race-Sql (User-Sql $A $Invite) (User-Sql $B $StartBill)
    Assert-Sql "(select stage='settling' from public.rooms where id='$R') and (select status='expired' and responded_at is not null from public.room_invitations where room_id='$R' and invitee_id='$H')" 'invite creation before settlement expires without granting membership'
   }
   49 {
    Invoke-S1Sql ("begin;"+(User-Sql $A $Invite)+'commit;') $Container | Out-Null
    Race-Sql (User-Sql $H $Accept) (User-Sql $B $StartBill)
    Assert-Sql "(select count(*)=3 from public.dutch_pay_members m join public.dutch_pay_bills b on b.id=m.bill_id where b.room_id='$R')" 'invitation acceptance before settlement is included in the receipt snapshot'
   }
  }
 }
 New-Room 21
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0)); update public.terms_versions set is_current=false where is_current;" (User-Sql $A (Select-Time)) 'S1006'
 Assert-Sql "(select stage='scheduling' from public.rooms where id='$R')" 'terms validity is rechecked after lock wait'
 Write-Output 'TOTAL S4 concurrent checks: 41 passed (31 observed blockers, 10 lock_timeout=500ms nonblocking reads/writes)'
} catch {
 Write-Output ("S4 concurrent failure: " + $_.Exception.Message)
 throw
} finally {
 $TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
 npx --yes supabase db reset --local --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'Final disposable reset failed' }
}

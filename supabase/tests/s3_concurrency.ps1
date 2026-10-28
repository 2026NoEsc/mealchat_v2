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
function Race-Sql([string]$First,[string]$Second,[string]$Expected='00000',[string]$BeforeCommit='',[switch]$NonBlocking,[string]$WhileBlocked='') {
    $Name = 's3_a_race_first'
    $WaiterName = 's3_a_race_waiter'
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
        if($WhileBlocked){Assert-Sql $WhileBlocked 'initial limiter FK takes no profile KEY SHARE before the room advisory lock'}
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

# Guard the exact CLI workdir before any test can reach its finally reset.
$TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
$Config=[System.IO.File]::ReadAllText((Join-Path $TaskLocal 'supabase/config.toml'))
if($Config -notmatch '(?m)^project_id\s*=\s*"mealchat_s1_a_20261017"\s*$' -or $Config -notmatch '(?ms)^\[db\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*55322\s*$'){throw 'Refuse non-isolated final reset'}
& (Join-Path $PSScriptRoot 's3_sql.ps1') -Container $Container
$A=$UserA; $B=$UserB; $C='10000003-0000-4000-8000-000000000003'
function New-TransferRoom([int]$Number,[switch]$Confirmed) {
 $script:R='35000000-0000-4000-8000-'+$Number.ToString('000000000000')
 $Seed="begin; insert into public.rooms(id,code,title,color,meeting_date,expires_at,owner_id,lifecycle_version,base_expires_at,hard_expires_at) values('$R',private.s3_random_code(),'Synthetic S3 race','#23A455',current_date+1,clock_timestamp()+interval '7 days','$A',1,clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days'); insert into public.participants(room_id,profile_id,name) values('$R','$B','Synthetic B');"
 if($Confirmed){$Seed+="update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id where id='$R';"}
 $Seed+="insert into private.s3_invite_codes(room_id,generation,code_digest,issued_at,expires_at) select id,1,private.s3_code_digest(code),created_at,expires_at from public.rooms where id='$R'; commit;"
 Invoke-S1Sql $Seed $Container | Out-Null
 $script:Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 $Request=User-Sql $A "select public.request_room_owner_transfer_v1('$R','$B',true,$Rev,gen_random_uuid());"
 Invoke-S1Sql ('begin;'+$Request+'commit;') $Container | Out-Null
 $script:Transfer=(Invoke-S1Sql "select id from private.s3_transfer_requests where room_id='$R' and status='pending';" $Container).Trim()
 $script:Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
}
function Accept-Transfer {return User-Sql $B "select public.respond_room_owner_transfer_v1('$Transfer',true,$Rev,gen_random_uuid());"}
function Cancel-Transfer {return User-Sql $A "select public.cancel_room_owner_transfer_v1('$Transfer',$Rev,gen_random_uuid());"}
function Decline-Transfer {return User-Sql $B "select public.respond_room_owner_transfer_v1('$Transfer',false,$Rev,gen_random_uuid());"}
function Leave-Target {return User-Sql $B "select public.leave_room_member_v1('$R',$Rev,gen_random_uuid());"}
function Close-Owner {return User-Sql $A "select public.close_room_v1('$R',$Rev,gen_random_uuid());"}
function Start-Settlement {return User-Sql $A "select public.create_room_settlement_v2('$R','Synthetic',2000,'Synthetic','0000','Synthetic');"}
function Prepare-Preview {
 Invoke-S1Sql "delete from private.s3_invite_limits where actor_id='$C';" $Container | Out-Null
 $Code=(Invoke-S1Sql "select code from public.rooms where id='$R';" $Container).Trim()
 Invoke-S1Sql ('begin;'+(User-Sql $C "select public.preview_room_invite_v1('$Code');")+'commit;') $Container | Out-Null
 $script:Preview=(Invoke-S1Sql "select id from private.s3_invite_previews where room_id='$R' and actor_id='$C' order by created_at desc limit 1;" $Container).Trim()
 if($Preview -notmatch '^[0-9a-f-]{36}$'){throw 'Synthetic preview fixture was not issued'}
}
function Join-Preview {return User-Sql $C "select public.join_room_invite_v1('$Preview',gen_random_uuid());"}
function Prepare-Payment {
 Invoke-S1Sql ('begin;'+(Start-Settlement)+'commit;') $Container | Out-Null
 $script:Member=(Invoke-S1Sql "select m.id from public.dutch_pay_members m join public.dutch_pay_bills b on b.id=m.bill_id where b.room_id='$R' and m.profile_id='$B';" $Container).Trim()
}
function Pay-Recipient {return User-Sql $B "select public.set_settlement_completed('$Member',true);"}
try {
 Invoke-S1Sql "begin; set local s1.tap='off';\i /tmp/s3_regression/s3_fixture.sql`ncommit;" $Container | Out-Null
 New-TransferRoom 1
 Race-Sql (Accept-Transfer) (Cancel-Transfer) '42501'
 Assert-Sql "(select owner_id='$B' from public.rooms where id='$R')" 'accept before cancel keeps new owner'
 New-TransferRoom 2
 Race-Sql (Cancel-Transfer) (Accept-Transfer) 'S4005'
 Assert-Sql "(select status='cancelled' from private.s3_transfer_requests where id='$Transfer')" 'cancel before accept is terminal'
 New-TransferRoom 3
 Race-Sql (Accept-Transfer) (Decline-Transfer) 'S4005'
 Assert-Sql "(select status='accepted' from private.s3_transfer_requests where id='$Transfer')" 'accept before decline is terminal'
 New-TransferRoom 4
 Race-Sql (Decline-Transfer) (Accept-Transfer) 'S4005'
 Assert-Sql "(select status='declined' from private.s3_transfer_requests where id='$Transfer')" 'decline before accept is terminal'
 New-TransferRoom 5
 Race-Sql (Leave-Target) (Accept-Transfer) '42501'
 Assert-Sql "(select status='expired' and terminal_reason='target_left' from private.s3_transfer_requests where id='$Transfer')" 'target leave expires pending before acceptance'
 New-TransferRoom 6
 Race-Sql (Accept-Transfer) (Leave-Target) 'S4005'
 Assert-Sql "(select owner_id='$B' from public.rooms where id='$R')" 'accepted owner cannot execute old ordinary-leave intent'
 New-TransferRoom 7
 Race-Sql (Close-Owner) (Accept-Transfer) '42501'
 Assert-Sql "not exists(select 1 from public.rooms where id='$R')" 'close before acceptance deletes room and pending'
 New-TransferRoom 8
 Race-Sql (Accept-Transfer) (Close-Owner) '42501'
 Assert-Sql "exists(select 1 from public.rooms where id='$R' and owner_id='$B')" 'old owner cannot close after transfer'
 New-TransferRoom 9 -Confirmed
 Race-Sql (Start-Settlement) (Accept-Transfer) 'S4005'
 Assert-Sql "(select status='expired' and terminal_reason='settlement_started' from private.s3_transfer_requests where id='$Transfer')" 'settlement before accept atomically expires transfer'
 New-TransferRoom 10 -Confirmed
 Race-Sql (Accept-Transfer) (Start-Settlement) '42501'
 Assert-Sql "not exists(select 1 from public.dutch_pay_bills where room_id='$R')" 'departed old owner cannot start settlement after transfer'
 New-TransferRoom 11
 Invoke-S1Sql "update private.s3_transfer_requests set expires_at=clock_timestamp()-interval '1 second' where id='$Transfer';" $Container | Out-Null
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0)); select private.s3_expire_transfers('$R','ttl');" (Accept-Transfer) 'S4005'
 Assert-Sql "(select status='expired' from private.s3_transfer_requests where id='$Transfer')" 'TTL cleanup before acceptance wins'
 New-TransferRoom 12
 Race-Sql (Accept-Transfer) 'select private.expire_owner_transfers_v1();' '00000' '' -NonBlocking
 Assert-Sql "(select status='accepted' from private.s3_transfer_requests where id='$Transfer')" 'worker cannot reverse an accepted transfer'
 New-TransferRoom 13
 # Both target requests use the same starting revision after cancelling the seed.
 Invoke-S1Sql ('begin;'+(Cancel-Transfer)+'commit;') $Container | Out-Null
 $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
 $Request=User-Sql $A "select public.request_room_owner_transfer_v1('$R','$B',false,$Rev,gen_random_uuid());"
 Race-Sql $Request $Request 'S4005'
 Assert-Sql "(select count(*)=1 from private.s3_transfer_requests where room_id='$R' and status='pending')" 'simultaneous requests have one pending winner'

 New-TransferRoom 14 -Confirmed
 Prepare-Preview
 Race-Sql (Start-Settlement) (Join-Preview)
 Assert-Sql "not exists(select 1 from public.participants where room_id='$R' and profile_id='$C')" 'settlement before code admission rejects waiting preview join'
 New-TransferRoom 15 -Confirmed
 Prepare-Preview
 Race-Sql (Join-Preview) (Start-Settlement)
 Assert-Sql "(select count(*)=3 from public.dutch_pay_members m join public.dutch_pay_bills b on b.id=m.bill_id where b.room_id='$R')" 'preview join before settlement is included in fixed recipients'
 New-TransferRoom 16
 Prepare-Preview
 Invoke-S1Sql "update private.s3_invite_codes set issued_at=issued_at-interval '2 minutes',expires_at=expires_at-interval '2 minutes' where room_id='$R';" $Container | Out-Null
 $Rotate=User-Sql $A "select public.rotate_room_invite_code_v1('$R',$Rev,gen_random_uuid());"
 Race-Sql $Rotate (Join-Preview)
 Assert-Sql "not exists(select 1 from public.participants where room_id='$R' and profile_id='$C')" 'rotation before admission invalidates old preview generation'
 New-TransferRoom 17
 Prepare-Preview
 Invoke-S1Sql "update private.s3_invite_codes set issued_at=issued_at-interval '2 minutes',expires_at=expires_at-interval '2 minutes' where room_id='$R';" $Container | Out-Null
 $Rotate=User-Sql $A "select public.rotate_room_invite_code_v1('$R',$Rev,gen_random_uuid());"
 Race-Sql (Join-Preview) $Rotate 'S4005'
 Assert-Sql "exists(select 1 from public.participants where room_id='$R' and profile_id='$C') and (select max(generation)=1 from private.s3_invite_codes where room_id='$R')" 'admission before rotation preserves member and rejects stale rotation'
 New-TransferRoom 18 -Confirmed
 Prepare-Payment
 Invoke-S1Sql "update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='$R';" $Container | Out-Null
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0)); select private.cleanup_expired_rooms_v1();" (Pay-Recipient)
 Assert-Sql "not exists(select 1 from public.rooms where id='$R') and (select is_completed from public.dutch_pay_members where id='$Member')" 'expiry deletion before payment preserves detached recipient completion'
 New-TransferRoom 19 -Confirmed
 Prepare-Payment
 Invoke-S1Sql "update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='$R';" $Container | Out-Null
 Race-Sql (Pay-Recipient) 'select private.cleanup_expired_rooms_v1();' '00000' '' -NonBlocking
 Assert-Sql "(select expires_at<=clock_timestamp() from public.rooms where id='$R') and (select is_completed from public.dutch_pay_members where id='$Member')" 'late payment before cleanup never revives room and worker skips held lock'
 Invoke-S1Sql 'select private.cleanup_expired_rooms_v1();' $Container | Out-Null
 Assert-Sql "not exists(select 1 from public.rooms where id='$R')" 'next worker call collects previously skipped room'
 New-TransferRoom 20 -Confirmed
 Prepare-Payment
 Invoke-S1Sql ('begin;'+(Pay-Recipient)+'commit;') $Container | Out-Null
 Invoke-S1Sql "update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='$R';" $Container | Out-Null
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0)); select private.cleanup_expired_rooms_v1();" (Start-Settlement) '42501'
 Assert-Sql "not exists(select 1 from public.rooms where id='$R')" 'expiry deletion before restart makes old room unavailable'
 New-TransferRoom 21 -Confirmed
 Prepare-Payment
 Invoke-S1Sql ('begin;'+(Pay-Recipient)+'commit;') $Container | Out-Null
 Invoke-S1Sql "update public.rooms set expires_at=clock_timestamp()+interval '5 seconds' where id='$R';" $Container | Out-Null
 Race-Sql ((Start-Settlement)+" select pg_sleep(6);") 'select private.cleanup_expired_rooms_v1();' '00000' '' -NonBlocking
 Assert-Sql "(select stage='settling' and expires_at>clock_timestamp() from public.rooms where id='$R')" 'restart before old deadline cleanup keeps the extended live room'

 # A departing sole attendee must not allow stale legacy confirmation, even
 # when the smaller remaining electorate would meet its vote majority.
 foreach($Number in @(22,23)) {
  New-TransferRoom $Number
  Invoke-S1Sql ('begin;'+(Cancel-Transfer)+'commit;') $Container | Out-Null
  $Day="to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')"
  $Item='95000000-0000-4000-8000-'+$Number.ToString('000000000000')
  Invoke-S1Sql "update public.rooms set stage='place',meeting_starts_at=(($Day)||'T11:00:00+09:00')::timestamptz,meeting_ends_at=(($Day)||'T12:00:00+09:00')::timestamptz,meeting_time_zone='Asia/Seoul',voting_items=jsonb_build_array(jsonb_build_object('id','$Item','kind','menu','label','Synthetic')) where id='$R'; update public.participants set voted_items=jsonb_build_array('$Item'::text),schedule=case when profile_id='$B' then jsonb_build_object('slots',jsonb_build_array(($Day)||'-11')) else '{}'::jsonb end where room_id='$R';" $Container | Out-Null
  $Rev=(Invoke-S1Sql "select s4_revision from public.rooms where id='$R';" $Container).Trim()
  $Confirm=User-Sql $A "select public.confirm_room_vote('$R','$Item');"
  if($Number -eq 22){
   Race-Sql (Leave-Target) $Confirm 'S4006'
   Assert-Sql "(select stage='place' and appointment_confirmed_at is null from public.rooms where id='$R')" 'sole attendee leave before legacy confirmation prevents zero-attendee decision'
  } else {
   Race-Sql $Confirm (Leave-Target) 'S4005'
   Assert-Sql "(select stage='confirmed' and appointment_confirmed_at is not null from public.rooms where id='$R')" 'confirmation before departure records evidence and invalidates stale leave intent'
  }
 }

 # First limiter INSERT must not acquire FK KEY SHARE before waiting for the
 # room advisory. The holder also owns the actor profile lock; inspect live
 # relation locks to distinguish the deferred FK path from a hidden inversion.
 New-TransferRoom 24
 Prepare-Preview
 Invoke-S1Sql "delete from private.s3_invite_limits where actor_id='$C';" $Container | Out-Null
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0)); select id from public.profiles where id='$C' for update;" (Join-Preview) -WhileBlocked "not exists(select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='s3_a_race_waiter' and l.relation='public.profiles'::regclass and l.mode='RowShareLock')"
 Assert-Sql "exists(select 1 from public.participants where room_id='$R' and profile_id='$C')" 'initial limiter join commits after room then profile acquisition'

 # Rehearse the real held D8 statements against a synthetic legacy row. A writer
 # holding its advisory must cause a fast, atomic abort despite the table lock.
 New-TransferRoom 25
 Invoke-S1Sql "update public.rooms set lifecycle_version=null where id='$R';" $Container | Out-Null
 $Activation=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../release/s3_activate_lifecycle.sql'))
 $D8=$Activation.Substring($Activation.IndexOf('-- D8:'),$Activation.IndexOf('create trigger s3_expiry_guard')-$Activation.IndexOf('-- D8:'))
 $D8Setup="select set_config('mealchat.s3.expected_inventory',private.s3_inventory_counts()::text,true); select set_config('mealchat.s3.transition_at',private.s4_iso(clock_timestamp()+interval '1 day'),true);"
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$R',0));" ($D8Setup+$D8) 'P0001' '' -NonBlocking
 Assert-Sql "(select lifecycle_version is null from public.rooms where id='$R')" 'busy D8 advisory abort leaves the legacy row unchanged'
 # Trusted legacy INSERT uses the same RowExclusive table lock as the old app.
 # Old authenticated grants are independently checked as revoked by release gate.
 $Legacy="insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('35000000-0000-4000-8000-000000000026',private.s3_random_code(),'Synthetic legacy writer',current_date+1,clock_timestamp()+interval '7 days','$A');"
 Race-Sql 'lock table public.rooms in share row exclusive mode;' $Legacy
 Assert-Sql "exists(select 1 from public.rooms where id='35000000-0000-4000-8000-000000000026')" 'legacy INSERT waits for the D8 table lock before creating a row'

 # Twenty real sessions share one actor lock. A fifth failure commits the lock;
 # the remaining fifteen requests cannot create more failure counter increments.
 $Jobs=@()
 try {
  Invoke-S1Sql "delete from private.s3_invite_limits where actor_id='$C';" $Container | Out-Null
  1..20 | ForEach-Object {
   $Query='begin;'+(User-Sql $C "select public.preview_room_invite_v1('ZZZZZZ')->>'reason';")+'commit;'
   $Jobs+=Start-Job -ArgumentList $DockerExe,$Container,$Query -ScriptBlock {
    param($Exe,$Target,$Sql)
    $OutputEncoding=[System.Text.UTF8Encoding]::new($false)
    $Result=@($Sql | & $Exe exec -i $Target psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f - 2>&1)
    if($LASTEXITCODE -ne 0){throw 'Parallel limiter session failed'}
    return $Result | Where-Object {$_ -match '^INVITE_(UNAVAILABLE|RATE_LIMITED)$'}
   }
  }
  $Out=@($Jobs | Receive-Job -Wait -ErrorAction Stop)
  if(@($Out | Where-Object {$_ -eq 'INVITE_UNAVAILABLE'}).Count -ne 4 -or @($Out | Where-Object {$_ -eq 'INVITE_RATE_LIMITED'}).Count -ne 16){throw 'Parallel limiter exceeded actor allowance'}
  Assert-Sql "(select failure_count=5 from private.s3_invite_limits where actor_id='$C')" 'twenty parallel attempts commit exactly five failures'
 } finally {foreach($Job in $Jobs){if($Job.State -eq 'Running'){Stop-Job $Job}; Remove-Job $Job -Force}}
 Write-Output 'TOTAL S3 concurrency: 29 state assertions; 26 races (22 observed blockers, three nonblocking workers, one busy D8 abort), 20 parallel actor requests'
} finally {
 npx --yes supabase db reset --local --workdir $TaskLocal
 if($LASTEXITCODE -ne 0){throw 'Final isolated S3 concurrency reset failed'}
}


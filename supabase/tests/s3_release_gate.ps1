param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$Release=[IO.File]::ReadAllText((Join-Path $PSScriptRoot '../release/s3_activate_lifecycle.sql'))
$Denied=Invoke-S1Sql $Release $Container -AllowFailure
if($Denied.Code -eq 0 -or $Denied.Text -notmatch 'S3_BETA_EVIDENCE_REQUIRED'){throw 'Missing beta evidence admitted'}
Write-Output 'ok - missing beta evidence rejects full held activation'
$Body=[regex]::Replace($Release,'(?m)^(begin|commit);\s*$','')
$StartCleanup=[regex]::Replace([IO.File]::ReadAllText((Join-Path $PSScriptRoot '../release/s3_start_cleanup.sql')),'(?m)^(begin|commit);\s*$','')
# Synthetic beta references; actual cron success observations remain mandatory.
$Setup=@'
begin;
select set_config('mealchat.s3.beta_artifact_sha256',repeat('a',64),true);
set local mealchat.s3.beta_version='1';
select set_config('mealchat.s3.transition_at',private.s4_iso(clock_timestamp()+interval '1 day'),true);
select set_config('mealchat.s3.scheduler_observed_after',private.s4_iso(clock_timestamp()-interval '1 day'),true);
select set_config('mealchat.s3.expected_inventory',private.s3_inventory_counts()::text,true);
'@
$Verify=@'
do $$ begin
 if (select enabled or activated_at is null from private.s3_worker_control where singleton)
  or to_regprocedure('public.get_s3_capabilities()') is null
  or has_any_column_privilege('authenticated','public.rooms','INSERT')
  or has_function_privilege('authenticated','public.post_room_system_message(uuid,text)','EXECUTE')
 then raise exception 'S3_FULL_GATE_ASSERTION_FAILED'; end if;
end; $$;
select 'ok - actual scheduler evidence admits activation with cleanup OFF';
'@
$MissingReceipt=Invoke-S1Sql (($Setup,$Body,$StartCleanup) -join [Environment]::NewLine) $Container -AllowFailure
if($MissingReceipt.Code -eq 0 -or $MissingReceipt.Text -notmatch 'S3_CLEANUP_ACTIVATION_APPROVAL_REQUIRED'){throw "Cleanup receipt probe failed at another boundary: $($MissingReceipt.Text)"}
Write-Output 'ok - cleanup start rejects missing activation receipt'
$Approve=@'
select set_config('mealchat.s3.cleanup_approved_activation',private.s4_iso(activated_at),true) from private.s3_worker_control where singleton;
'@
$Restore=@'
do $$ begin
 if not (select enabled from private.s3_worker_control where singleton) then raise exception 'S3_START_NOT_ENABLED'; end if;
end; $$;
select 'ok - explicit cleanup start enables the activated receipt';
rollback;
select case when to_regprocedure('public.get_s3_capabilities()') is null
 and not (select enabled from private.s3_worker_control where singleton)
 and has_function_privilege('authenticated','public.post_room_system_message(uuid,text)','EXECUTE')
 and has_any_column_privilege('authenticated','public.rooms','INSERT')
 then 'ok - rollback restores held capability, OFF cleanup and legacy grants'
 else 'not ok - activation rollback failed' end;
'@
$Result=Invoke-S1Sql (($Setup,$Body,$Verify,$Approve,$StartCleanup,$Restore) -join [Environment]::NewLine) $Container
$Checks=@($Result -split '\r?\n' | Where-Object {$_ -match '^ok - '})
if($Checks.Count -ne 3){throw 'Full gate assertions incomplete'}
$Checks | Write-Output
# The expected counts are an operator input, not hidden self-approval in release.
$Wrong=$Setup+[Environment]::NewLine+"set local mealchat.s3.expected_inventory='{}';"+[Environment]::NewLine+$Body
$Mismatch=Invoke-S1Sql $Wrong $Container -AllowFailure
if($Mismatch.Code -eq 0 -or $Mismatch.Text -notmatch 'S3_INVENTORY_COUNT_MISMATCH'){throw 'Mismatched Q1 inventory admitted'}
Write-Output 'ok - mismatched expected Q1 counts stop before shortening or grants'
foreach($Missing in @('invalid_code_rooms','duplicate_normalized_code_rooms','both')) {
 $Remove=if($Missing -eq 'both'){"-'invalid_code_rooms'-'duplicate_normalized_code_rooms'"}else{"-'$Missing'"}
 $OldKeys=$Setup+[Environment]::NewLine+"select set_config('mealchat.s3.expected_inventory',(private.s3_inventory_counts()$Remove)::text,true);"+[Environment]::NewLine+$Body
 $Incomplete=Invoke-S1Sql $OldKeys $Container -AllowFailure
 if($Incomplete.Code -eq 0 -or $Incomplete.Text -notmatch 'S3_INVENTORY_COUNT_MISMATCH'){throw "Incomplete code inventory admitted: $Missing"}
 Write-Output "ok - missing code inventory keys rejected: $Missing"
}
& (Join-Path $PSScriptRoot 's4_sql.ps1') -Container $Container
if($LASTEXITCODE -ne 0){throw 'Pre-activation S4 suite failed'}
# EXACT failures in unchanged historical suites. Missing expected failures,
# new not-ok labels and any psql error all fail this release gate.
$Expected=@{
 # Direct INSERT is revoked; consequently that old fixture has no bootstrap row.
 's4_security.sql'=@('legacy draft room create remains supported','new-room bootstrap leaves revision zero')
 's4_final_review.sql'=@('settling denies unrelated code join','done denies unrelated code join','finite expiry permits cleanup while settlement remains open','open bill is detached and preserved without changing payment disclosure')
 # Legacy cleanup is now a no-op; room deletion and bill detachment use cron.
 's4_restart.sql'=@('cleanup deletes the room once the new completion deadline passes','final cleanup preserves closed settlement history without account contents')
}
$ExpectedTotals=@(16,84,40,42,12,30,20,45,48,29,40,26,16,55)
$SuiteNumber=0
$Unexpected=@(); $PostPassed=0; $ExpectedFailures=0
foreach($Name in @('s4_decisions.sql','s4_security.sql','s4_boundaries.sql','s4_voting_atomicity.sql','s4_quorum.sql','s4_review.sql','s4_request_limits.sql','s4_followup.sql','s4_preview.sql','s4_restart.sql','s4_final_review.sql','s4_amount_revocation.sql','s4_invitation_cleanup.sql','s4_paid_settlement_lock.sql')) {
 $Suite=[IO.File]::ReadAllText((Join-Path $PSScriptRoot $Name))
 $Suite=[regex]::Replace($Suite,'(?m)^begin;\s*$','')
 $Suite=$Suite -replace '(?m)^\\ir ([a-z0-9_]+\.sql)\s*$', '\i /tmp/s4_regression/$1'
 $Post=Invoke-S1Sql (($Setup,$Body,$Suite) -join [Environment]::NewLine) $Container -AllowFailure
 if($Post.Code -ne 0){throw "Post-activation S4 SQL error in $Name : $($Post.Text)"}
 $Failed=@($Post.Text -split '\r?\n' | Where-Object {$_ -match '^not ok\b'} | ForEach-Object {$_ -replace '^not ok\s+[0-9]+\s+-\s*',''})
 $Allowed=@(); if($Expected.ContainsKey($Name)){$Allowed=@($Expected[$Name])}
 foreach($Label in $Failed){if($Label -notin $Allowed){$Unexpected+="$Name : $Label"}}
 foreach($Label in $Allowed){if($Label -notin $Failed){$Unexpected+="Expected failure missing: $Name : $Label"}}
 $Passed=@($Post.Text -split '\r?\n' | Where-Object {$_ -match '^ok\b'}).Count
 if($Passed+$Failed.Count -ne $ExpectedTotals[$SuiteNumber]){throw "Incomplete post-activation suite: $Name"}
 $SuiteNumber++
 $PostPassed+=$Passed; $ExpectedFailures+=$Failed.Count
 Write-Output "POST S4 $Name : $Passed passed / $($Failed.Count) expected-contract candidates"
}
if($Unexpected.Count -gt 0){throw ($Unexpected -join [Environment]::NewLine)}
Write-Output "TOTAL S3 release gate: 9 passed; post-activation S4 $PostPassed passed / $ExpectedFailures exact expected legacy failures (all rolled back)"

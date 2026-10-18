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
function Race-Sql([string]$First,[string]$Second,[string]$Expected='00000') {
    $Name = 's1_a_race_first'
    $FirstSql = "set application_name='$Name'; begin; set local statement_timeout='15s'; $First select pg_sleep(1.5); commit;"
    $Job = Start-Job -ArgumentList $DockerExe,$Container,$FirstSql -ScriptBlock {
        param($Exe,$DbContainer,$Sql)
        $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $Output = @($Sql | & $Exe exec -i $DbContainer psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f - 2>&1)
        if ($LASTEXITCODE -ne 0) { throw ($Output -join [Environment]::NewLine) }
        return $Output
    }
    try {
        $Ready = $false
        for ($Try=0; $Try -lt 80; $Try++) {
            $Active = Invoke-S1Sql "select exists(select 1 from pg_stat_activity where application_name='$Name' and wait_event='PgSleep');" $Container
            if ($Active.Trim() -eq 't') { $Ready=$true; break }
            if ($Job.State -eq 'Failed') { Receive-Job $Job -Wait -ErrorAction Stop | Out-Null }
            Start-Sleep -Milliseconds 100
        }
        if (-not $Ready) { throw 'First connection did not reach the lock-held synchronization point' }
        # Invoker wrapper records the expected SQLSTATE without printing payloads.
        $Wrapper = 'create function pg_temp.state_of(command text) returns text language plpgsql as $$ begin execute command; return ''00000''; exception when others then return sqlstate; end; $$;'
        $SecondSql = "begin; set local statement_timeout='15s'; $Wrapper select pg_temp.state_of(`$race`$$Second`$race`$); commit;"
        $Result = Invoke-S1Sql $SecondSql $Container
        if ($Result -notmatch "(?m)^$Expected\s*$") { throw "Unexpected waiter outcome; expected $Expected" }
        Receive-Job $Job -Wait -ErrorAction Stop | Out-Null
    } finally {
        if ($Job.State -eq 'Running') { Stop-Job $Job }
        Remove-Job $Job -Force
    }
}
function Assert-Sql([string]$Expression,[string]$Label) {
    $Value = Invoke-S1Sql "select ($Expression);" $Container
    if ($Value.Trim() -ne 't') { throw "Concurrency assertion failed: $Label" }
    Write-Output "ok - $Label"
}
$Fixture = Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_fixture.sql')
try {
    Invoke-S1Sql ("begin; set local s1.tap='off';" + $Fixture + 'commit;') $Container | Out-Null
    Invoke-S1Sql ("begin;" + (User-Sql $UserA ((Grant-Health 0) + "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],0,1);")) + 'commit;') $Container | Out-Null
    $Save = User-Sql $UserA "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],1,1);"
    $Withdraw = User-Sql $UserA "select public.set_optional_consent(gen_random_uuid(),'health','withdraw',null,null,null,'settings');"
    Race-Sql $Save $Withdraw
    Assert-Sql "not exists(select 1 from public.profile_health_preferences where profile_id='$UserA') and exists(select 1 from public.profile_consent_states where profile_id='$UserA' and kind='health' and status='withdrawn')" 'save before withdrawal linearizes to deleted withdrawn state'
    Invoke-S1Sql ("begin;" + (User-Sql $UserA ((Grant-Health 2) + "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],0,3);")) + 'commit;') $Container | Out-Null
    Race-Sql $Withdraw (User-Sql $UserA "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],1,3);") 'S1003'
    Assert-Sql "not exists(select 1 from public.profile_health_preferences where profile_id='$UserA')" 'withdrawal before save prevents stale write'
    $Marketing = User-Sql $UserA "select public.set_optional_consent('44000000-0000-4000-8000-000000000001','marketing','grant',(public.get_consent_manifest()->'documents'->'marketing'->>'version'),(public.get_consent_manifest()->'documents'->'marketing'->>'content_hash'),0,'settings');"
    Race-Sql $Marketing $Marketing
    Assert-Sql "(select count(*) from public.profile_consents where profile_id='$UserA' and kind='marketing')=1" 'concurrent identical request creates exactly one event'
    Race-Sql (User-Sql $UserA "select public.set_profile_visibility('bio','public',0);") (User-Sql $UserA "select public.set_profile_visibility('gender','public',0);") 'S1004'
    Assert-Sql "(select privacy_revision=1 and privacy_settings->>'gender'='private' from public.profile_private where id='$UserA')" 'concurrent stale visibility cannot overwrite committed change'
    Invoke-S1Sql ("begin;" + (User-Sql $UserA ((Grant-Health 4) + "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],0,5);")) + 'commit;') $Container | Out-Null
    $ExpiryFixture = Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_fixture_tools.sql')
    Invoke-S1Sql ($ExpiryFixture + "select pg_temp.set_health_expiry('$UserA',clock_timestamp()-interval '1 second');") $Container | Out-Null
    Race-Sql (User-Sql $UserA ((Grant-Health 5) + "select public.save_my_health_preferences(array['test_allergy'],array[]::text[],0,6);")) 'set local role service_role; select public.run_s1_health_retention();'
    Assert-Sql "exists(select 1 from public.profile_health_preferences h join public.profile_consent_states s on s.profile_id=h.profile_id and s.kind='health' and s.granted_event_id=h.consent_event_id where h.profile_id='$UserA' and s.status='granted' and s.revision=6)" 'batch rechecks after lock and preserves a fresh grant payload'
    $Bill = (Invoke-S1Sql "select id from public.dutch_pay_bills where room_id='$Room';" $Container).Trim()
    $AccountUpdate = User-Sql $UserA "select public.create_room_settlement_v2('$Room','Synthetic account update',7000,'Synthetic bank','1111111111','Synthetic A');"
    $FinishUpdate = User-Sql $UserA "select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id='$Bill';"
    Race-Sql $AccountUpdate $FinishUpdate
    Assert-Sql "(select payment_disclosure_closed_at is not null and bank_name='' and account_number='' and account_holder='' from public.dutch_pay_bills where id='$Bill')" 'account update before completion cannot survive the completion commit'
    Invoke-S1Sql ("begin;" + (User-Sql $UserA "select public.create_room_settlement_v2('$Room','Synthetic finalization race',3000,'Synthetic bank','2222','Synthetic A');") + 'commit;') $Container | Out-Null
    $Bill = (Invoke-S1Sql "select id from public.dutch_pay_bills where room_id='$Room' and payment_disclosure_closed_at is null;" $Container).Trim()
    $FinishUpdate = User-Sql $UserA "select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id='$Bill';"
    $Undo = User-Sql $UserB "select public.set_settlement_completed(id,false) from public.dutch_pay_members where bill_id='$Bill' and profile_id='$UserB';"
    Race-Sql $FinishUpdate $Undo 'S1005'
    Assert-Sql "exists(select 1 from public.dutch_pay_bills where id='$Bill' and payment_disclosure_closed_at is not null) and not exists(select 1 from public.dutch_pay_members where bill_id='$Bill' and is_completed is not true)" 'completion before waiting undo returns S1005 and leaves no incomplete closed recipient'
    Invoke-S1Sql ("begin;" + (User-Sql $UserA "select public.create_room_settlement_v2('20000000-0000-4000-8000-000000000002','Synthetic reader race',2000,'Synthetic bank','0000000000','Synthetic A');") + 'commit;') $Container | Out-Null
    $Bill = (Invoke-S1Sql "select id from public.dutch_pay_bills where room_id='20000000-0000-4000-8000-000000000002';" $Container).Trim()
    $Complete = User-Sql $UserA "select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id='$Bill';"
    $Read = User-Sql $UserB "do `$check`$ begin if public.get_settlement_payment_details('$Bill')->>'status'<>'completed' then raise exception 'ACCOUNT_LEAK'; end if; end; `$check`$;"
    Race-Sql $Complete $Read
    Assert-Sql "(select payment_disclosure_closed_at is not null and bank_name='' and account_number='' and account_holder='' from public.dutch_pay_bills where id='$Bill')" 'account reader waits for completion and sees no account'
} finally {
    # Disposable local database only: remove committed fixtures and restore M1-M6 plus the local-dev seed.
    $TaskLocal = Join-Path $env:TEMP 'mealchat-s1-a-20261017'
    npx --yes supabase db reset --local --workdir $TaskLocal
    if ($LASTEXITCODE -ne 0) { throw 'Disposable fixture cleanup reset failed' }
}

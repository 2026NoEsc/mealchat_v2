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
    $Name = 's5_a_race_first'
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
$Food = "select public.save_my_food_preferences_v2('s5-food-2026-10-18-v1','{""cuisines"":[""korean""],""ingredients"":[],""forms"":[],""spice"":null}',0);"
$Health = "select public.save_my_health_preferences_v2('s5-food-2026-10-18-v1',array['egg','milk_dairy'],array['raw_fish'],'pescatarian',array['exclude_pork'],0,1);"
$Withdraw = User-Sql $UserA "select public.set_optional_consent(gen_random_uuid(),'health','withdraw',null,null,null,'settings');"
try {
 Invoke-S1Sql ("begin; set local s1.tap='off';"+$Fixture+'commit;') $Container | Out-Null
 Race-Sql (User-Sql $UserA $Food) (User-Sql $UserA $Food) 'S1004'
 Assert-Sql "(select revision=1 and schema_version=2 from public.profile_food_preferences where profile_id='$UserA')" 'two food writers preserve one CAS winner'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA (Grant-Health 0))+'commit;') $Container | Out-Null
 Race-Sql (User-Sql $UserA $Health) $Withdraw
 Assert-Sql "not exists(select 1 from public.profile_health_preferences where profile_id='$UserA')" 'v2 save then withdrawal removes every health field'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA (Grant-Health 2))+'commit;') $Container | Out-Null
 Race-Sql $Withdraw (User-Sql $UserA ($Health.Replace(',0,1);',',0,3);'))) 'S1003'
 Assert-Sql "not exists(select 1 from public.profile_health_preferences where profile_id='$UserA')" 'v2 withdrawal then save rejects stale grant'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA (Grant-Health 4))+'commit;') $Container | Out-Null
 $Tools=Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_fixture_tools.sql')
 Invoke-S1Sql ($Tools+"select pg_temp.set_health_expiry('$UserA',clock_timestamp()+interval '1 second');") $Container | Out-Null
 Race-Sql "select 1 from public.profiles where id='$UserA' for update;" (User-Sql $UserA ($Health.Replace(',0,1);',',0,5);'))) 'S1003'
 Assert-Sql "not exists(select 1 from public.profile_health_preferences where profile_id='$UserA')" 'health expiry is rechecked after profile lock wait'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA "select public.set_room_recommendation_area_v2('$Room','local-dev-seoul-center',0);")+'commit;') $Container | Out-Null
 $Request='61000000-0000-4000-8000-000000000001'
 $Begin=User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');"
 Race-Sql $Begin $Begin
 Assert-Sql "(select count(*)=1 from private.recommendation_requests where request_id='$Request')" 'concurrent begin is idempotent'
 $Work=(Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$Request')->>'work_token'; commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 if (@($Work).Count -ne 1) { throw 'Expected one work token' }
 $Finalize="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('$Request','$Work','{""places"":[]}','[]','rules');"
 Race-Sql (User-Sql $UserA "select public.save_my_food_preferences_v2('s5-food-2026-10-18-v1','{}',1);") $Finalize 'S5003'
 Assert-Sql "(select status<>'complete' from private.recommendation_requests where request_id='$Request')" 'food update before waiting finalize rejects stale result'
 $Request='61000000-0000-4000-8000-000000000002'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');")+'commit;') $Container | Out-Null
 $Claim="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$Request');"
 Race-Sql $Claim $Claim '42501'
 Assert-Sql "(select status='working' and work_token is not null from private.recommendation_requests where request_id='$Request')" 'worker claim race preserves single working ticket'


 Race-Sql (User-Sql $UserB "select public.mark_food_profile_prompt_v2('shown',0);") (User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');")
 Assert-Sql "(select status='working' from private.recommendation_requests where request_id='$Request')" 'shown while another member waits preserves working recommendation'
 $Request='61000000-0000-4000-8000-000000000003'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');")+'commit;') $Container | Out-Null
 $Work=(Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$Request')->>'work_token'; commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 $Finalize="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('$Request','$Work','{""places"":[]}','[]','rules');"
 Race-Sql (User-Sql $UserA "select public.set_room_recommendation_area_v2('$Room','local-dev-seoul-center',1);") $Finalize 'S5003'
 Assert-Sql "(select status<>'complete' from private.recommendation_requests where request_id='$Request')" 'area update before waiting finalize rejects stale result'

 $ReadRequest='61000000-0000-4000-8000-000000000006'
 Invoke-S1Sql ("begin;"+(User-Sql $UserB "select public.begin_room_recommendation_v2('$Room','$ReadRequest','places');")+'commit;') $Container | Out-Null
 $ReadToken=(Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$ReadRequest')->>'work_token'; commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('$ReadRequest','$ReadToken','{""places"":[]}','[]','rules'); commit;" $Container | Out-Null
 Race-Sql "select pg_advisory_xact_lock(hashtextextended('$Room',0)); select 1 from public.rooms where id='$Room' for update; select 1 from public.profiles where id='$UserA' for update;" (User-Sql $UserB "set local lock_timeout='200ms'; select public.validate_my_recommendation_v2('$ReadRequest');")
 Assert-Sql "(select status='complete' from private.recommendation_requests where request_id='$ReadRequest')" 'read validation never waits for room advisory or profile row locks'
 $Request='61000000-0000-4000-8000-000000000004'
 Invoke-S1Sql ("begin;"+(User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');")+'commit;') $Container | Out-Null
 $Work=(Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$Request')->>'work_token'; commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 $Finalize="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('$Request','$Work','{""places"":[]}','[]','rules');"
 Race-Sql "delete from public.participants where room_id='$Room' and profile_id='$UserB';" $Finalize 'S5003'
 Assert-Sql "(select status<>'complete' from private.recommendation_requests where request_id='$Request')" 'member removal before waiting finalize rejects stale result'
 $Request='61000000-0000-4000-8000-000000000005'
 Invoke-S1Sql ("begin;"+(User-Sql $UserB "select public.set_room_recommendation_area_v2('20000000-0000-4000-8000-000000000002','local-dev-seoul-center',0);")+'commit;') $Container | Out-Null
 Race-Sql (User-Sql $UserA "select public.begin_room_recommendation_v2('$Room','$Request','places');") (User-Sql $UserA "select public.begin_room_recommendation_v2('20000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000007','places');") 'S5005'
 Assert-Sql "(select count(*)=5 from private.recommendation_usage where caller_id='$UserA')" 'different rooms serialize on caller and cannot race past account budget'
 $Work=(Invoke-S1Sql "begin; set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.claim_recommendation_work_v2('$Request')->>'work_token'; commit;" $Container) -split "\r?\n" | Where-Object { $_ -match '^[a-f0-9-]{36}$' }
 $Finalize="set local role service_role; select set_config('request.jwt.claims','{""role"":""service_role""}',true); select public.finalize_recommendation_work_v2('$Request','$Work','{""places"":[]}','[]','rules');"
 Race-Sql "update public.terms_versions set is_current=false where is_current;" $Finalize 'S1006'
 Assert-Sql "(select status<>'complete' from private.recommendation_requests where request_id='$Request')" 'bundle deactivation before waiting finalize fails closed'
} finally {
 $TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
 npx --yes supabase db reset --local --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'Final disposable reset failed' }
}

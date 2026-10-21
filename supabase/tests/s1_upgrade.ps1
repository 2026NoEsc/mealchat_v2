param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$TaskLocal = Join-Path $env:TEMP 'mealchat-s1-a-20261017'
if (-not (Test-Path -LiteralPath (Join-Path $TaskLocal 'supabase/config.toml'))) { throw 'Prepare the disposable local CLI workdir first' }
$MigrationDir = Join-Path $PSScriptRoot '../migrations'
Copy-Item -LiteralPath (Get-ChildItem -LiteralPath $MigrationDir -Filter '*.sql').FullName -Destination (Join-Path $TaskLocal 'supabase/migrations')
node (Join-Path $PSScriptRoot 's1_m7_local.mjs') --prepare
if ($LASTEXITCODE -ne 0) { throw 'M7 test copy preparation failed' }
npx --yes supabase db reset --local --no-seed --version 20260921120000 --workdir $TaskLocal
if ($LASTEXITCODE -ne 0) { throw 'Pre-S1 local reset failed' }
try {
    $Original = Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot '20260823_rpc_hardening.sql')
    $OriginalBefore = Invoke-S1Sql $Original $Container
    if ($OriginalBefore -notmatch '(?m)^1\.\.70\s*$') { throw 'Original RPC suite did not run all 70 checks' }
    Write-Output 'ok - original RPC history passes 70/70 before standalone hotfix'
    $RealtimeBefore = Invoke-S1Sql "select md5(pg_get_functiondef('realtime.apply_rls(jsonb,integer)'::regprocedure));" $Container
    Invoke-S1Sql (Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_upgrade.sql')) $Container | Out-Null
    # The hotfix requires no S1 objects. Its intentional historical ACL difference is tested.
    Invoke-S1Sql (Get-Content -Encoding utf8 -Raw (Join-Path $MigrationDir '20261017085900_revoke_invite_friend_to_room.sql')) $Container | Out-Null
    $Acl = Invoke-S1Sql "select not has_function_privilege('authenticated','public.invite_friend_to_room(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','public.invite_friend_to_room(uuid,uuid)','EXECUTE') and to_regclass('public.consent_documents') is null;" $Container
    if ($Acl.Trim() -ne 't') { throw 'Standalone pre-S1 hotfix failed' }
    Write-Output 'ok - standalone invitation revocation applies without S1 objects'
    $OriginalAfter = Invoke-S1Sql $Original $Container -AllowFailure
    $ExpectedLegacyFailure = @($OriginalAfter.Text -split "`n" | Where-Object { $_ -match '^not ok' })
    if ($OriginalAfter.Code -ne 0 -or $OriginalAfter.Text -notmatch '(?m)^1\.\.70\s*$' -or $ExpectedLegacyFailure.Count -ne 1 -or $ExpectedLegacyFailure[0] -notmatch 'legacy forced-invite, settlement-v1, and generic-system RPCs') { throw 'Unexpected original-suite result after hotfix' }
    Write-Output 'ok - original RPC history has exactly its obsolete forced-invite grant failure (69/70) after standalone hotfix'
    $M1 = Get-Content -Encoding utf8 -Raw (Join-Path $MigrationDir '20261017090000_s1_consent_documents.sql')
    $Fingerprint = Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_schema_fingerprint.sql')
    function Assert-Preflight {
        param([string]$Label,[string]$Expected='S1_UPGRADE_PERSONAL_DATA_MAPPING_REQUIRED')
        $Before = Invoke-S1Sql $Fingerprint $Container
        $Blocked = Invoke-S1Sql $M1 $Container -AllowFailure
        $After = Invoke-S1Sql $Fingerprint $Container
        if ($Blocked.Code -eq 0 -or $Blocked.Text -notmatch $Expected -or $Before -ne $After) { throw "Preflight failed or mutated schema/ACL: $Label" }
        $Empty = Invoke-S1Sql "select to_regclass('public.consent_documents') is null and to_regclass('public.profile_consent_states') is null and to_regclass('private.consent_requests') is null;" $Container
        if ($Empty.Trim() -ne 't') { throw 'S1 was partially installed after rejected preflight' }
        Write-Output "ok - preflight $Label leaves full schema and default ACL unchanged"
    }
    Assert-Preflight 'unknown business key'
    Invoke-S1Sql "update public.profile_private set personal_data='[]' where id='81000001-0000-4000-8000-000000000001';" $Container | Out-Null
    Assert-Preflight 'non-object JSON'
    Invoke-S1Sql "update public.profile_private set personal_data='{""gender"":""legacy-unmapped""}' where id='81000001-0000-4000-8000-000000000001';" $Container | Out-Null
    Assert-Preflight 'legacy gender value'
    Invoke-S1Sql "update public.profile_private set personal_data='{""gender"":null}' where id='81000001-0000-4000-8000-000000000001';" $Container | Out-Null
    Assert-Preflight 'gender null type'
    Invoke-S1Sql "update public.profile_private set personal_data='{""bio"":77}' where id='81000001-0000-4000-8000-000000000001';" $Container | Out-Null
    Assert-Preflight 'bio type'
    # Restore only the named synthetic fixture. Unknown production data is never guessed or dropped.
    Invoke-S1Sql "update public.profile_private set personal_data='{""gender"":""female"",""bio"":""Synthetic bio"",""allergies"":[""synthetic""]}' where id='81000001-0000-4000-8000-000000000001'; alter table public.profile_private drop constraint profile_private_birth_date_sane; update public.profile_private set birth_date='1899-01-01' where id='81000001-0000-4000-8000-000000000001';" $Container | Out-Null
    Assert-Preflight 'out-of-range birth date' 'S1_UPGRADE_BIRTH_DATE_MAPPING_REQUIRED'
    Invoke-S1Sql "update public.profile_private set birth_date=null where id='81000001-0000-4000-8000-000000000001'; alter table public.profile_private add constraint profile_private_birth_date_sane check(birth_date is null or birth_date between date '1900-01-01' and current_date);" $Container | Out-Null
    foreach ($Name in @('20261017090000_s1_consent_documents.sql','20261017091000_s1_consent_rpcs.sql','20261017092000_s1_food_health_storage.sql','20261017093000_s1_profile_visibility.sql','20261017094000_s1_settlement_disclosure.sql','20261017095000_s1_terms_access_gate.sql')) {
        Invoke-S1Sql (Get-Content -Encoding utf8 -Raw (Join-Path $MigrationDir $Name)) $Container | Out-Null
    }
    $RealtimeAfter = Invoke-S1Sql "select md5(pg_get_functiondef('realtime.apply_rls(jsonb,integer)'::regprocedure));" $Container
    if ($RealtimeBefore -ne $RealtimeAfter) { throw 'S1 unexpectedly changed upstream Realtime RLS implementation' }
    Write-Output 'ok - S1 leaves upstream Realtime apply_rls implementation unchanged'
    Invoke-S1Sql (Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_upgrade_assertions.sql')) $Container
    $BeforeM7 = @'
create temporary table m7_upgrade_before as select
 (select jsonb_agg(to_jsonb(e) order by id) from public.profile_consents e) as events,
 (select to_jsonb(t)-'is_current' from public.terms_versions t where version='2026-08-17') as old_bundle,
 (select jsonb_agg(to_jsonb(s) order by profile_id,kind) from public.profile_consent_states s where kind='marketing') as marketing;
'@
    $M7Copy = Get-Content -Encoding utf8 -Raw (Join-Path $TaskLocal 'supabase/tests/m7-test.sql')
    $M7Checks = Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_m7_upgrade_assertions.sql')
    Invoke-S1Sql ($BeforeM7 + [Environment]::NewLine + $M7Copy + [Environment]::NewLine + $M7Checks) $Container
} finally {
    npx --yes supabase db reset --local --workdir $TaskLocal
    if ($LASTEXITCODE -ne 0) { throw 'Final disposable local reset failed' }
}

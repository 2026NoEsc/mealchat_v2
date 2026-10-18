param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$Source=Join-Path $PSScriptRoot '../release/20261017100000_s1_activate_terms.sql'
$Before=(Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 's1_local.ps1') -Reset
if($LASTEXITCODE -ne 0) { throw 'Unmodified local migrations + seed reset failed' }
$State=Invoke-S1Sql "select public.get_consent_manifest()->>'bundle_version';" $Container
if($State.Trim() -ne 'mealchat-local-dev-r2') { throw 'Local seed did not activate the app S1 bundle' }
Write-Output 'ok - ordinary local reset activates the local-dev S1 bundle'
$State=Invoke-S1Sql "select not exists(select 1 from supabase_migrations.schema_migrations where version='20261017100000') and (select count(*)=4 and bool_and(version like '%local-dev%') from public.consent_documents where is_current);" $Container
if($State.Trim() -ne 't') { throw 'Local reset used a held production M7 or production-looking seed' }
Write-Output 'ok - local reset has no M7 migration and only local-dev current documents'
$Fingerprint="select md5((select jsonb_agg(to_jsonb(d) order by id)::text from public.consent_documents d)||(select jsonb_agg(to_jsonb(t) order by id)::text from public.terms_versions t));"
$BeforeState=Invoke-S1Sql $Fingerprint $Container
$Rejected=Invoke-S1Sql (Get-Content -LiteralPath $Source -Raw -Encoding utf8) $Container -AllowFailure
if($Rejected.Code -eq 0 -or $Rejected.Text -notmatch 'S1_ACTIVATION_CONFIGURATION_REQUIRED') { throw 'Held unconfigured M7 guard did not reject publication' }
Write-Output 'ok - held production template still rejects unconfigured publication'
if((Invoke-S1Sql $Fingerprint $Container) -ne $BeforeState -or (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash -ne $Before) { throw 'Rejected publication changed local data or release template' }
Write-Output 'ok - failed held M7 preserves seed data and repository constants'

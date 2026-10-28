param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
try {
 npx --yes supabase db reset --local --no-seed --version 20261017095000 --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'S1 baseline reset failed' }
 $Fixture=Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's1_fixture.sql')
 $Before=@'
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.save_my_food_preferences('{"korean":true,"meat":false,"seafood":true,"western":false,"chinese":false,"japanese":true}',0);
select public.set_optional_consent(gen_random_uuid(),'health','grant',(public.get_consent_manifest()->'documents'->'health'->>'version'),(public.get_consent_manifest()->'documents'->'health'->>'content_hash'),0,'settings');
select public.save_my_health_preferences(array['test_allergy'],array['test_diet'],0,1);
reset role;
'@
 # One psql session preserves only temporary helpers; each real migration commits independently.
 $Sql="begin; set local s1.tap='off';"+$Fixture+$Before+'commit;'
 foreach ($File in Get-ChildItem (Join-Path $PSScriptRoot '../migrations') -Filter '*_s5_*.sql' | Sort-Object Name) { $Sql+=[Environment]::NewLine+(Get-Content -Encoding utf8 -Raw $File.FullName) }
 $Sql+=[Environment]::NewLine+'begin;'+(Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's5_upgrade.sql'))+'rollback;'
 Write-Output (Invoke-S1Sql $Sql $Container)
} finally {
 npx --yes supabase db reset --local --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'Final local reset failed' }
}

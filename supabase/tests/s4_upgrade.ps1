param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
try {
 npx --yes supabase db reset --local --version 20261018173304 --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'S1+S5 baseline reset failed' }
 # Historical S1/S5 behavior must still pass before S4; all tests roll back fixtures.
 & (Join-Path $PSScriptRoot 's5_sql.ps1') -Container $Container
 if ($LASTEXITCODE -ne 0) { throw 'Historical SQL regression failed' }
 & $DockerExe cp "$PSScriptRoot/." "$($Container):/tmp/s4_upgrade"
 if ($LASTEXITCODE -ne 0) { throw 'Upgrade fixture copy failed' }
 $Sql="begin; set local s1.tap='off';"+'\i /tmp/s4_upgrade/s4_upgrade_fixture.sql'+[Environment]::NewLine+'commit;'
 $Sql+=[Environment]::NewLine+'\i /tmp/s4_upgrade/s4_legacy_place_inventory.sql'
 $Files=@(Get-ChildItem (Join-Path $PSScriptRoot '../migrations') -Filter '*.sql' | Where-Object { $_.Name -gt '20261018173304_s5_public_meeting_area_catalog.sql' } | Sort-Object Name)
 for ($i=0;$i -lt $Files.Count;$i++) {
  $Sql+=[Environment]::NewLine+(Get-Content -Encoding utf8 -Raw $Files[$i].FullName)
  if ($i -lt 2) {
   $Sql+=[Environment]::NewLine+"select pg_temp.check(to_regprocedure('public.get_s4_capabilities()') is null,'M$($i+1) never exposes capability');"
   if ($i -eq 1) {
    $Sql+=[Environment]::NewLine+"select pg_temp.check(not has_function_privilege('authenticated','public.get_room_s4_state(uuid)','EXECUTE') and not has_function_privilege('service_role','public.get_room_s4_state(uuid)','EXECUTE'),'M2 new endpoints remain disabled');"
    $Sql+=[Environment]::NewLine+"begin; set local role authenticated; select pg_temp.as_user('10000001-0000-4000-8000-000000000001'); select pg_temp.check(pg_temp.sqlstate_of('select public.get_room_s4_state(''26000000-0000-4000-8000-000000000001'')')='42501','M2 actual JWT endpoint is denied'); commit;"
   }
  }
 }
 $Sql+=[Environment]::NewLine+'\i /tmp/s4_upgrade/s4_legacy_place_inventory.sql'
 $Sql+=[Environment]::NewLine+'begin;'+[Environment]::NewLine+'\i /tmp/s4_upgrade/s4_upgrade.sql'+[Environment]::NewLine+'rollback;'
 $Result=Invoke-S1Sql $Sql $Container
 $Inventories=@($Result -split "\r?\n" | Where-Object { $_ -match '^5\|2\|2\|0\|2\|0\|0$' })
 if ($Inventories.Count -ne 2) { throw 'Pre/post upgrade inventory must report both unconfirmed open-bill rooms and the expected availability counts' }
 Write-Output 'ok - actual read-only inventory reports both extreme legacy rooms before and after upgrade'
 $Count=1+@($Result -split "\r?\n" | Where-Object { $_ -match '^ok(?:\s|$)' }).Count
 Write-Output "TOTAL S4 upgrade: $Count passed"
} finally {
 npx --yes supabase db reset --local --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'Final local reset failed' }
}

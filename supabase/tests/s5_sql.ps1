param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
& $DockerExe cp "$PSScriptRoot/." "$($Container):/tmp/s5_regression"
if ($LASTEXITCODE -ne 0) { throw 'Fixture copy failed' }
$Total=0
foreach ($Name in @('s1_local_seed.sql','s1_consent_visibility.sql','s1_consent_visibility_plain.sql','s1_security_regressions.sql','s1_acl_inventory.sql','s1_legacy_rpc_regression.sql','s1_realtime_payload.sql','s1_closed_settlement.sql','s5_food_recommendation.sql','s5_review_regressions.sql','s5_quota_lifecycle.sql','s5_public_meeting_areas.sql')) {
 $Result=Invoke-S1Sql "\i /tmp/s5_regression/$Name" $Container
 $Count=@($Result -split "\r?\n" | Where-Object { $_ -match '^ok(?:\s|$)' }).Count
 if ($Count -eq 0) { throw "No assertions: $Name" }
 $Total+=$Count
 Write-Output "$Name : $Count passed"
}
Write-Output "TOTAL SQL: $Total passed"

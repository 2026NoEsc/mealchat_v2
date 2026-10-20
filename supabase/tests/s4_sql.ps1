param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
& $DockerExe cp "$PSScriptRoot/." "$($Container):/tmp/s4_regression"
if ($LASTEXITCODE -ne 0) { throw 'Local fixture copy failed' }
# psql reads the real migration body client-side; no pg_read_file grants are needed.
$LifecycleBody=(Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot '../migrations/20261020020000_s4_settlement_restart_lifecycle.sql')).Replace("`r`n","`n")
$LifecycleBody=[regex]::Replace($LifecycleBody,'(?m)^(begin|commit);\s*$','')
if($LifecycleBody -match '(?im)^\s*(begin|commit);'){throw 'Test migration transaction wrapper was not stripped'}
$LifecycleTemp=Join-Path $env:TEMP ('mealchat-s4-lifecycle-body-'+[guid]::NewGuid().ToString('N')+'.sql')
try {
 [System.IO.File]::WriteAllText($LifecycleTemp,$LifecycleBody,[System.Text.UTF8Encoding]::new($false))
 & $DockerExe cp $LifecycleTemp "$($Container):/tmp/s4_regression/s4_lifecycle_body.sql"
 if ($LASTEXITCODE -ne 0) { throw 'Lifecycle migration test copy failed' }
} finally {if(Test-Path -LiteralPath $LifecycleTemp){Remove-Item -LiteralPath $LifecycleTemp}}
$FollowupBody=(Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot '../migrations/20261020030000_s4_revoke_update_settlement_amount.sql')).Replace("`r`n","`n")
$FollowupBody=[regex]::Replace($FollowupBody,'(?m)^(begin|commit);\s*$','')
if($FollowupBody -match '(?im)^\s*(begin|commit);'){throw 'Follow-up migration transaction wrapper was not stripped'}
$FollowupTemp=Join-Path $env:TEMP ('mealchat-s4-followup-'+[guid]::NewGuid().ToString('N')+'.sql')
try {
 [System.IO.File]::WriteAllText($FollowupTemp,$FollowupBody,[System.Text.UTF8Encoding]::new($false))
 & $DockerExe cp $FollowupTemp "$($Container):/tmp/s4_regression/s4_security_followup_body.sql"
 if ($LASTEXITCODE -ne 0) { throw 'Follow-up migration test copy failed' }
} finally {if(Test-Path -LiteralPath $FollowupTemp){Remove-Item -LiteralPath $FollowupTemp}}
$InventoryBody=(Get-Content -Encoding utf8 -Raw (Join-Path $PSScriptRoot 's4_legacy_place_inventory.sql')).Replace("`r`n","`n")
$InventoryBody=[regex]::Replace($InventoryBody,'(?m)^(begin read only|rollback);\s*$','')
$InventoryTemp=Join-Path $env:TEMP ('mealchat-s4-inventory-'+[guid]::NewGuid().ToString('N')+'.sql')
try {
 [System.IO.File]::WriteAllText($InventoryTemp,"create temporary table actual_inventory as`n"+$InventoryBody,[System.Text.UTF8Encoding]::new($false))
 & $DockerExe cp $InventoryTemp "$($Container):/tmp/s4_regression/s4_inventory_body.sql"
 if ($LASTEXITCODE -ne 0) { throw 'Inventory test copy failed' }
} finally {if(Test-Path -LiteralPath $InventoryTemp){Remove-Item -LiteralPath $InventoryTemp}}
$Total=0
foreach ($Name in @('s4_decisions.sql','s4_security.sql','s4_boundaries.sql','s4_voting_atomicity.sql','s4_quorum.sql','s4_review.sql','s4_request_limits.sql','s4_followup.sql','s4_preview.sql','s4_restart.sql','s4_final_review.sql','s4_amount_revocation.sql','s4_invitation_cleanup.sql')) {
 $Result=Invoke-S1Sql "\i /tmp/s4_regression/$Name" $Container
 $Count=@($Result -split "\r?\n" | Where-Object { $_ -match '^ok(?:\s|$)' }).Count
 if ($Count -eq 0) { throw "No assertions: $Name" }
 $Total+=$Count
 Write-Output "$Name : $Count passed"
}
Write-Output "TOTAL S4 SQL: $Total passed"

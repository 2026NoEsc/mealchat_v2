param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
& $DockerExe cp "$PSScriptRoot/." "$($Container):/tmp/s3_regression"
if($LASTEXITCODE -ne 0){throw 'S3 fixture copy failed'}
# Test the held cutover body in ROLLBACK only. Scheduler/beta admission is NOT
# bypassed in the release file: it is deliberately a separate, unproven gate.
$Activation=[System.IO.File]::ReadAllText((Join-Path $PSScriptRoot '../release/s3_activate_lifecycle.sql'))
$Start=$Activation.IndexOf('-- D8:')
if($Start -lt 0){throw 'Activation body marker missing'}
$Body=[regex]::Replace($Activation.Substring($Start),'(?m)^commit;\s*$','')
$Temp=Join-Path $env:TEMP ('mealchat-s3-cutover-'+[guid]::NewGuid().ToString('N')+'.sql')
try {
 [System.IO.File]::WriteAllText($Temp,$Body,[System.Text.UTF8Encoding]::new($false))
 & $DockerExe cp $Temp "$($Container):/tmp/s3_regression/s3_activation_test_body.sql"
 if($LASTEXITCODE -ne 0){throw 'Activation body copy failed'}
} finally {if(Test-Path -LiteralPath $Temp){Remove-Item -LiteralPath $Temp}}
$Total=0
foreach($Name in @('s3_lifecycle.sql','s3_transfer.sql','s3_invite_limits.sql','s3_acl.sql','s3_upgrade.sql','s3_settlement.sql','s3_hardening.sql','s3_inventory_counts.sql')) {
 $Result=Invoke-S1Sql "\i /tmp/s3_regression/$Name" $Container
 $Count=@($Result -split "\r?\n" | Where-Object {$_ -match '^ok(?:\s|$)'}).Count
 if($Count -eq 0){throw "No assertions: $Name"}
 $Total+=$Count
 Write-Output "$Name : $Count passed"
}
Write-Output "TOTAL S3 SQL: $Total passed (rollback cutover body; scheduler admission unverified)"

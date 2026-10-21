param([string]$Container='supabase_db_mealchat_s1_a_20261017')
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer $Container
$TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
$Config=[IO.File]::ReadAllText((Join-Path $TaskLocal 'supabase/config.toml'))
if($Config -notmatch '(?m)^project_id\s*=\s*"mealchat_s1_a_20261017"\s*$' -or $Config -notmatch '(?ms)^\[db\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*55322\s*$' -or $Config -notmatch '(?ms)^\[api\]\s*\r?\n(?:(?!^\[).)*?^port\s*=\s*55321\s*$'){throw 'Refuse non-isolated scheduler reset'}
# Also prepares the rollback fixture's held activation body. This committed
# fixture is disposable test activation, never reviewed beta rollout evidence.
& (Join-Path $PSScriptRoot 's3_sql.ps1') -Container $Container
try {
 Invoke-S1Sql ([IO.File]::ReadAllText((Join-Path $PSScriptRoot '../release/s3_schedule_cleanup.sql'))) $Container | Out-Null
 if((Invoke-S1Sql "select current_user='postgres' and not rolsuper from pg_roles where rolname=current_user;" $Container).Trim() -ne 't'){throw 'Scheduler did not use a non-superuser postgres'}
 Write-Output 'ok - actual scheduler installation uses non-superuser postgres'
 $Observed=(Invoke-S1Sql "select private.s4_iso(clock_timestamp());" $Container).Trim()
 $Seed="begin; set local s1.tap='off';"+'\i /tmp/s3_regression/s3_fixture.sql'+[Environment]::NewLine+"update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id=pg_temp.s3_room(); commit;"
 Invoke-S1Sql $Seed $Container | Out-Null
 $Receipt="select room_id from private.s3_create_tombstones where actor_id='10000001-0000-4000-8000-000000000001' and request_id='33000000-0000-4000-8000-000000000001'"
 $Watch=[Diagnostics.Stopwatch]::StartNew(); $Collected=$false
 while($Watch.Elapsed.TotalSeconds -lt 150){
  # No client cleanup RPC is invoked. Only the actual pg_cron worker may delete.
  $Check="select exists($Receipt) and not exists(select 1 from public.rooms where id=($Receipt)) and exists(select 1 from cron.job j join cron.job_run_details d on d.jobid=j.jobid where j.jobname='s3-room-expiry-v1' and j.username='postgres' and d.status='succeeded' and d.start_time>='$Observed'::timestamptz);"
  if((Invoke-S1Sql $Check $Container).Trim() -eq 't'){$Collected=$true;break}
  Start-Sleep -Seconds 2
 }
 if(-not $Collected){throw 'Actual pg_cron did not collect the synthetic expired room within 150 seconds'}
 Write-Output 'ok - actual pg_cron enters the worker and deletes an expired room without app cleanup'
} finally {
 npx --yes supabase db reset --local --workdir $TaskLocal
 if($LASTEXITCODE -ne 0){throw 'Final isolated scheduler reset failed'}
}
$Restored="select to_regprocedure('public.get_s3_capabilities()') is null and not (select enabled from private.s3_worker_control where singleton) and has_any_column_privilege('authenticated','public.rooms','INSERT') and not exists(select 1 from cron.job where jobname like 's3-%');"
if((Invoke-S1Sql $Restored $Container).Trim() -ne 't'){throw 'Scheduler reset did not restore the held state'}
Write-Output 'ok - final reset restores held activation and removes synthetic scheduler jobs'
Write-Output 'TOTAL S3 actual scheduler: 3 passed (synthetic activation; real background execution; reset restored)'

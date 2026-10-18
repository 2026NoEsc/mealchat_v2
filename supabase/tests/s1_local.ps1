param([switch]$Reset)
$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$DockerExe=(Get-Command docker -ErrorAction Stop).Source
$Context=& $DockerExe context inspect --format '{{.Endpoints.docker.Host}}'
if ($LASTEXITCODE -ne 0 -or $Context -notmatch '^(npipe|unix)://') { throw 'Local Docker endpoint required' }
$TaskLocal=Join-Path $env:TEMP 'mealchat-s1-a-20261017'
$Migrations=Join-Path $TaskLocal 'supabase/migrations'
New-Item -ItemType Directory -Force -Path $Migrations | Out-Null
@'
project_id = "mealchat_s1_a_20261017"
[api]
port = 55321
[db]
port = 55322
shadow_port = 55320
major_version = 17
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
[studio]
port = 55323
[local_smtp]
port = 55324
[analytics]
enabled = false
[edge_runtime]
enabled = false
[auth]
site_url = "http://127.0.0.1:55321"
'@ | Set-Content -Encoding utf8 (Join-Path $TaskLocal 'supabase/config.toml')
Copy-Item -LiteralPath (Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '../migrations') -Filter '*.sql').FullName -Destination $Migrations
node (Join-Path $PSScriptRoot 's1_m7_local.mjs') --prepare
if ($LASTEXITCODE -ne 0) { throw 'Local seed preparation failed' }
npx --yes supabase start --workdir $TaskLocal --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
if ($LASTEXITCODE -ne 0) { throw 'Disposable local start failed' }
. (Join-Path $PSScriptRoot 's1_test_helpers.ps1')
Assert-S1LocalContainer 'supabase_db_mealchat_s1_a_20261017'

if ($Reset) {
 npx --yes supabase db reset --local --workdir $TaskLocal
 if ($LASTEXITCODE -ne 0) { throw 'Disposable local reset failed' }
}

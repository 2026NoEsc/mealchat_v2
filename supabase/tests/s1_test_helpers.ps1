$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$DockerExe = (Get-Command docker -ErrorAction Stop).Source
function Assert-S1LocalContainer {
    param([string]$Container)
    if ($Container -ne 'supabase_db_mealchat_s1_a_20261017') { throw 'Only the disposable S1-A container is accepted' }
    $Context = (& $DockerExe context inspect --format '{{.Endpoints.docker.Host}}')
    if ($LASTEXITCODE -ne 0 -or $Context -notmatch '^(npipe|unix)://') { throw 'A local Docker endpoint is required' }
    $Identity = & $DockerExe inspect --format '{{.Name}} {{json .Mounts}} {{json .NetworkSettings.Ports}}' $Container
    if ($LASTEXITCODE -ne 0 -or $Identity -notmatch '55322') { throw 'Isolated local container identity mismatch' }
    Write-Output $Identity
}
function Invoke-S1Sql {
    param([string]$Sql,[string]$Container='supabase_db_mealchat_s1_a_20261017',[switch]$AllowFailure)
    $Previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $Lines = @($Sql | & $DockerExe exec -i $Container psql -U postgres -d postgres -X -At -v ON_ERROR_STOP=1 -f - 2>&1)
    $Code = $LASTEXITCODE
    $ErrorActionPreference = $Previous
    $Text = ($Lines | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    if (-not $AllowFailure -and ($Code -ne 0 -or $Text -match '(?m)^not ok\b|Looks like you')) { throw $Text }
    if ($AllowFailure) { return @{ Code=$Code; Text=$Text } }
    return $Text
}

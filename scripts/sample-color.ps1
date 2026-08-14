<#
.SYNOPSIS
  Figma 렌더에서 지정 좌표의 색을 뽑는다. 가로로 스캔해 최빈색을 보여준다.

.DESCRIPTION
  텍스트/테두리처럼 얇은 요소는 안티에일리어싱 때문에 단일 픽셀 샘플이 부정확하다.
  가로 구간을 스캔해 최빈색 2개를 보여주므로 배경색과 글자색을 함께 확인할 수 있다.

.EXAMPLE
  ./scripts/sample-color.ps1 -X0 1665 -X1 1677 -Y 1435
#>
param(
  [Parameter(Mandatory = $true)][int]$X0,
  [Parameter(Mandatory = $true)][int]$X1,
  [Parameter(Mandatory = $true)][int]$Y,
  [string]$Source = "$PSScriptRoot\..\.figma\full.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) { Write-Error "렌더 파일이 없습니다: $Source"; exit 1 }

$img = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
$bmp = New-Object System.Drawing.Bitmap($img)

$tally = @{}
foreach ($x in $X0..$X1) {
  $c = $bmp.GetPixel($x, $Y)
  $hex = "#{0:X2}{1:X2}{2:X2}" -f $c.R, $c.G, $c.B
  $tally[$hex] = $tally[$hex] + 1
}

$tally.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 4 |
  ForEach-Object { "{0}  x{1}" -f $_.Key, $_.Value }

$bmp.Dispose(); $img.Dispose()

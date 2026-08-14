<#
.SYNOPSIS
  Figma 페이지 렌더(full.png)에서 특정 영역을 잘라내 확대 저장한다.

.DESCRIPTION
  `Application UI` 페이지(0:1)를 maxDimension 8676 으로 받은 렌더는 Figma 좌표와 1:1 이다.
  따라서 X/Y 에 "렌더 좌표"를 그대로 넣으면 된다.

  렌더 좌표 = Figma 캔버스 좌표 + (2816, 1846)
  (섹션의 x/y + 프레임의 x/y = 캔버스 좌표)

.EXAMPLE
  # 일정 조율 화면(섹션 309:1430 x=-1328 y=-597, 프레임 x=24 y=28)
  # 캔버스 = (-1304, -569) → 렌더 = (1512, 1277)
  ./scripts/crop-figma.ps1 -X 1512 -Y 1277 -W 220 -H 486 -Out sched.png -Zoom 3
#>
param(
  [Parameter(Mandatory = $true)][int]$X,
  [Parameter(Mandatory = $true)][int]$Y,
  [Parameter(Mandatory = $true)][int]$W,
  [Parameter(Mandatory = $true)][int]$H,
  [Parameter(Mandatory = $true)][string]$Out,
  [double]$Zoom = 3.0,
  [string]$Source = "$PSScriptRoot\..\.figma\full.png"
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Source)) {
  Write-Error @"
렌더 파일이 없습니다: $Source

먼저 Figma MCP 로 페이지 렌더를 받아 저장하세요:
  get_screenshot(fileKey='xBf3b09D6Bj1dTiCixt25e', nodeId='0:1', maxDimension=8676)
그리고 반환된 URL 을 이 경로로 다운로드하면 됩니다.
"@
  exit 1
}

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

$X = [Math]::Max(0, [Math]::Min($X, $src.Width - 1))
$Y = [Math]::Max(0, [Math]::Min($Y, $src.Height - 1))
$W = [Math]::Min($W, $src.Width - $X)
$H = [Math]::Min($H, $src.Height - $Y)

$dw = [int]($W * $Zoom)
$dh = [int]($H * $Zoom)

$dst = New-Object System.Drawing.Bitmap($dw, $dh)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$srcRect = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
$dstRect = New-Object System.Drawing.Rectangle(0, 0, $dw, $dh)
$g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$dst.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $dst.Dispose(); $src.Dispose()

"saved $Out ($dw x $dh) from ($X,$Y,$W,$H)"

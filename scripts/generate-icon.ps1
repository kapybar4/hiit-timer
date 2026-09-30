# Generate HIIT Timer application icon
# Output: build/icon.ico (multi-size 16/24/32/48/64/128/256) + build/icon.png (256x256)
# Visual language mirrors src/styles.css: dark rounded rect + 135deg gradient ring + center dot

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$buildDir = Join-Path $projectRoot 'build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

# Colors (match src/styles.css :root)
$bgColor     = [System.Drawing.Color]::FromArgb(255,   8,   8,  12)  # --bg-base #08080c
$ringBgColor = [System.Drawing.Color]::FromArgb(255,  42,  42,  56)  # --border  #2a2a38
$workColor   = [System.Drawing.Color]::FromArgb(255,   0, 229, 160)  # --work    #00e5a0
$restColor   = [System.Drawing.Color]::FromArgb(255,  77, 184, 255)  # --rest    #4db8ff
$dotColor    = [System.Drawing.Color]::FromArgb(255, 240, 240, 245)  # --text-primary #f0f0f5

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded-rect background (matches app card aesthetic)
  $radius = [int]($size * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $radius * 2, $radius * 2, 180, 90)
  $path.AddArc($size - $radius * 2, 0, $radius * 2, $radius * 2, 270, 90)
  $path.AddArc($size - $radius * 2, $size - $radius * 2, $radius * 2, $radius * 2, 0, 90)
  $path.AddArc(0, $size - $radius * 2, $radius * 2, $radius * 2, 90, 90)
  $path.CloseFigure()
  $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
  $g.FillPath($bgBrush, $path)

  # Ring geometry (mirrors src/index.html ring-svg)
  $center     = $size / 2
  $ringRadius = [int]($size * 0.36)
  $ringWidth  = [int]($size * 0.085)
  $arcRect    = New-Object System.Drawing.Rectangle ($center - $ringRadius), ($center - $ringRadius), ($ringRadius * 2), ($ringRadius * 2)

  # Background ring (full circle, ring-bg-circle equivalent)
  $bgPen = New-Object System.Drawing.Pen($ringBgColor, $ringWidth)
  $bgPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bgPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawEllipse($bgPen, $arcRect)

  # Foreground gradient arc (270deg from top, gap at bottom)
  $p1 = New-Object System.Drawing.Point(0, 0)
  $p2 = New-Object System.Drawing.Point($size, $size)
  $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($p1, $p2, $workColor, $restColor)
  $fgPen = New-Object System.Drawing.Pen($gradBrush, $ringWidth)
  $fgPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $fgPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($fgPen, $arcRect, -90.0, 270.0)

  # Center dot (visual anchor, mirrors countdown-center)
  $dotR = $size * 0.07
  $dotBrush = New-Object System.Drawing.SolidBrush($dotColor)
  $g.FillEllipse($dotBrush, [float]($center - $dotR), [float]($center - $dotR), [float]($dotR * 2), [float]($dotR * 2))

  $g.Dispose()
  return $bmp
}

function Convert-BmpToPngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  return $bytes
}

function New-ByteArray([int[]]$values) {
  $arr = New-Object 'byte[]' $values.Count
  for ($i = 0; $i -lt $values.Count; $i++) { $arr[$i] = [byte]$values[$i] }
  return ,$arr
}

# --- Generate 256px master PNG ---
$main = New-IconBitmap 256
$pngPath = Join-Path $buildDir 'icon.png'
$main.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$main.Dispose()
Write-Host "PNG  -> $pngPath"

# --- Generate multi-size ICO (PNG-embedded, Vista+ compatible) ---
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngBytes = @{}
foreach ($s in $sizes) {
  $bmp = New-IconBitmap $s
  $pngBytes[$s] = (Convert-BmpToPngBytes $bmp)
  $bmp.Dispose()
}

$out = New-Object System.IO.MemoryStream

# ICONDIR (6 bytes)
$out.Write((New-ByteArray @(0, 0)), 0, 2)        # reserved
$out.Write((New-ByteArray @(1, 0)), 0, 2)        # type = 1 (icon)
$countBytes = New-ByteArray @(($sizes.Count -band 0xFF), (($sizes.Count -shr 8) -band 0xFF))
$out.Write($countBytes, 0, 2)                     # count

# ICONDIRENTRY (16 bytes each)
$headerSize = 6 + 16 * $sizes.Count
$dataOffset = $headerSize
foreach ($s in $sizes) {
  $w = [byte]0
  if ($s -ne 256) { $w = [byte]$s }
  $out.WriteByte($w)                              # width
  $out.WriteByte($w)                              # height
  $out.WriteByte([byte]0)                         # colorCount
  $out.WriteByte([byte]0)                         # reserved
  $out.Write((New-ByteArray @(1, 0)), 0, 2)       # planes
  $out.Write((New-ByteArray @(32, 0)), 0, 2)      # bitCount
  $len = $pngBytes[$s].Length
  $lenBytes = New-ByteArray @(($len -band 0xFF), (($len -shr 8) -band 0xFF), (($len -shr 16) -band 0xFF), (($len -shr 24) -band 0xFF))
  $out.Write($lenBytes, 0, 4)                     # bytesInRes
  $offBytes = New-ByteArray @(($dataOffset -band 0xFF), (($dataOffset -shr 8) -band 0xFF), (($dataOffset -shr 16) -band 0xFF), (($dataOffset -shr 24) -band 0xFF))
  $out.Write($offBytes, 0, 4)                     # imageOffset
  $dataOffset += $len
}

# PNG data area
foreach ($s in $sizes) {
  $bytes = $pngBytes[$s]
  $out.Write($bytes, 0, $bytes.Length)
}

$icoPath = Join-Path $buildDir 'icon.ico'
[System.IO.File]::WriteAllBytes($icoPath, $out.ToArray())
$out.Dispose()
Write-Host "ICO  -> $icoPath"
Write-Host ("Sizes: " + ($sizes -join ', '))

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$captureDir = Join-Path $root "app-store-real-captures"
$outDir = Join-Path $root "app-store-screenshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Get-ChildItem $outDir -Filter "*.png" | Remove-Item -Force

$W = 1284
$H = 2778

function Color($hex) {
  $h = $hex.TrimStart("#")
  if ($h.Length -eq 6) {
    return [System.Drawing.Color]::FromArgb(
      [Convert]::ToInt32($h.Substring(0, 2), 16),
      [Convert]::ToInt32($h.Substring(2, 2), 16),
      [Convert]::ToInt32($h.Substring(4, 2), 16)
    )
  }
  return [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($h.Substring(0, 2), 16),
    [Convert]::ToInt32($h.Substring(2, 2), 16),
    [Convert]::ToInt32($h.Substring(4, 2), 16),
    [Convert]::ToInt32($h.Substring(6, 2), 16)
  )
}

function Brush($hex) {
  return New-Object System.Drawing.SolidBrush (Color $hex)
}

function Pen($hex, $width = 1) {
  return New-Object System.Drawing.Pen (Color $hex), $width
}

function Font($size, $style = "Regular") {
  return New-Object System.Drawing.Font("Segoe UI", $size, ([System.Drawing.FontStyle]::$style), [System.Drawing.GraphicsUnit]::Pixel)
}

function RoundedPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function FillRound($g, $x, $y, $w, $h, $r, $hex) {
  $path = RoundedPath $x $y $w $h $r
  $g.FillPath((Brush $hex), $path)
  $path.Dispose()
}

function StrokeRound($g, $x, $y, $w, $h, $r, $hex, $line = 2) {
  $path = RoundedPath $x $y $w $h $r
  $g.DrawPath((Pen $hex $line), $path)
  $path.Dispose()
}

function DrawText($g, $text, $x, $y, $w, $h, $size, $hex, $style = "Regular", $align = "Near") {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::$align
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $font = Font $size $style
  $g.DrawString($text, $font, (Brush $hex), (New-Object System.Drawing.RectangleF $x, $y, $w, $h), $fmt)
  $font.Dispose()
  $fmt.Dispose()
}

function DrawLogo($g, $x, $y, $size) {
  $logoPath = "C:\Users\lamit\Desktop\FRESH LOOK\100 100.png"
  if (!(Test-Path $logoPath)) {
    DrawText $g "FRESH`nLOOK" $x $y $size $size 26 "#9C7652" "Regular"
    return
  }

  $src = [System.Drawing.Bitmap]::FromFile($logoPath)
  $logo = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($yy = 0; $yy -lt $src.Height; $yy++) {
    for ($xx = 0; $xx -lt $src.Width; $xx++) {
      $c = $src.GetPixel($xx, $yy)
      if ($c.R -gt 238 -and $c.G -gt 238 -and $c.B -gt 238) {
        $logo.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      } else {
        $logo.SetPixel($xx, $yy, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
      }
    }
  }
  $g.DrawImage($logo, $x, $y, $size, $size)
  $logo.Dispose()
  $src.Dispose()
}

function StarPath($cx, $cy, $rx, $ry) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $top = New-Object System.Drawing.PointF $cx, ($cy - $ry)
  $right = New-Object System.Drawing.PointF ($cx + $rx), $cy
  $bottom = New-Object System.Drawing.PointF $cx, ($cy + $ry)
  $left = New-Object System.Drawing.PointF ($cx - $rx), $cy

  $path.StartFigure()
  $path.AddBezier(
    $top,
    (New-Object System.Drawing.PointF ($cx + ($rx * 0.10)), ($cy - ($ry * 0.30))),
    (New-Object System.Drawing.PointF ($cx + ($rx * 0.34)), ($cy - ($ry * 0.12))),
    $right
  )
  $path.AddBezier(
    $right,
    (New-Object System.Drawing.PointF ($cx + ($rx * 0.34)), ($cy + ($ry * 0.12))),
    (New-Object System.Drawing.PointF ($cx + ($rx * 0.10)), ($cy + ($ry * 0.30))),
    $bottom
  )
  $path.AddBezier(
    $bottom,
    (New-Object System.Drawing.PointF ($cx - ($rx * 0.10)), ($cy + ($ry * 0.30))),
    (New-Object System.Drawing.PointF ($cx - ($rx * 0.34)), ($cy + ($ry * 0.12))),
    $left
  )
  $path.AddBezier(
    $left,
    (New-Object System.Drawing.PointF ($cx - ($rx * 0.34)), ($cy - ($ry * 0.12))),
    (New-Object System.Drawing.PointF ($cx - ($rx * 0.10)), ($cy - ($ry * 0.30))),
    $top
  )
  $path.CloseFigure()
  return $path
}

function DrawStar($g, $cx, $cy, $rLong, $rShort, $hex) {
  $path = StarPath $cx $cy $rLong $rShort
  $g.FillPath((Brush $hex), $path)
  $path.Dispose()
}

function DrawStarCluster($g, $x, $y, $scale = 1.0) {
  DrawStar $g ($x + (250 * $scale)) ($y + (225 * $scale)) (210 * $scale) (210 * $scale) "#C8A734"
  DrawStar $g ($x + (72 * $scale)) ($y + (350 * $scale)) (124 * $scale) (124 * $scale) "#A77D52"
  DrawStar $g ($x + (392 * $scale)) ($y + (92 * $scale)) (64 * $scale) (64 * $scale) "#D8BD5B"
}

function DrawPhoneShell($g, $x, $y, $w, $h) {
  FillRound $g ($x - 30) ($y - 30) ($w + 60) ($h + 60) 110 "#C9CDD1"
  StrokeRound $g ($x - 30) ($y - 30) ($w + 60) ($h + 60) 110 "#F7F8F9" 5
  FillRound $g ($x - 17) ($y - 17) ($w + 34) ($h + 34) 96 "#111216"
  FillRound $g $x $y $w $h 82 "#0F0F10"
  FillRound $g ($x - 44) ($y + 330) 14 122 7 "#D8DDE1"
  FillRound $g ($x + $w + 30) ($y + 430) 14 178 7 "#D8DDE1"
}

function DrawRealScreen($g, $imagePath, $x, $y, $w, $h) {
  $img = [System.Drawing.Image]::FromFile($imagePath)
  $screenW = 696
  $screenH = [Math]::Round($screenW * $img.Height / $img.Width)
  $screenX = $x + [Math]::Round(($w - $screenW) / 2)
  $screenY = $y + 70

  $screenPath = RoundedPath $screenX $screenY $screenW $screenH 58
  $oldClip = $g.Clip
  $g.SetClip($screenPath)
  $g.DrawImage($img, $screenX, $screenY, $screenW, $screenH)
  $g.Clip = $oldClip
  $screenPath.Dispose()
  $oldClip.Dispose()
  $img.Dispose()

  StrokeRound $g $screenX $screenY $screenW $screenH 58 "#23252B" 2
  FillRound $g ($x + ($w / 2) - 136) ($y + 34) 272 42 21 "#06070A"
  FillRound $g ($x + ($w / 2) + 82) ($y + 47) 18 18 9 "#1B2230"
}

function NewAppStoreShot($fileName, $captureName, $bg, $title, $subtitle) {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear((Color $bg))

  FillRound $g -120 -80 620 620 310 "#FFFFFF55"
  DrawStarCluster $g 955 520 0.40
  DrawStarCluster $g 945 2050 0.44
  DrawStar $g 1115 150 48 48 "#D8BD5B"

  DrawLogo $g 78 52 158
  DrawText $g $title 88 228 1080 210 72 "#1D1712" "Bold"
  DrawText $g $subtitle 90 420 1030 106 32 "#6F604F"

  $phoneX = 262
  $phoneY = 670
  $phoneW = 760
  $phoneH = 1640
  DrawPhoneShell $g $phoneX $phoneY $phoneW $phoneH
  DrawRealScreen $g (Join-Path $captureDir $captureName) $phoneX $phoneY $phoneW $phoneH

  $outPath = Join-Path $outDir $fileName
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

NewAppStoreShot "01-real-home.png" "home.png" "#FBF7EF" "Your beauty account at a glance" "Fresh Points, upcoming visits, and rewards live in one simple client app."
NewAppStoreShot "02-real-visits.png" "visits.png" "#F8F3EA" "Track every treatment visit" "Clients can check upcoming appointments and their FreshLook visit history."
NewAppStoreShot "03-real-rewards.png" "rewards.png" "#F5ECDE" "Redeem Fresh Points with QR rewards" "Create rewards from points and show the QR code at an appointment."
NewAppStoreShot "04-real-profile.png" "profile.png" "#FCF4F1" "A clean client profile" "Contact details, account status, points, and preferences stay easy to find."

Write-Host "Created real app mockups in $outDir"

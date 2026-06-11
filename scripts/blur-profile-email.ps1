Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$profilePath = Join-Path $root "app-store-real-captures\profile.png"
$backupPath = Join-Path $root "app-store-real-captures\profile-original.png"

if (!(Test-Path $backupPath)) {
  Copy-Item -LiteralPath $profilePath -Destination $backupPath
}

$img = [System.Drawing.Bitmap]::FromFile($backupPath)
$g = [System.Drawing.Graphics]::FromImage($img)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Cover only the email line in the profile card.
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(21, 21, 24))
$rect = New-Object System.Drawing.RectangleF 38, 250, 230, 24
$g.FillRectangle($brush, $rect)

# Add a subtle blurred-looking placeholder band so the profile card still feels natural.
for ($i = 0; $i -lt 7; $i++) {
  $alpha = 42 - ($i * 4)
  $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 161, 161, 170))
  $g.FillRectangle($b, (42 + $i), (257 + [Math]::Floor($i / 2)), 182, 5)
  $b.Dispose()
}

$brush.Dispose()
$g.Dispose()
$img.Save($profilePath, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()

Write-Host "Blurred email in $profilePath"

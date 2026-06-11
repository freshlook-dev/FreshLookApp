Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root "app-store-screenshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

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

function DrawPill($g, $x, $y, $w, $h, $label, $fill, $text, $size = 28) {
  FillRound $g $x $y $w $h 24 $fill
  DrawText $g $label ($x + 28) ($y + 14) ($w - 56) ($h - 10) $size $text "Bold"
}

function DrawPhone($g, $x, $y, $w, $h, $dark = $false) {
  FillRound $g ($x - 30) ($y - 30) ($w + 60) ($h + 60) 112 "#C9CDD1"
  StrokeRound $g ($x - 30) ($y - 30) ($w + 60) ($h + 60) 112 "#F7F8F9" 5
  FillRound $g ($x - 17) ($y - 17) ($w + 34) ($h + 34) 96 "#111216"
  FillRound $g $x $y $w $h 82 $(if ($dark) { "#101114" } else { "#FAF8F4" })
  StrokeRound $g $x $y $w $h 82 $(if ($dark) { "#26282E" } else { "#F7F3EB" }) 2
  FillRound $g ($x + ($w / 2) - 136) ($y + 24) 272 42 21 "#06070A"
  FillRound $g ($x + ($w / 2) + 82) ($y + 37) 18 18 9 "#1B2230"
  FillRound $g ($x - 44) ($y + 330) 14 122 7 "#D8DDE1"
  FillRound $g ($x + $w + 30) ($y + 430) 14 178 7 "#D8DDE1"
}

function DrawTabBar($g, $x, $y, $w, $labels, $active = 0, $dark = $false, $phoneH = 1800) {
  $barY = $y + $phoneH - 185
  FillRound $g ($x + 36) $barY ($w - 72) 116 34 $(if ($dark) { "#1A1B20" } else { "#FFFFFF" })
  StrokeRound $g ($x + 36) $barY ($w - 72) 116 34 $(if ($dark) { "#30323A" } else { "#E6DED0" }) 2
  $step = ($w - 120) / $labels.Count
  for ($i = 0; $i -lt $labels.Count; $i++) {
    $cx = $x + 60 + ($step * $i)
    $isActive = $i -eq $active
    FillRound $g ($cx + 30) ($barY + 20) 42 42 21 $(if ($isActive) { "#C9A24D" } else { if ($dark) { "#2A2B31" } else { "#F1ECE3" } })
    DrawText $g $labels[$i] $cx ($barY + 68) $step 34 18 $(if ($isActive) { "#C9A24D" } else { "#7A7A7A" }) "Bold" "Center"
  }
}

function DrawCard($g, $x, $y, $w, $h, $dark = $false) {
  FillRound $g $x $y $w $h 28 $(if ($dark) { "#1A1B20" } else { "#FFFFFF" })
  StrokeRound $g $x $y $w $h 28 $(if ($dark) { "#30323A" } else { "#E6DED0" }) 2
}

function DrawMiniQr($g, $x, $y, $size) {
  FillRound $g $x $y $size $size 18 "#FFFFFF"
  $cell = [Math]::Floor(($size - 44) / 17)
  $ox = $x + 22
  $oy = $y + 22
  $pattern = @(
    "11111110010111111",
    "10000010100100001",
    "10111010111101101",
    "10111010001001101",
    "10111011101001101",
    "10000010110100001",
    "11111110101011111",
    "00000000100000000",
    "11010111101101010",
    "01001001011010101",
    "11101110101011100",
    "00101001110100101",
    "11111010101110111",
    "10000010010100010",
    "10111011111011101",
    "10000010100100101",
    "11111110111110111"
  )
  for ($row = 0; $row -lt $pattern.Count; $row++) {
    for ($col = 0; $col -lt $pattern[$row].Length; $col++) {
      if ($pattern[$row][$col] -eq "1") {
        FillRound $g ($ox + $col * $cell) ($oy + $row * $cell) ($cell - 1) ($cell - 1) 3 "#101114"
      }
    }
  }
}

function NewShot($name, $bg, $title, $subtitle, $body, $titleColor = "#101114", $subtitleColor = "#4C4C4C") {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear((Color $bg))

  FillRound $g -120 -80 620 620 310 "#FFFFFF40"
  FillRound $g 850 260 420 420 210 "#C9A24D28"
  FillRound $g 900 2190 420 420 210 "#315E542A"

  DrawText $g "MY FRESHLOOK" 88 88 520 48 26 "#C9A24D" "Bold"
  DrawText $g $title 88 152 1080 210 76 $titleColor "Bold"
  DrawText $g $subtitle 90 346 1030 106 34 $subtitleColor "Regular"
  & $body $g

  $path = Join-Path $outDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

NewShot "01-home-dashboard.png" "#FAF8F4" "Your beauty treatments in one elegant place" "See your next appointment, Fresh Points, and treatment details at a glance." {
  param($g)
  $px = 252; $py = 660; $pw = 780; $ph = 1634
  DrawPhone $g $px $py $pw $ph $false
  DrawText $g "FreshLook" ($px + 70) ($py + 96) 280 46 30 "#C9A24D" "Bold"
  DrawText $g "Hi, Amanda" ($px + 70) ($py + 146) 760 78 58 "#2B2B2B" "Bold"
  DrawText $g "Your appointments and Fresh Points are ready whenever you are." ($px + 70) ($py + 228) 720 86 28 "#7A7A7A"
  DrawCard $g ($px + 70) ($py + 360) ($pw - 140) 250 $false
  DrawText $g "Fresh Points" ($px + 112) ($py + 406) 320 38 26 "#7A7A7A" "Bold"
  DrawText $g "1,250" ($px + 112) ($py + 458) 420 86 72 "#2B2B2B" "Bold"
  FillRound $g ($px + $pw - 198) ($py + 438) 92 92 46 "#C9A24D"
  DrawText $g "Gift" ($px + $pw - 194) ($py + 466) 84 38 22 "#FFFFFF" "Bold" "Center"
  DrawText $g "Next Visit" ($px + 70) ($py + 692) 360 50 40 "#2B2B2B" "Bold"
  DrawText $g "View all" ($px + $pw - 250) ($py + 704) 140 36 26 "#C9A24D" "Bold"
  DrawCard $g ($px + 70) ($py + 780) ($pw - 140) 300 $false
  DrawText $g "Microneedling" ($px + 112) ($py + 832) 600 46 36 "#2B2B2B" "Bold"
  DrawText $g "June 18, 2026 at 14:30" ($px + 112) ($py + 894) 600 38 27 "#7A7A7A"
  DrawText $g "FreshLook Clinic, Warsaw" ($px + 112) ($py + 936) 600 38 27 "#7A7A7A"
  DrawPill $g ($px + 112) ($py + 1000) 190 64 "SCHEDULED" "#F3E8C7" "#8B6B22" 20
  DrawCard $g ($px + 70) ($py + 1144) ($pw - 140) 250 $false
  DrawText $g "Recommended" ($px + 112) ($py + 1190) 320 36 26 "#7A7A7A" "Bold"
  DrawText $g "Keep your treatment plan and rewards in sync." ($px + 112) ($py + 1240) 560 82 32 "#2B2B2B" "Bold"
  DrawTabBar $g $px $py $pw @("Home","Visits","Rewards","Profile") 0 $false $ph
}

NewShot "02-appointments.png" "#F3F7F5" "Never miss your next appointment" "Upcoming and past visits stay organized with service, location, time, and status." {
  param($g)
  $px = 252; $py = 660; $pw = 780; $ph = 1634
  DrawPhone $g $px $py $pw $ph $false
  DrawText $g "Your Visits" ($px + 70) ($py + 118) 600 70 58 "#2B2B2B" "Bold"
  DrawText $g "Upcoming appointments and recent FreshLook history." ($px + 70) ($py + 206) 720 78 28 "#7A7A7A"
  DrawText $g "Upcoming" ($px + 70) ($py + 340) 360 50 38 "#2B2B2B" "Bold"
  $items = @(
    @("Facial Cleaning","June 18, 2026 at 14:30","FreshLook Clinic","SCHEDULED"),
    @("Carbon Peeling","June 25, 2026 at 11:00","FreshLook Clinic","CONFIRMED"),
    @("Plasma Pen","July 02, 2026 at 16:15","FreshLook Clinic","SCHEDULED")
  )
  $y = $py + 420
  foreach ($it in $items) {
    DrawCard $g ($px + 70) $y ($pw - 140) 220 $false
    DrawText $g $it[0] ($px + 112) ($y + 34) 580 42 34 "#2B2B2B" "Bold"
    DrawText $g $it[1] ($px + 112) ($y + 90) 600 34 25 "#7A7A7A"
    DrawText $g $it[2] ($px + 112) ($y + 130) 600 34 25 "#7A7A7A"
    DrawText $g $it[3] ($px + 112) ($y + 172) 260 30 22 "#C9A24D" "Bold"
    $y += 250
  }
  DrawText $g "History" ($px + 70) ($y + 20) 360 50 38 "#2B2B2B" "Bold"
  DrawCard $g ($px + 70) ($y + 98) ($pw - 140) 214 $false
  DrawText $g "Tattoo removal" ($px + 112) ($y + 132) 560 42 34 "#2B2B2B" "Bold"
  DrawText $g "May 30, 2026 at 15:00" ($px + 112) ($y + 188) 600 34 25 "#7A7A7A"
  DrawText $g "Visit notes saved" ($px + 112) ($y + 230) 600 34 25 "#315E54" "Bold"
  DrawTabBar $g $px $py $pw @("Home","Visits","Rewards","Profile") 1 $false $ph
}

NewShot "03-rewards-qr.png" "#101114" "Turn Fresh Points into instant rewards" "Create a QR reward, show it at your appointment, and redeem points in seconds." {
  param($g)
  $px = 252; $py = 660; $pw = 780; $ph = 1634
  DrawPhone $g $px $py $pw $ph $true
  DrawText $g "Rewards" ($px + 70) ($py + 118) 600 70 58 "#FFFFFF" "Bold"
  DrawText $g "Turn Fresh Points into a QR reward and show it at your appointment." ($px + 70) ($py + 206) 720 82 28 "#A1A1AA"
  DrawCard $g ($px + 70) ($py + 330) ($pw - 140) 220 $true
  DrawText $g "Available Fresh Points" ($px + 112) ($py + 374) 420 36 25 "#A1A1AA" "Bold"
  DrawText $g "1,250" ($px + 112) ($py + 424) 420 76 68 "#FFFFFF" "Bold"
  DrawCard $g ($px + 70) ($py + 610) ($pw - 140) 690 $true
  DrawMiniQr $g ($px + 278) ($py + 690) 420
  DrawText $g "500 Fresh Points" ($px + 70) ($py + 1158) ($pw - 140) 48 38 "#FFFFFF" "Bold" "Center"
  DrawText $g "Expires today at 15:45" ($px + 70) ($py + 1210) ($pw - 140) 38 26 "#A1A1AA" "Regular" "Center"
  DrawText $g "Create Reward" ($px + 70) ($py + 1310) 420 46 34 "#FFFFFF" "Bold"
  DrawPill $g ($px + 70) ($py + 1360) 190 60 "100 pts" "#C9A24D" "#FFFFFF" 22
  DrawPill $g ($px + 282) ($py + 1360) 190 60 "500 pts" "#C9A24D" "#FFFFFF" 22
  DrawPill $g ($px + 494) ($py + 1360) 190 60 "Custom" "#2A2B31" "#C9A24D" 22
  DrawTabBar $g $px $py $pw @("Home","Visits","Rewards","Profile") 2 $true $ph
} "#FFFFFF" "#D2D2D2"

NewShot "04-profile.png" "#FFF5F6" "A personal client profile for every visit" "Keep contact details, Fresh Points, account status, and preferences in one place." {
  param($g)
  $px = 252; $py = 660; $pw = 780; $ph = 1634
  DrawPhone $g $px $py $pw $ph $false
  DrawText $g "Profile" ($px + 70) ($py + 118) 600 70 58 "#2B2B2B" "Bold"
  DrawText $g "Your FreshLook client account." ($px + 70) ($py + 206) 720 52 28 "#7A7A7A"
  DrawCard $g ($px + 70) ($py + 320) ($pw - 140) 360 $false
  FillRound $g ($px + 112) ($py + 374) 148 148 74 "#C9A24D"
  DrawText $g "A" ($px + 112) ($py + 398) 148 110 78 "#FFFFFF" "Bold" "Center"
  DrawText $g "Amanda Novak" ($px + 112) ($py + 552) 520 50 40 "#2B2B2B" "Bold"
  DrawText $g "amanda@example.com" ($px + 112) ($py + 608) 520 38 26 "#7A7A7A"
  DrawCard $g ($px + 70) ($py + 735) ($pw - 140) 420 $false
  $rows = @(
    @("Phone","+48 500 222 119"),
    @("Fresh Points","1,250"),
    @("Account","Active")
  )
  $ry = $py + 780
  foreach ($row in $rows) {
    DrawText $g $row[0] ($px + 112) $ry 280 34 24 "#7A7A7A" "Bold"
    DrawText $g $row[1] ($px + 112) ($ry + 44) 560 40 31 "#2B2B2B" "Bold"
    $ry += 120
  }
  DrawCard $g ($px + 70) ($py + 1225) ($pw - 140) 130 $false
  DrawText $g "Dark mode" ($px + 112) ($py + 1265) 340 44 32 "#2B2B2B" "Bold"
  FillRound $g ($px + $pw - 220) ($py + 1262) 120 56 28 "#C9A24D"
  FillRound $g ($px + $pw - 152) ($py + 1268) 44 44 22 "#FFFFFF"
  DrawCard $g ($px + 70) ($py + 1410) ($pw - 140) 115 $false
  DrawText $g "Sign out" ($px + 112) ($py + 1442) ($pw - 224) 44 32 "#B91C1C" "Bold" "Center"
  DrawTabBar $g $px $py $pw @("Home","Visits","Rewards","Profile") 3 $false $ph
}

NewShot "05-owner-tools.png" "#EFF4FA" "Built for smooth beauty clinic operations" "Staff can manage bookings, scan reward QR codes, and follow client activity." {
  param($g)
  $px = 252; $py = 660; $pw = 780; $ph = 1634
  DrawPhone $g $px $py $pw $ph $false
  DrawText $g "Today" ($px + 70) ($py + 118) 600 70 58 "#2B2B2B" "Bold"
  DrawText $g "A focused workspace for treatments, rewards, and clinic activity." ($px + 70) ($py + 206) 720 80 28 "#7A7A7A"
  DrawCard $g ($px + 70) ($py + 330) 305 210 $false
  DrawText $g "12" ($px + 112) ($py + 372) 180 70 66 "#2B2B2B" "Bold"
  DrawText $g "Visits today" ($px + 112) ($py + 456) 240 36 26 "#7A7A7A" "Bold"
  DrawCard $g ($px + 405) ($py + 330) 305 210 $false
  DrawText $g "3" ($px + 447) ($py + 372) 180 70 66 "#2B2B2B" "Bold"
  DrawText $g "Pending QR" ($px + 447) ($py + 456) 220 36 26 "#7A7A7A" "Bold"
  DrawText $g "Appointments" ($px + 70) ($py + 620) 460 48 38 "#2B2B2B" "Bold"
  $rows = @(
    @("Amanda Novak","Facial Cleaning","14:30","CONFIRMED"),
    @("Sara Mills","Microneedling","15:15","SCHEDULED"),
    @("Mira Stone","Tattoo removal","16:00","CHECKED IN")
  )
  $y = $py + 700
  foreach ($row in $rows) {
    DrawCard $g ($px + 70) $y ($pw - 140) 160 $false
    DrawText $g $row[0] ($px + 112) ($y + 30) 420 38 31 "#2B2B2B" "Bold"
    DrawText $g $row[1] ($px + 112) ($y + 82) 420 32 24 "#7A7A7A"
    DrawText $g $row[2] ($px + $pw - 235) ($y + 36) 150 36 30 "#C9A24D" "Bold" "Center"
    DrawText $g $row[3] ($px + 112) ($y + 118) 300 30 21 "#315E54" "Bold"
    $y += 180
  }
  DrawCard $g ($px + 70) ($py + 1265) ($pw - 140) 132 $false
  DrawText $g "Scan reward QR" ($px + 112) ($py + 1296) 420 38 30 "#2B2B2B" "Bold"
  DrawText $g "Redeem Fresh Points at checkout." ($px + 112) ($py + 1342) 430 30 22 "#7A7A7A"
  FillRound $g ($px + $pw - 172) ($py + 1285) 78 78 39 "#315E54"
  DrawText $g "QR" ($px + $pw - 172) ($py + 1305) 78 38 24 "#FFFFFF" "Bold" "Center"
  DrawTabBar $g $px $py $pw @("Today","Calendar","Scan","Stats") 0 $false $ph
}

Write-Host "Created screenshots in $outDir"

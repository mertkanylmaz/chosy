# MONEY-1C - mantiksal export dogrulama (yalniz OKUMA).
# Kullanim:  powershell -NoProfile -File scripts\backup\verify-export.ps1 -BackupDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26
# Kontroller:
#   1) Klasor OneDrive/bulut senkronunda DEGIL (yol OneDrive altinda mi, yeniden-ayrisim noktasi/bulut ozniteligi var mi).
#   2) Her tablo icin dosya satir sayisi = MANIFEST satir sayisi; dosyanin md5'i = MANIFEST md5 (dosya sonradan degismedi).
#   3) Dosya satir sayisi = CANLI count(*) (export ile arasinda yazma olduysa FARK normal olabilir: 'SAPMA' raporlanir, hata degil;
#      beklenmedik buyuk sapma/azalma icin runbook 0.1'e bak).
# Cikis kodu 0: 1 ve 2 temiz. 1: bir kontrol kirmizi. Anahtar gerektirmez.
param([Parameter(Mandatory = $true)][string]$BackupDir)
$ErrorActionPreference = 'Continue'
$full = [System.IO.Path]::GetFullPath($BackupDir)
$red = 0

# 1) bulut senkronu
$cloudRoots = @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial) | Where-Object { $_ }
$underCloud = $false
foreach ($r in $cloudRoots) { if ($full.StartsWith([System.IO.Path]::GetFullPath($r), [System.StringComparison]::OrdinalIgnoreCase)) { $underCloud = $true } }
if ($full -match '(?i)\\(OneDrive|Dropbox|Google Drive|iCloud|Box|pCloud|MEGA)([^\\]*)\\') { $underCloud = $true }
$reparse = @()
$p = $full
while ($p -and (Test-Path -LiteralPath $p)) {
  $it = Get-Item -LiteralPath $p -Force
  if ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { $reparse += $p }
  $parent = Split-Path -Parent $p
  if ($parent -eq $p) { break }
  $p = $parent
}
$cloudFiles = @(Get-ChildItem -LiteralPath $full -Force -File | Where-Object { [int]$_.Attributes -band 0x400000 -or [int]$_.Attributes -band 0x40000 -or [int]$_.Attributes -band 0x80000 })  # RECALL_ON_DATA_ACCESS / PINNED / UNPINNED
if ($underCloud -or $reparse.Count -gt 0 -or $cloudFiles.Count -gt 0) {
  $red++; Write-Host "KIRMIZI bulut: yol=$full underCloud=$underCloud reparse=$($reparse -join ',') bulutOznitelikliDosya=$($cloudFiles.Count) -> klasoru senkron DISINA tasi"
} else { Write-Host "OK     bulut: $full OneDrive/bulut altinda degil, yeniden-ayrisim noktasi ve bulut oznitelikli dosya yok" }

# 2-3) MANIFEST
$mf = Join-Path $full 'MANIFEST.txt'
if (-not (Test-Path -LiteralPath $mf)) { throw "MANIFEST.txt yok: $mf" }
foreach ($l in [System.IO.File]::ReadLines($mf)) {
  $parts = $l -split ' \| '
  if ($parts.Count -ne 6 -or -not $parts[1].EndsWith('.jsonl')) { continue }
  $t = $parts[0]; $file = Join-Path $full $parts[1]
  $mRows = [long]$parts[2]; $mMd5 = $parts[4]
  if (-not (Test-Path -LiteralPath $file)) { $red++; Write-Host "KIRMIZI $t : dosya yok"; continue }
  $n = 0L; foreach ($x in [System.IO.File]::ReadLines($file)) { if ($x.Length -gt 0) { $n++ } }
  $md5 = (Get-FileHash -Algorithm MD5 -LiteralPath $file).Hash.ToLower()
  $raw = & supabase db query --linked "select count(*) as n from public.$t" 2>$null
  $live = [long]((($raw -join "`n") | ConvertFrom-Json).rows[0].n)
  $fileOk = ($n -eq $mRows -and $md5 -eq $mMd5)
  $liveTxt = if ($live -eq $n) { "canli=$live ESIT" } else { "canli=$live SAPMA($($live - $n))" }
  if (-not $fileOk) { $red++ }
  Write-Host ("{0} {1,-20} dosya={2} manifest={3} md5={4} {5}" -f $(if ($fileOk) { 'OK    ' } else { 'KIRMIZI' }), $t, $n, $mRows, $(if ($md5 -eq $mMd5) { 'ESIT' } else { 'FARKLI' }), $liveTxt)
}
if ($red -gt 0) { Write-Host "SONUC: $red kirmizi - APPLY YOK"; exit 1 } else { Write-Host 'SONUC: temiz' }

# MONEY-1C - mantiksal export'tan SATIR geri yukleme SQL'i URETIR (calistirmaz).
# Kullanim:
#   powershell -File scripts\backup\restore-rows.ps1 -BackupDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26 `
#     -Table mood_searches -KeyColumns id -Keys '<uuid-1>','<uuid-2>' -OutFile $env:TEMP\restore_mood_searches.sql
#   (bilesik anahtar: -KeyColumns user_id,date -Keys '<uuid>|2026-10-25')
# Sonra SQL dosyasini GOZLE kontrol et ve calistir:  supabase db query --linked -f <OutFile>
# Semantik: UPSERT (INSERT ... ON CONFLICT (anahtar) DO UPDATE SET <diger tum kolonlar> = excluded.<kolon>).
#   Eksik (silinmis) satir eklenir, bozulmus satir export'taki haline doner. DELETE YOKTUR: public.users satirini
#   silmek ON DELETE CASCADE ile subscriptions/mood_searches/watchlist/user_daily_quotas/lifetime_sales satirlarini de siler.
# Islem sonunda DO blogu hedef anahtarlarin hepsinin tabloda oldugunu dogrular; eksikse RAISE (islem geri alinir).
param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [Parameter(Mandatory = $true)][string]$Table,
  [Parameter(Mandatory = $true)][string[]]$KeyColumns,
  [Parameter(Mandatory = $true)][string[]]$Keys,
  [Parameter(Mandatory = $true)][string]$OutFile
)
$ErrorActionPreference = 'Stop'
# `powershell -File` dizi parametresini virgullu TEK dize olarak verir ('a','b' -> "a,b"); anahtarlarda virgul olmaz, bolunur
$KeyColumns = @($KeyColumns | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$Keys = @($Keys | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$allowed = @('mood_searches', 'users', 'subscriptions', 'user_daily_quotas', 'watchlist', 'app_config',
             'subscription_limits', 'promo_codes', 'lifetime_sales', 'deletion_requests')
if ($allowed -notcontains $Table) { throw "Tablo export kapsaminda degil: $Table" }
foreach ($c in $KeyColumns) { if ($c -notmatch '^[a-z_][a-z0-9_]*$') { throw "gecersiz kolon adi: $c" } }
foreach ($k in $Keys) { if ($k -match "'") { throw "anahtar degerinde tirnak olamaz: $k" } }
$file = Join-Path $BackupDir "$Table.jsonl"
if (-not (Test-Path -LiteralPath $file)) { throw "export dosyasi yok: $file" }

$want = @{}
foreach ($k in $Keys) { $want[$k] = $true }
$picked = New-Object System.Collections.Generic.List[string]
$found = @{}
$cols = $null
foreach ($line in [System.IO.File]::ReadLines($file)) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $o = $line | ConvertFrom-Json
  if ($null -eq $cols) { $cols = @($o.PSObject.Properties.Name) }
  $key = ($KeyColumns | ForEach-Object { [string]$o.$_ }) -join '|'
  if ($want.ContainsKey($key)) { $picked.Add($line); $found[$key] = $true }
}
$missing = @($Keys | Where-Object { -not $found.ContainsKey($_) })
if ($missing.Count -gt 0) { throw "Export'ta bulunmayan anahtar(lar): $($missing -join ', ')" }
foreach ($kc in $KeyColumns) { if ($cols -notcontains $kc) { throw "export'ta kolon yok: $kc" } }

$json = '[' + ($picked -join ',') + ']'
if ($json.Contains('$bk$')) { throw 'JSON icinde $bk$ var; farkli bir dollar-quote etiketi gerekir' }
$setCols = @($cols | Where-Object { $KeyColumns -notcontains $_ })
$set = ($setCols | ForEach-Object { "`"$_`" = excluded.`"$_`"" }) -join ', '
$keyList = ($KeyColumns | ForEach-Object { "`"$_`"" }) -join ', '
$keyExpr = 'concat_ws(''|'', ' + (($KeyColumns | ForEach-Object { "t.`"$_`"" }) -join ', ') + ')'
$inList = ($Keys | ForEach-Object { "'$_'" }) -join ', '
$sql = @"
begin;
insert into public.$Table
select * from jsonb_populate_recordset(null::public.$Table, `$bk`$$json`$bk`$::jsonb)
on conflict ($keyList) do update set $set;
do `$chk`$
declare n int;
begin
  select count(*) into n from public.$Table t where $keyExpr in ($inList);
  if n <> $($Keys.Count) then raise exception 'geri yukleme dogrulamasi basarisiz: beklenen $($Keys.Count), bulunan %', n; end if;
end `$chk`$;
commit;
"@
[System.IO.File]::WriteAllText($OutFile, $sql, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Uretildi: $OutFile ($($Keys.Count) satir, tablo $Table). Gozle kontrol edip calistir: supabase db query --linked -f $OutFile"

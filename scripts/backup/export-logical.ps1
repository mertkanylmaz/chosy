# MONEY-1C - mantiksal export (yalniz OKUMA). Supabase Free planda yedek/PITR yok; apply oncesi kapi.
# Kullanim:  powershell -File scripts\backup\export-logical.ps1 -OutDir C:\Users\mertk\moodflix-rollback\backup-2026-10-26
# Mevcut `supabase` CLI oturumunu kullanir (`supabase db query --linked`). Anahtar ISTEMEZ, YAZMAZ, LOGLAMAZ.
# Cikti KISISEL VERI icerir: klasor repo DISINDA kalmali, git'e eklenmez. Docker/pg_dump gerekmez.
param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$PageSize = 1000
)
$ErrorActionPreference = 'Continue'
$repoRoot = (git rev-parse --show-toplevel).Trim()
$outFull = [System.IO.Path]::GetFullPath($OutDir)
if ($outFull.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutDir repo icinde olamaz (kisisel veri): $outFull"
}
New-Item -ItemType Directory -Force $outFull | Out-Null

$tables = @('mood_searches', 'users', 'subscriptions', 'user_daily_quotas', 'watchlist', 'app_config',
            'subscription_limits', 'promo_codes', 'lifetime_sales', 'deletion_requests')

function Invoke-Sql([string]$sql) {
  # stdout: {"boundary":..., "rows":[...]}; stderr ("Initialising login role...") atilir
  $raw = & supabase db query --linked $sql 2>$null
  if ($LASTEXITCODE -ne 0) { throw "supabase db query basarisiz (exit $LASTEXITCODE)" }
  $obj = ($raw -join "`n") | ConvertFrom-Json
  if ($null -eq $obj.rows) { throw 'beklenen "rows" alani yok' }
  return , @($obj.rows)
}

function Get-Md5([string]$path) { (Get-FileHash -Algorithm MD5 -LiteralPath $path).Hash.ToLower() }

$manifest = New-Object System.Collections.Generic.List[string]
$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'
$manifest.Add("MANIFEST - mantiksal export, $stamp")
$manifest.Add("proje: xpcwihldlnlmyopjubdc (chosy ai) | sayfa boyutu: $PageSize")
$manifest.Add('tablo | dosya | satir(dosya) | satir(count*, export basi) | md5(dosya) | durum')
$failed = 0

foreach ($t in $tables) {
  $file = Join-Path $outFull "$t.jsonl"
  $countBefore = [long](Invoke-Sql "select count(*) as n from public.$t")[0].n
  if (Test-Path $file) { Remove-Item $file }
  New-Item -ItemType File $file | Out-Null
  $written = 0L
  $offset = 0
  while ($true) {
    $rows = Invoke-Sql "select to_jsonb(t)::text as j from public.$t t order by to_jsonb(t)::text limit $PageSize offset $offset"
    if ($rows.Count -eq 0) { break }
    # satir metni oldugu gibi yazilir (PowerShell JSON gidis-donusu tarih/sayi bicimini bozabilir)
    $lines = foreach ($r in $rows) { [string]$r.j }
    [System.IO.File]::AppendAllLines($file, [string[]]@($lines), (New-Object System.Text.UTF8Encoding($false)))
    $written += $rows.Count
    $offset += $PageSize
    if ($rows.Count -lt $PageSize) { break }
  }
  $countAfter = [long](Invoke-Sql "select count(*) as n from public.$t")[0].n
  if ($written -eq $countBefore -and $countBefore -eq $countAfter) { $status = 'OK' }
  elseif ($written -eq $countAfter) { $status = "OK (export sirasinda satir sayisi $countBefore->$countAfter)" }
  else { $failed++; $status = "HATA: dosya=$written count=$countBefore->$countAfter" }
  $md5 = Get-Md5 $file
  $manifest.Add("$t | $t.jsonl | $written | $countAfter | $md5 | $status")
  Write-Host ("{0,-22} {1,6} satir  {2}" -f $t, $written, $status)
}

# ---- Sema export (information_schema / pg_catalog; pg_dump yok) ----
$schemaFile = Join-Path $outFull 'schema-2026-10-26.sql.txt'
$out = New-Object System.Text.StringBuilder
function Add-Section([string]$title, [string]$sql, [string[]]$cols) {
  [void]$out.AppendLine("")
  [void]$out.AppendLine("-- ===== $title =====")
  foreach ($r in (Invoke-Sql $sql)) {
    $vals = foreach ($c in $cols) { [string]$r.$c }
    [void]$out.AppendLine(($vals -join ' | '))
  }
}
[void]$out.AppendLine("-- Sema export (salt-okunur katalog sorgulari) - $stamp")
[void]$out.AppendLine('-- Geri yukleme icin degil, KARSILASTIRMA/yeniden kurma referansi. Veri: *.jsonl')
Add-Section 'tablolar + kolonlar (tablo | kolon | tip | null? | default)' `
  "select table_name, column_name, data_type || coalesce('('||character_maximum_length||')','') as typ, is_nullable, coalesce(column_default,'') as def from information_schema.columns where table_schema='public' order by table_name, ordinal_position" `
  @('table_name', 'column_name', 'typ', 'is_nullable', 'def')
Add-Section 'kisitlar (tablo | ad | tanim)' `
  "select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint where connamespace='public'::regnamespace order by 1,2" `
  @('tbl', 'conname', 'def')
Add-Section 'indeksler' `
  "select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2" `
  @('tablename', 'indexname', 'indexdef')
Add-Section 'RLS acik mi (tablo | rls | force | sahip)' `
  "select c.relname, c.relrowsecurity::text as rls, c.relforcerowsecurity::text as frc, pg_get_userbyid(c.relowner) as own from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') order by 1" `
  @('relname', 'rls', 'frc', 'own')
Add-Section 'policy (tablo | ad | komut | roller | USING | WITH CHECK)' `
  "select tablename, policyname, cmd, roles::text as roles, coalesce(qual,'') as qual, coalesce(with_check,'') as wc from pg_policies where schemaname='public' order by 1,2" `
  @('tablename', 'policyname', 'cmd', 'roles', 'qual', 'wc')
Add-Section 'tablo yetkileri (relacl)' `
  "select c.relname, coalesce(c.relacl::text,'') as acl from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') order by 1" `
  @('relname', 'acl')
Add-Section 'kolon yetkileri (mood_searches vb. kolon-duzeyi ACL)' `
  "select c.relname, a.attname, a.attacl::text as acl from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and a.attacl is not null order by 1,2" `
  @('relname', 'attname', 'acl')
Add-Section 'tetikleyiciler' `
  "select tgrelid::regclass::text as tbl, tgname, pg_get_triggerdef(oid) as def from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace='public'::regnamespace) order by 1,2" `
  @('tbl', 'tgname', 'def')
Add-Section 'sequence durumu' `
  "select schemaname||'.'||sequencename as seq, coalesce(last_value::text,'NULL') as last_value from pg_sequences where schemaname='public' order by 1" `
  @('seq', 'last_value')
Add-Section 'fonksiyon ACL / DEFINER / config (ad | imza | definer | sahip | config | acl)' `
  "select p.proname, p.oid::regprocedure::text as sig, p.prosecdef::text as def, pg_get_userbyid(p.proowner) as own, coalesce(p.proconfig::text,'') as cfg, coalesce(p.proacl::text,'') as acl from pg_proc p where p.pronamespace='public'::regnamespace order by 1,2" `
  @('proname', 'sig', 'def', 'own', 'cfg', 'acl')
# fonksiyon govdeleri (tam tanim)
[void]$out.AppendLine("")
[void]$out.AppendLine('-- ===== fonksiyon tanimlari (pg_get_functiondef) =====')
foreach ($r in (Invoke-Sql "select pg_get_functiondef(p.oid) as d from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind in ('f','p') order by p.proname, p.oid::regprocedure::text")) {
  [void]$out.AppendLine([string]$r.d)
  [void]$out.AppendLine(';')
}
Add-Section 'gorunumler (view)' `
  "select viewname, definition from pg_views where schemaname='public' order by 1" `
  @('viewname', 'definition')
Add-Section 'uygulanmis migration surumleri' `
  "select version, coalesce(name,'') as name from supabase_migrations.schema_migrations order by version" `
  @('version', 'name')
[System.IO.File]::WriteAllText($schemaFile, $out.ToString(), (New-Object System.Text.UTF8Encoding($false)))
$manifest.Add("(sema) | schema-2026-10-26.sql.txt | - | - | $(Get-Md5 $schemaFile) | OK")

$manifest.Add("SONUC: " + $(if ($failed -eq 0) { 'TUM TABLOLAR TAMAM' } else { "$failed TABLO EKSIK - APPLY YOK" }))
[System.IO.File]::WriteAllLines((Join-Path $outFull 'MANIFEST.txt'), $manifest, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "MANIFEST: $(Join-Path $outFull 'MANIFEST.txt')"
if ($failed -gt 0) { exit 1 }

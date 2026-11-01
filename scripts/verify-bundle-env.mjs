// OTA güvenlik kapısı: zorunlu EXPO_PUBLIC_* değerleri export edilen iOS bundle'ında var mı?
// Kullanım (env:exec içinde):  node scripts/verify-bundle-env.mjs <export-klasörü>
// Çıktı YALNIZ "AD → VAR/YOK". Değer, değerin parçası ya da hash'i ASLA yazdırılmaz.
// Herhangi biri YOK ise exit 1.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_RC_IOS_KEY',
  'EXPO_PUBLIC_TMDB_API_KEY',
];
// GOOGLE_IOS/WEB_CLIENT_ID bilerek listede YOK: kodda yalnız yorum satırında geçiyor (Google girişi
// WebBrowser OAuth ile, configureGoogleSignIn no-op) → hiçbir bundle onları içeremez. Kod bir ID'yi
// `process.env.EXPO_PUBLIC_*` ile okumaya başlarsa buraya eklenmeli.

const dir = process.argv[2];
if (!dir) {
  console.error('Kullanım: node scripts/verify-bundle-env.mjs <export-klasörü>');
  process.exit(2);
}

const jsDir = join(dir, '_expo', 'static', 'js', 'ios');
if (!existsSync(jsDir)) {
  console.error('iOS bundle klasörü yok: ' + jsDir);
  process.exit(2);
}
const files = readdirSync(jsDir).filter((f) => f.endsWith('.hbc') || f.endsWith('.js'));
if (files.length === 0) {
  console.error('iOS bundle dosyası bulunamadı.');
  process.exit(2);
}
const bundle = Buffer.concat(files.map((f) => readFileSync(join(jsDir, f))));

let failed = false;
for (const name of REQUIRED) {
  const value = process.env[name];
  const ok = typeof value === 'string' && value.trim().length > 0 && bundle.includes(Buffer.from(value, 'utf8'));
  if (!ok) failed = true;
  console.log(`${name} → ${ok ? 'VAR' : 'YOK'}`);
}

if (failed) {
  console.error('DUR: en az bir zorunlu değişken bundle\'da yok (ya da ortamda boş). OTA yayınlanmaz.');
  process.exit(1);
}
console.log('Tüm zorunlu değişkenler bundle\'da VAR.');

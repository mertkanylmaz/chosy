// Güvenli OTA kalıbı (production, iOS). Ham `eas update` YASAK — bkz. docs/TEKNIK_BORC.md.
// Kullanım:  npm run ota:prod -- "Mesaj"      (ya da MSG ortam değişkeni)
// Adımlar: (a) git temiz mi → (b) EAS production env'i ile temiz export → (c) bundle'da zorunlu
// değişkenler VAR mı → (d) AYNI doğrulanmış export klasörünü yayınla → (e) geçici klasörü sil.
// .env dosyası diske yazılmaz; değerler yalnız env:exec'in alt sürecinde yaşar ve hiçbir yere basılmaz.
// OTA_DRY=1 → (d) atlanır (yalnız export + doğrulama).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const msg = (process.argv[2] ?? process.env.MSG ?? '').trim();
const dry = process.env.OTA_DRY === '1';
if (!dry && msg.length === 0) fail('Mesaj gerekli: npm run ota:prod -- "Mesaj"  (ya da MSG=...)');
if (/["%^&|<>`$\\]/.test(msg)) fail('Mesajda şu karakterler olamaz: " % ^ & | < > ` $ \\');

const run = (cmd) => spawnSync(cmd, { shell: true, stdio: 'inherit' }).status ?? 1;

let tmpDir = null;

function fail(text) {
  console.error('DUR: ' + text);
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); // process.exit finally'yi atlar
  process.exit(1);
}

// (a) git temiz mi
const st = spawnSync('git status --porcelain', { shell: true, encoding: 'utf8' });
if (st.status !== 0) fail('git status çalışmadı.');
if (st.stdout.trim().length > 0) fail('git status temiz değil.');

// (b)+(c) EAS production env'i ile temiz export, aynı süreçte doğrulama
const tmp = mkdtempSync(join(tmpdir(), 'ota-ios-')).replaceAll('\\', '/');
tmpDir = tmp;
if (/[\s"'%^&|<>`$]/.test(tmp)) {
  fail('Geçici klasör yolu güvenli değil: boşluk/özel karakter içeriyor.');
}
let code = 1;
try {
  code = run(
    `npx eas-cli env:exec production "npx expo export --platform ios --clear --output-dir ${tmp} && node scripts/verify-bundle-env.mjs ${tmp}" --non-interactive`,
  );
  if (code !== 0) fail('export ya da bundle doğrulaması başarısız (kod ' + code + '). OTA yayınlanmadı.');
  if (dry) {
    console.log('OTA_DRY=1: yayın atlandı.');
  } else {
    // (d) doğrulanan export'un AYNISI yayınlanır (yeniden bundle yok → doğrulanan = yayınlanan).
    code = run(
      `npx eas-cli update --branch production --platform ios --environment production --clear-cache --skip-bundler --input-dir ${tmp} --non-interactive --message "${msg}"`,
    );
    if (code !== 0) fail('eas update başarısız (kod ' + code + ').');
  }
} finally {
  // (e)
  rmSync(tmp, { recursive: true, force: true });
}

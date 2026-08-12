/**
 * check-env — Build oncesi zorunlu ortam degiskeni kapisi.
 *
 * Neden var: 12 Agu 2026'da EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_TMDB_API_KEY,
 * EXPO_PUBLIC_POSTHOG_KEY ve EXPO_PUBLIC_POSTHOG_HOST'un hicbir EAS ortaminda
 * (production/preview/development) tanimli olmadigi tespit edildi. `.env`
 * .gitignore'da oldugu icin EAS build arsivine girmiyor — yani yerelde calisan
 * bir degisken production bundle'inda `undefined` olabiliyor. Sonuc: Sentry
 * event gondermiyor, film detay ekrani TMDb 401 aliyor, analitik sessizce
 * kapali. Bu script o durumu build baslamadan once yakalar.
 *
 * Uc mod:
 *   1. Yerel    — `process.env` + `.env` dosyasi okunur. `npx expo start` /
 *      `expo run:*` gibi yerelde bundle uretilen akislar icin dogru kaynak.
 *   2. EAS      — `--eas <environment>` ile `eas env:list` cikti olarak alinir.
 *      EAS build sunucuda kosar ve YEREL `.env` DOSYASINI GORMEZ; production
 *      build'i dogrulayan tek gecerli kontrol budur.
 *   3. Supabase — `--supabase` ile `supabase secrets list` okunur. Edge
 *      Function'lar ne `.env` ne EAS ortamini gorur; ucuncu ve ayri bir
 *      dunyadir. Zorunlu liste elle yazilmaz, `Deno.env.get` cagrilarindan
 *      turetilir.
 *
 * Kullanim:
 *   npm run check:env                      # yerel .env
 *   npm run check:env:supabase             # Edge secret'lari
 *   npx tsx scripts/check-env.ts --eas production
 *
 * Eksik zorunlu degisken varsa exit code 1 → npm pre-hook build'i durdurur.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/**
 * Eksikse build DURUR.
 *
 * Hepsi client bundle'ina giren `EXPO_PUBLIC_*` degiskenleri — backend-only
 * secret'lar (SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY ...) bu listeye GIRMEZ,
 * onlar Supabase Edge secret'i olarak yasar ve build'i ilgilendirmez.
 */
const REQUIRED: readonly string[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_TMDB_API_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_RC_IOS_KEY',
];

/** Eksikse yalnizca uyarir — build devam eder. */
const OPTIONAL: readonly string[] = [
  // Android store'a submit edilene kadar zorunlu degil.
  'EXPO_PUBLIC_RC_ANDROID_KEY',
];

// ── Supabase Edge secret'lari ────────────────────────────────────────────────

/**
 * Supabase'in her Edge Function'a otomatik enjekte ettigi degiskenler.
 *
 * `supabase secrets list` bunlari gosterir ama elle set EDILMEZLER. Zorunlu
 * listeye alinirlarsa guard hicbir zaman yesile donmez; surekli yanlis alarm
 * veren kapi, gorulmezden gelinen kapidir.
 */
const SUPABASE_AUTO_INJECTED: ReadonlySet<string> = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'SUPABASE_JWKS',
  'SUPABASE_PUBLISHABLE_KEYS',
  'SUPABASE_SECRET_KEYS',
]);

/**
 * Kodda okunuyor ama yoklugunda bilincli ve zararsiz bir varsayilana dusuyor.
 * Eksikse uyarilir, exit 0 korunur.
 */
const SUPABASE_WARN_ONLY: ReadonlyMap<string, string> = new Map([
  ['CHOSY_ENV', "yoksa Sentry ortam etiketi 'production' kabul eder — staging event'leri production diye damgalanir"],
  // Opsiyonel Slack/Discord bildirim webhook'u. Yoklugunda lifetime satisi
  // yine islenir, yalnizca kutlama mesaji gitmez — para akisini etkilemez.
  // Zorunlu tutulursa kapi kalici kirmizi kalir; kirilmayan kirmizi, guveni
  // biten kapidir. C.0d'de kodun atlamayi loglamasi eklenecek.
  ['FOUNDING_MEMBER_NOTIFY_URL', 'yoksa yeni Founding Member bildirimi gonderilmez — satis yine islenir'],
]);

/** `.env.example`'dan kopyalanmis, doldurulmamis degerler. */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^your-/i,
  /^https:\/\/your-/i,
  /\.\.\.$/,
];

type Source = 'local' | 'eas' | 'supabase';

interface CheckResult {
  /** Degisken adi */
  name: string;
  /** 'ok' | 'missing' | 'empty' | 'placeholder' */
  status: 'ok' | 'missing' | 'empty' | 'placeholder';
  /** Nereden okundu — rapor icin */
  origin: string;
}

// ── Deger toplama ────────────────────────────────────────────────────────────

/**
 * `.env` dosyasini ayristirir.
 *
 * Bilincli olarak dotenv paketi kullanilmiyor — yeni bagimlilik CTO onayi
 * ister. Desteklenen bicim: `KEY=value`, `#` yorum satiri, tirnakli deger.
 */
function parseEnvFile(filePath: string): Map<string, string> {
  const values = new Map<string, string>();
  if (!fs.existsSync(filePath)) return values;

  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Tirnak icindeki degeri soy
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }
  return values;
}

/** Yerel kaynak: once gercek `process.env`, yoksa `.env` dosyasi. */
function collectLocal(): Map<string, { value: string; origin: string }> {
  const collected = new Map<string, { value: string; origin: string }>();

  const fileValues = parseEnvFile(path.join(ROOT, '.env'));
  for (const [key, value] of fileValues) {
    collected.set(key, { value, origin: '.env' });
  }

  // process.env dosyayi EZER — CI/kabuk export'u daha guncel kabul edilir.
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined) {
      collected.set(key, { value: fromProcess, origin: 'process.env' });
    }
  }

  return collected;
}

/**
 * EAS kaynak: `eas env:list <environment>` ciktisini ayristirir.
 *
 * Secret olarak isaretli degiskenler `NAME=***** (...)` seklinde doner —
 * deger okunamaz ama VARLIGI dogrulanabilir, kontrol icin bu yeterli.
 *
 * CLI hata verirse sessizce gecmez: exception firlatir, build durur.
 */
function collectEas(environment: string): Map<string, { value: string; origin: string }> {
  const collected = new Map<string, { value: string; origin: string }>();

  let output: string;
  try {
    output = execSync(`npx eas env:list ${environment}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `eas env:list ${environment} calistirilamadi. EAS oturumu acik mi ` +
        `(eas whoami)? Ag baglantisi var mi?\n  ${message}`
    );
  }

  const envVarLine = /^([A-Z][A-Z0-9_]*)=(.*)$/;
  for (const rawLine of output.split(/\r?\n/)) {
    const match = envVarLine.exec(rawLine.trim());
    if (match === null) continue;

    const key = match[1];
    const value = match[2];
    // Maskeli secret: deger okunamaz, "var" kabul edilir.
    const isMasked = value.startsWith('*****');
    collected.set(key, {
      value: isMasked ? 'masked' : value,
      origin: `EAS:${environment}`,
    });
  }

  return collected;
}

/**
 * `supabase/functions/` altindaki her `.ts` dosyasini tarar ve
 * `Deno.env.get('NAME')` cagrilarindan okunan secret adlarini toplar.
 *
 * Neden sabit liste degil: 12 Agu 2026'da secret'larin `RC_WEBHOOK_SECRET`
 * adiyla set edildigi ama kodun `REVENUECAT_WEBHOOK_SECRET` okudugu tespit
 * edildi — iki RevenueCat webhook'u aylarca dogrulamasiz calisti. Elle yazilan
 * bir liste bu uyusmazligi tanim geregi yakalayamaz; tek dogruluk kaynagi kod.
 *
 * @returns secret adi → onu okuyan dosyalarin repo-goreli yollari
 */
function scanFunctionSecrets(): Map<string, string[]> {
  const readers = new Map<string, string[]>();
  const functionsRoot = path.join(ROOT, 'supabase', 'functions');
  if (!fs.existsSync(functionsRoot)) return readers;

  const envCall = /Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;

      const source = fs.readFileSync(full, 'utf-8');
      const relative = path.relative(ROOT, full).replace(/\\/g, '/');
      for (const match of source.matchAll(envCall)) {
        const name = match[1];
        const existing = readers.get(name);
        if (existing === undefined) {
          readers.set(name, [relative]);
        } else if (!existing.includes(relative)) {
          existing.push(relative);
        }
      }
    }
  };

  walk(functionsRoot);
  return readers;
}

/**
 * Supabase kaynak: `supabase secrets list` ciktisini ayristirir.
 *
 * Cikti `NAME | DIGEST` tablosudur — degerler asla okunamaz, yalnizca VARLIK
 * dogrulanir. Kontrol icin bu yeterli: aranan sey "set edilmis mi", "dogru mu"
 * degil.
 *
 * CLI hata verirse sessizce gecmez: exception firlatir, kapi kirmizi olur.
 */
function collectSupabase(): Map<string, { value: string; origin: string }> {
  const collected = new Map<string, { value: string; origin: string }>();

  let output: string;
  try {
    output = execSync('npx supabase secrets list', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      'supabase secrets list calistirilamadi. Proje link\'li mi ' +
        `(supabase link)? Oturum acik mi (supabase login)?\n  ${message}`
    );
  }

  // "  NAME  | DIGEST" — basliktaki "NAME | DIGEST" satiri da eslesir,
  // asagida ad kalibiyla elenir.
  for (const rawLine of output.split(/\r?\n/)) {
    const pipe = rawLine.indexOf('|');
    if (pipe <= 0) continue;

    const name = rawLine.slice(0, pipe).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    if (name === 'NAME') continue;

    collected.set(name, { value: 'set', origin: 'supabase secrets' });
  }

  return collected;
}

// ── Degerlendirme ────────────────────────────────────────────────────────────

function evaluate(
  name: string,
  collected: Map<string, { value: string; origin: string }>
): CheckResult {
  const entry = collected.get(name);
  if (entry === undefined) {
    return { name, status: 'missing', origin: '—' };
  }
  if (entry.value.trim().length === 0) {
    return { name, status: 'empty', origin: entry.origin };
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(entry.value))) {
    return { name, status: 'placeholder', origin: entry.origin };
  }
  return { name, status: 'ok', origin: entry.origin };
}

const STATUS_LABEL: Record<CheckResult['status'], string> = {
  ok: 'tanimli',
  missing: 'TANIMSIZ',
  empty: 'BOS',
  placeholder: 'PLACEHOLDER (.env.example degeri doldurulmamis)',
};

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Supabase Edge secret kapisi.
 *
 * Zorunlu liste kodun kendisinden turer: `Deno.env.get` ile okunan her ad
 * zorunludur — otomatik enjekte edilenler ve bilincli varsayilani olanlar
 * disinda. Ek olarak "yetim" secret'lari raporlar: set edilmis ama hicbir
 * fonksiyonun okumadigi adlar, neredeyse her zaman bir isim uyusmazliginin
 * isaretidir.
 */
function runSupabase(): void {
  const collected = collectSupabase();
  const readers = scanFunctionSecrets();

  console.log('\ncheck-env — kaynak: supabase secrets list\n');

  const required: string[] = [];
  const warnOnly: string[] = [];
  for (const name of [...readers.keys()].sort()) {
    if (SUPABASE_AUTO_INJECTED.has(name)) continue;
    if (SUPABASE_WARN_ONLY.has(name)) warnOnly.push(name);
    else required.push(name);
  }

  const requiredResults = required.map((name) => evaluate(name, collected));
  const warnResults = warnOnly.map((name) => evaluate(name, collected));

  for (const result of requiredResults) {
    const isOk = result.status === 'ok';
    const mark = isOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const detail = isOk ? result.origin : STATUS_LABEL[result.status];
    console.log(`  ${mark} ${result.name.padEnd(28)} ${detail}`);
  }
  // Uyari seviyesi asla kirmizi basmaz: kapiyi kirmayan kirmizi, kapiya olan
  // guveni asindirir.
  for (const result of warnResults) {
    const isOk = result.status === 'ok';
    const mark = isOk ? '\x1b[32m✓\x1b[0m' : '\x1b[33m!\x1b[0m';
    const detail = isOk ? result.origin : `${STATUS_LABEL[result.status]} (uyari)`;
    console.log(`  ${mark} ${result.name.padEnd(28)} ${detail}`);
  }

  // Otomatik enjekte edilenler: bilgi amacli, hicbir zaman kapiyi kirmaz.
  const auto = [...collected.keys()].filter((name) => SUPABASE_AUTO_INJECTED.has(name));
  if (auto.length > 0) {
    console.log(`\n  (otomatik enjekte, kontrol disi: ${auto.sort().join(', ')})`);
  }

  // Yetim: set edilmis ama kod okumuyor → isim uyusmazligi suphesi.
  const orphans = [...collected.keys()].filter(
    (name) => !SUPABASE_AUTO_INJECTED.has(name) && !readers.has(name)
  );
  if (orphans.length > 0) {
    console.log('');
    for (const name of orphans.sort()) {
      console.log(
        `\x1b[33m!\x1b[0m ${name} set edilmis ama hicbir Edge Function okumuyor — ` +
          'isim uyusmazligi mi?'
      );
    }
  }

  for (const result of warnResults) {
    if (result.status === 'ok') continue;
    console.log(
      `\x1b[33m!\x1b[0m ${result.name} ${STATUS_LABEL[result.status]} — ` +
        `${SUPABASE_WARN_ONLY.get(result.name)}`
    );
  }

  const failed = requiredResults.filter((result) => result.status !== 'ok');
  if (failed.length === 0) {
    console.log(
      `\n\x1b[32m✓\x1b[0m ${requiredResults.length}/${requiredResults.length} zorunlu Edge secret'i tanimli.\n`
    );
    return;
  }

  console.error(`\n\x1b[31m✗\x1b[0m ${failed.length} zorunlu Edge secret'i eksik.\n`);
  for (const result of failed) {
    const who = (readers.get(result.name) ?? []).join(', ');
    console.error(`  ${result.name} → ${STATUS_LABEL[result.status]}`);
    console.error(`    okuyan: ${who}`);
  }
  console.error('\nDuzeltme:');
  for (const result of failed) {
    console.error(`  supabase secrets set ${result.name}="<deger>"`);
  }
  console.error('');

  process.exit(1);
}

function parseArgs(argv: readonly string[]): { source: Source; environment: string } {
  if (argv.includes('--supabase')) {
    return { source: 'supabase', environment: 'supabase' };
  }

  const easIndex = argv.indexOf('--eas');
  if (easIndex === -1) {
    return { source: 'local', environment: 'local' };
  }

  const environment = argv[easIndex + 1];
  if (environment === undefined || environment.startsWith('--')) {
    console.error(
      '\x1b[31m✗\x1b[0m --eas bir ortam adi ister: production | preview | development'
    );
    process.exit(1);
  }
  return { source: 'eas', environment };
}

function main(): void {
  const { source, environment } = parseArgs(process.argv.slice(2));

  if (source === 'supabase') {
    runSupabase();
    return;
  }

  const collected =
    source === 'eas' ? collectEas(environment) : collectLocal();

  const label = source === 'eas' ? `EAS ortami "${environment}"` : 'yerel .env / process.env';
  console.log(`\ncheck-env — kaynak: ${label}\n`);

  const required = REQUIRED.map((name) => evaluate(name, collected));
  const optional = OPTIONAL.map((name) => evaluate(name, collected));

  for (const result of [...required, ...optional]) {
    const isOk = result.status === 'ok';
    const mark = isOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const detail = isOk ? result.origin : STATUS_LABEL[result.status];
    console.log(`  ${mark} ${result.name.padEnd(34)} ${detail}`);
  }

  const failed = required.filter((result) => result.status !== 'ok');
  const warned = optional.filter((result) => result.status !== 'ok');

  if (warned.length > 0) {
    console.log('');
    for (const result of warned) {
      console.log(
        `\x1b[33m!\x1b[0m ${result.name} ${STATUS_LABEL[result.status]} — opsiyonel, build devam ediyor.`
      );
    }
  }

  if (failed.length === 0) {
    console.log(`\n\x1b[32m✓\x1b[0m ${REQUIRED.length}/${REQUIRED.length} zorunlu degisken tanimli.\n`);
    return;
  }

  console.error(`\n\x1b[31m✗\x1b[0m ${failed.length} zorunlu degisken eksik — build durduruldu.\n`);
  for (const result of failed) {
    console.error(`  ${result.name} → ${STATUS_LABEL[result.status]}`);
  }

  if (source === 'eas') {
    console.error('\nDuzeltme (EAS ortamina yaz):');
    for (const result of failed) {
      console.error(
        `  npx eas env:create --environment ${environment} --name ${result.name} --value <deger> --visibility plaintext`
      );
    }
    console.error(
      '\nNot: yerel .env yeterli DEGIL — .env .gitignore\'da, EAS build arsivine girmiyor.'
    );
  } else {
    console.error('\nDuzeltme: .env dosyasina ekle (sablon: .env.example).');
    console.error('EAS build icin ayrica: npx tsx scripts/check-env.ts --eas production');
  }
  console.error('');

  process.exit(1);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n\x1b[31m✗\x1b[0m check-env calistirilamadi:\n  ${message}\n`);
  process.exit(1);
}

/**
 * MOOD-VEC-1 eval oturumu — kalıcı anonim hesap.
 *
 * İlk koşuda anonim oturum açar (tests/founder-acceptance/runner.ts:115-135 deseni),
 * public.users satırını services/auth-utils.ts:100-103 ile aynı upsert'le garanti eder
 * ve refresh token'ı `.session.json`'a yazar (gitignore'lu). Sonraki koşular aynı hesabı
 * kullanır. Gizli bilgi loglanmaz.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js');

const SESSION_FILE = path.join(__dirname, '.session.json');

export interface EvalSession {
  accessToken: string;
  authUid: string;
  appUserId: string;
  supabase: ReturnType<typeof createClient>;
}

export function envOrThrow(name: string, ...alts: string[]): string {
  for (const n of [name, ...alts]) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Ortam değişkeni eksik: ${[name, ...alts].join(' | ')}`);
}

export async function openEvalSession(): Promise<EvalSession> {
  const url = envOrThrow('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anon = envOrThrow('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  let accessToken = '';
  let authUid = '';

  if (fs.existsSync(SESSION_FILE)) {
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as { refresh_token: string };
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: saved.refresh_token });
    if (error || !data.session) {
      throw new Error(`Kayıtlı eval oturumu yenilenemedi: ${error?.message ?? 'session yok'}. .session.json silinirse YENİ hesap açılır; bilinçli yap.`);
    }
    accessToken = data.session.access_token;
    authUid = data.session.user.id;
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ refresh_token: data.session.refresh_token }));
  } else {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) throw new Error(`Anonim oturum açılamadı: ${error?.message ?? 'session yok'}`);
    accessToken = data.session.access_token;
    authUid = data.session.user.id;
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ refresh_token: data.session.refresh_token }));
  }

  // supabase-js istemcisine oturumu ver (RLS: users upsert / films okuma)
  const authed = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: row, error: upErr } = await authed
    .from('users')
    .upsert({ auth_id: authUid }, { onConflict: 'auth_id' })
    .select('id')
    .single();
  if (upErr || !row) throw new Error(`public.users satırı oluşturulamadı (auth_id ${authUid}): ${upErr?.message ?? 'satır dönmedi'}`);

  return { accessToken, authUid, appUserId: row.id as string, supabase: authed };
}

if (require.main === module) {
  openEvalSession()
    .then((s) => console.log(JSON.stringify({ auth_uid: s.authUid, users_id: s.appUserId })))
    .catch((e) => { console.error(String(e)); process.exit(1); });
}

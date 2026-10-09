/**
 * aiConsent — third-party AI (Anthropic/Claude) rızasının TEK kapısı.
 *
 * Apple 5.1.2(i): kullanıcı verisini üçüncü taraf bir AI'a göndermeden önce
 * açık rıza alınır. LLM'e veri götüren her istemci çağrısı bu modülden geçer;
 * modül dışında rıza kontrolü yazılmaz:
 *
 *   ensureAiConsent(surface) — rıza yoksa sheet açar, sonucu döner.
 *   hasAiConsent()           — sessiz okuma; sheet AÇMAZ (otomatik tetikli
 *                              çağrılar için: rerank, explain-match).
 *
 * Çağrı yerleri (grep kanıtı raporda): parse-mood (tasteParser), rerank-films
 * (recommendations), explain-match (matchExplanation), slot-mood-filtered
 * (slotService).
 *
 * ── Saklama ─────────────────────────────────────────────────────────────────
 * `public.users.ai_consent_at` + `ai_consent_version` (migration 131). Rıza =
 * `ai_consent_at IS NOT NULL` VE `ai_consent_version >= AI_CONSENT_VERSION`.
 * Yazma `.eq('auth_id', …)` ile (RLS "users: self update", auth_id = auth.uid()).
 * Etkilenen satır sayısı 1 değilse BAŞARI SAYILMAZ: PostgREST RLS'e takılan
 * UPDATE'te hata değil 0 satır döner (bkz. watchlist UPDATE RLS boşluğu).
 *
 * ── Ret ─────────────────────────────────────────────────────────────────────
 * Yalnız süreç belleğinde tutulur (kalıcı yazılmaz). Aynı oturumda örtük
 * tetikleyiciler sheet'i yeniden AÇMAZ; kullanıcının bilinçli eylemi
 * (`explicit: true` — Settings anahtarı, "Kişisel açıklamayı aç") açar.
 *
 * ── Sunucu zorlaması YOK ────────────────────────────────────────────────────
 * Edge Function'lar rıza kolonuna bakmaz (eski istemcileri kilitlerdi).
 * Bu kapı istemci tarafıdır. Bkz. docs/TEKNIK_BORC.md.
 */

import * as Sentry from '@sentry/react-native';

import { posthogAnalytics } from '@/services/posthog';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';

/** Rıza metni esaslı değişince artırılır; eski sürüm "rıza yok" sayılır. */
export const AI_CONSENT_VERSION = 1;

/** Rızanın istendiği yüzey — analytics `surface` alanı. */
export type AiConsentSurface = 'mood_search' | 'roulette' | 'film_detail' | 'settings';

export interface EnsureAiConsentOptions {
  /**
   * Kullanıcının bilinçli eylemi (anahtar, CTA dokunuşu). Aynı oturumdaki
   * önceki "Şimdi değil"i yok sayar ve sheet'i yeniden açar.
   */
  explicit?: boolean;
}

/** Sheet'in kabul dokunuşunun sonucu. */
export type AiConsentWriteResult = { ok: true } | { ok: false };

/**
 * Sheet'i gösteren host (components/AiConsentSheet → AiConsentHost) bunu kaydeder.
 * Servis React'e bağlı değildir; sheet bir Promise köprüsüyle açılır.
 */
export interface AiConsentHost {
  show: (surface: AiConsentSurface) => Promise<boolean>;
}

let host: AiConsentHost | null = null;
let pendingPrompt: Promise<boolean> | null = null;
let declinedThisSession = false;

/** auth kullanıcısına bağlı önbellek — hesap değişince geçersiz. */
let cache: { authId: string; granted: boolean } | null = null;

export function registerAiConsentHost(next: AiConsentHost | null): void {
  host = next;
}

async function currentAuthId(): Promise<string | null> {
  // getSession yerel okur (ağ yok); LLM çağrıları zaten oturum ister.
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    Sentry.captureException(error, { tags: { component: 'aiConsent', flow: 'session' } });
    return null;
  }
  return data.session?.user.id ?? null;
}

function isGranted(row: { ai_consent_at: string | null; ai_consent_version: number | null }): boolean {
  return (
    row.ai_consent_at !== null &&
    row.ai_consent_version !== null &&
    row.ai_consent_version >= AI_CONSENT_VERSION
  );
}

/**
 * Sessiz okuma — sheet AÇMAZ. Okunamazsa `false` (fail-closed: rıza
 * doğrulanamadan LLM'e veri gitmez) ve hata Sentry'ye yazılır.
 */
export async function hasAiConsent(): Promise<boolean> {
  const authId = await currentAuthId();
  if (authId === null) return false;
  if (cache !== null && cache.authId === authId) return cache.granted;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('ai_consent_at, ai_consent_version')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) {
      Sentry.captureException(error, { tags: { component: 'aiConsent', flow: 'read' } });
      return false;
    }
    if (data === null) {
      // public.users satırı yok (APP_USER_MISSING ile aynı durum) — rıza yok.
      Sentry.captureMessage('aiConsent: users satırı bulunamadı', {
        level: 'warning',
        tags: { component: 'aiConsent', flow: 'read' },
      });
      return false;
    }

    const granted = isGranted(data as { ai_consent_at: string | null; ai_consent_version: number | null });
    cache = { authId, granted };
    return granted;
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'aiConsent', flow: 'read' } });
    return false;
  }
}

/**
 * Rızayı yazar. Sheet "Kabul"unda çağrılır; başarısızsa sheet açık kalır ve
 * kullanıcı tekrar deneyebilir. 0 satır güncellendiyse başarı SAYILMAZ.
 */
export async function recordAiConsent(): Promise<AiConsentWriteResult> {
  try {
    const authId = await currentAuthId();
    if (authId === null) {
      Sentry.captureMessage('aiConsent: rıza yazılamadı — oturum yok', {
        level: 'error',
        tags: { component: 'aiConsent', flow: 'write' },
      });
      return { ok: false };
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        ai_consent_at: new Date().toISOString(),
        ai_consent_version: AI_CONSENT_VERSION,
      })
      .eq('auth_id', authId)
      .select('id');

    if (error) {
      Sentry.captureException(error, { tags: { component: 'aiConsent', flow: 'write' } });
      return { ok: false };
    }
    if (!data || data.length !== 1) {
      Sentry.captureMessage('aiConsent: rıza UPDATE beklenen 1 satırı etkilemedi', {
        level: 'error',
        tags: { component: 'aiConsent', flow: 'write' },
        extra: { affected_rows: data?.length ?? 0 },
      });
      return { ok: false };
    }

    cache = { authId, granted: true };
    declinedThisSession = false;
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'aiConsent', flow: 'write' } });
    return { ok: false };
  }
}

/**
 * Rızayı geri çeker (Settings anahtarı kapanınca). Başarılıysa `true`.
 * 0 satır güncellendiyse başarı SAYILMAZ.
 */
export async function revokeAiConsent(): Promise<boolean> {
  try {
    const authId = await currentAuthId();
    if (authId === null) {
      Sentry.captureMessage('aiConsent: rıza geri çekilemedi — oturum yok', {
        level: 'error',
        tags: { component: 'aiConsent', flow: 'revoke' },
      });
      return false;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ ai_consent_at: null, ai_consent_version: null })
      .eq('auth_id', authId)
      .select('id');

    if (error) {
      Sentry.captureException(error, { tags: { component: 'aiConsent', flow: 'revoke' } });
      return false;
    }
    if (!data || data.length !== 1) {
      Sentry.captureMessage('aiConsent: geri çekme UPDATE beklenen 1 satırı etkilemedi', {
        level: 'error',
        tags: { component: 'aiConsent', flow: 'revoke' },
        extra: { affected_rows: data?.length ?? 0 },
      });
      return false;
    }

    cache = { authId, granted: false };
    posthogAnalytics.track('ai_consent_revoked');
    return true;
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'aiConsent', flow: 'revoke' } });
    return false;
  }
}

/** Sheet "Şimdi değil" — oturum belleğine yazılır, kalıcı değil. */
export function recordAiConsentDeclined(surface: AiConsentSurface): void {
  declinedThisSession = true;
  posthogAnalytics.track('ai_consent_declined', { surface });
}

/** Sheet kabul sonrası — analytics. (Yazma `recordAiConsent` içinde.) */
export function trackAiConsentGranted(surface: AiConsentSurface): void {
  posthogAnalytics.track('ai_consent_granted', { surface });
}

/**
 * LLM'e veri götüren eylemden ÖNCE çağrılır. `true` → devam; `false` → LLM
 * çağrısı YAPILMAZ (ret, yazma hatası ya da host yok).
 */
export async function ensureAiConsent(
  surface: AiConsentSurface,
  options: EnsureAiConsentOptions = {},
): Promise<boolean> {
  if (await hasAiConsent()) return true;

  if (declinedThisSession && options.explicit !== true) return false;

  // Aynı anda iki tetikleyici (ör. arama + rerank) tek sheet paylaşır.
  if (pendingPrompt !== null) return pendingPrompt;

  if (host === null) {
    const err = new Error('aiConsent: sheet host kayıtlı değil — rıza istenemedi');
    logger.error('[aiConsent]', err);
    Sentry.captureException(err, { tags: { component: 'aiConsent', flow: 'host_missing' } });
    return false;
  }

  posthogAnalytics.track('ai_consent_shown', { surface });
  pendingPrompt = host.show(surface).finally(() => {
    pendingPrompt = null;
  });
  return pendingPrompt;
}

/** Oturum belleğini sıfırlar — çıkış/hesap değişiminde çağrılır. */
export function resetAiConsentSession(): void {
  cache = null;
  declinedThisSession = false;
}

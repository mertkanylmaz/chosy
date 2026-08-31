/**
 * User Flags — tek seferlik yüzeylerin "gösterildi mi" durumu (R-A-2).
 *
 * İki bayrak, migration 103 (`public.users`):
 *   · has_seen_relaunch_intro → E-05 "Chosy değişti" köprü ekranı
 *   · auth_prompt_seen        → K-13 auth prompt sheet'i
 *
 * ── Neden DB, neden AsyncStorage değil ─────────────────────────────────────
 * E-08 kararı. AsyncStorage cihaz-yereldir: yeniden kurulumda sıfırlanır ve
 * kullanıcı köprü ekranını ikinci kez görürdü. Bayraklar `auth_id` üzerinden
 * yazılır; RLS yolu "users: self update" (001:147) ile zaten açıktır.
 *
 * ── E-08 kesişimi (bilinen ve kabul edilen) ────────────────────────────────
 * Sessiz kimlik sıfırlaması olursa (refresh token iptali / cold-start restore
 * hatası) yeni `auth_id` yeni bir `public.users` satırı açar ve iki bayrak da
 * DEFAULT false döner. Sonuç, iki yüzey için FARKLIDIR:
 *
 *   · Köprü ekranı TEKRAR GÖSTERİLMEZ. Yeni satır 090'ın kesme anından
 *     (2026-08-17 15:30+00) sonra oluştuğu için `legacy_mood_access = false`
 *     olur ve gate'teki kohort koşulu tutmaz. Kullanıcı Home'a düşer.
 *   · Auth prompt bir kez DAHA gösterilir (anonim + bayrak false). Bu KABUL
 *     EDİLEBİLİR, hatta doğru davranıştır: kimliğini kaybetmiş kullanıcıya
 *     onu kalıcılaştırma yolunu göstermek istenen sonuçtur.
 *
 * Sıfırlamanın kendisi `identity_reset_detected` ile zaten ölçülüyor
 * (utils/identityReset.ts); burada ikinci bir telafi yolu kurulmaz.
 *
 * ⚠️ Bu senaryonun asıl kaybı bu iki bayrak DEĞİL, `legacy_mood_access`'in
 * kendisidir (mood search grandfathering'i düşer) — 090'ın bilinen ve
 * R-A-2 kapsamı dışındaki sonucu.
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '../utils/logger';

/** Migration 103 ile gelen tek-seferlik yüzey bayrakları */
export type UserFlagName = 'has_seen_relaunch_intro' | 'auth_prompt_seen';

/** `readUserFlags` sonucu */
export interface UserFlags {
  hasSeenRelaunchIntro: boolean;
  authPromptSeen: boolean;
  legacyMoodAccess: boolean;
}

/**
 * Oturum sahibinin bayraklarını okur.
 *
 * Okuma başarısız olursa `null` döner — çağıran taraf bunu "bilmiyorum"
 * olarak yorumlar ve tek seferlik yüzeyi GÖSTERMEZ (fail-closed). Sessiz
 * fallback değil: hata Sentry'ye yazılır.
 */
export async function readUserFlags(): Promise<UserFlags | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('has_seen_relaunch_intro, auth_prompt_seen, legacy_mood_access')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('[userFlags] okuma hatası:', error.message);
      Sentry.captureMessage(`readUserFlags: ${error.message}`, {
        level: 'error',
        tags: { function: 'readUserFlags', error_code: 'USER_FLAGS_READ_FAILED' },
        extra: { pg_code: error.code },
      });
      return null;
    }

    // Satır yok → bootstrap henüz tamamlanmadı (ensureAppUser). Hata değil,
    // ama bayrak da bilinmiyor: fail-closed.
    if (!data) return null;

    return {
      hasSeenRelaunchIntro: data.has_seen_relaunch_intro === true,
      authPromptSeen: data.auth_prompt_seen === true,
      legacyMoodAccess: data.legacy_mood_access === true,
    };
  } catch (err) {
    logger.error('[userFlags] beklenmedik okuma hatası:', err);
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'readUserFlags', error_code: 'USER_FLAGS_READ_FAILED' },
    });
    return null;
  }
}

/**
 * Bir bayrağı kalıcı olarak true yapar.
 *
 * Yazma başarısız olursa `false` döner ve Sentry'ye yazılır. Çağıran taraf
 * akışı ENGELLEMEZ (kullanıcı sheet'i kapattıysa kapanmalıdır) — ancak
 * başarısız yazma, yüzeyin bir sonraki fırsatta tekrar görünmesi demektir.
 * Bu görünür bir sonuçtur, sessiz değildir.
 */
export async function markUserFlag(flag: UserFlagName): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Sentry.captureMessage(`markUserFlag(${flag}): oturum yok`, {
        level: 'warning',
        tags: { function: 'markUserFlag', error_code: 'USER_FLAGS_WRITE_FAILED' },
      });
      return false;
    }

    const { error } = await supabase
      .from('users')
      .update({ [flag]: true })
      .eq('auth_id', user.id);

    if (error) {
      logger.error(`[userFlags] ${flag} yazılamadı:`, error.message);
      Sentry.captureMessage(`markUserFlag(${flag}): ${error.message}`, {
        level: 'error',
        tags: { function: 'markUserFlag', error_code: 'USER_FLAGS_WRITE_FAILED' },
        extra: { pg_code: error.code },
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[userFlags] ${flag} beklenmedik yazma hatası:`, err);
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'markUserFlag', error_code: 'USER_FLAGS_WRITE_FAILED' },
      extra: { flag },
    });
    return false;
  }
}

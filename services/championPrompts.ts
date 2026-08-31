/**
 * Champion Prompts — şampiyon sonrası TEK bir istem seçer (R-A-2).
 *
 * İki tek-seferlik istem, iki farklı kilitli karar:
 *   · K-13 auth prompt       → "Save your cinema journey" (anonim kullanıcı)
 *   · K-15 bildirim izni     → "Want your four ready every evening?"
 *
 * ── Neden asla ikisi birden değil (CTO kararı, 22 Ağu 2026) ────────────────
 * Şampiyon reveal'ı §7.3'ün kasıtlı bir anı. Arkasına iki ayrı izin/karar
 * talebini art arda dizmek hem o anı zayıflatır hem de ikinci sheet'in
 * refleksle kapatılmasına yol açar — iOS bildirim izni tek atışlık olduğu
 * için bu ret KALICIDIR. Bu yüzden akşam başına EN FAZLA bir istem: auth
 * prompt görülmüşse (ya da kullanıcı zaten kayıtlıysa) sıra bildirime gelir,
 * o da bir SONRAKİ şampiyonda.
 *
 * Fail-closed: durum okunamıyorsa hiçbir şey gösterilmez. Sessiz değil —
 * okuma hatası `readUserFlags` içinde Sentry'ye yazılır.
 */

import { supabase } from './supabase';
import { readUserFlags } from './userFlags';
import { shouldAskForNotificationPermission } from './pushNotifications';
import { logger } from '../utils/logger';

/** Şampiyon sonrası gösterilecek istem — 'none' hiçbir şey gösterme. */
export type ChampionPrompt = 'none' | 'auth' | 'notification';

/**
 * Bu şampiyon reveal'ından sonra hangi istem gösterilmeli.
 *
 * Sıralama (ilk eşleşen kazanır):
 *   1. Kullanıcı anonim VE `auth_prompt_seen` false  → 'auth'
 *   2. Bildirim izni bu cihazda hiç sorulmadı        → 'notification'
 *   3. Aksi hâlde                                    → 'none'
 */
export async function resolveChampionPrompt(): Promise<ChampionPrompt> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'none';

    // `is_anonymous` yoksa güvenli varsayım anonimdir — ama bayrak okumadan
    // istem açılmaz, bir alttaki fail-closed kontrolü bunu garantiler.
    const isAnonymous = user.is_anonymous ?? true;

    if (isAnonymous) {
      const flags = await readUserFlags();
      if (!flags) return 'none'; // bilinmiyor → gösterme
      if (!flags.authPromptSeen) return 'auth';
    }

    if (await shouldAskForNotificationPermission()) return 'notification';

    return 'none';
  } catch (err) {
    logger.warn('[championPrompts] istem çözümlenemedi:', err);
    return 'none';
  }
}

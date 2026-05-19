/**
 * Gamification servisi — Streak takibi, milestone kontrolü ve ödül sistemi.
 *
 * Supabase RPC fonksiyonları üzerinden çalışır:
 *   - update_streak(p_user_id)    → streak güncelle + streak milestone kontrolü
 *   - check_milestones(p_user_id) → film/watchlist/mood milestone kontrolü
 *
 * Kullanım:
 *   - Her swipe sonrası: recordActivity(userId)
 *   - Profil ekranında: getStreakInfo(userId), getUserMilestones(userId)
 *   - Kutlama sonrası: markMilestoneSeen(milestoneId)
 */

import { supabase } from './supabase';
import { getAppUserId } from './watchlist';
import { earnSlotToken } from './slotService';
import { logger } from '../utils/logger';

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Kullanıcının streak durumu */
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

/** Sistem tanımlı milestone */
export interface Milestone {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: 'films' | 'streak' | 'watchlist' | 'mood';
  threshold: number;
  icon: string | null;
}

/** Kullanıcının kazandığı milestone */
export interface UserMilestone {
  id: string;
  milestone: Milestone;
  achievedAt: string;
  seen: boolean;
}

/** Yeni kazanılan milestone bildirimi */
export interface NewMilestoneNotification {
  slug: string;
  title: string;
  icon: string | null;
}

/** recordActivity sonucu */
export interface ActivityResult {
  streakUpdated: boolean;
  currentStreak: number;
  longestStreak: number;
  newMilestones: NewMilestoneNotification[];
}

// ─── Ana Fonksiyonlar ────────────────────────────────────────────────────────

/**
 * Bir swipe/etkileşim sonrası streak ve milestone güncellemesi yapar.
 * Hem streak RPC'si hem milestone RPC'si paralel çağrılır.
 *
 * @returns Streak durumu + yeni kazanılan milestone'lar
 */
export async function recordActivity(): Promise<ActivityResult | null> {
  try {
    const userId = await getAppUserId();
    if (!userId) return null;

    // Streak ve milestone kontrolünü paralel yap
    const [streakResult, milestoneResult] = await Promise.all([
      supabase.rpc('update_streak', { p_user_id: userId }),
      supabase.rpc('check_milestones', { p_user_id: userId }),
    ]);

    if (streakResult.error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[gamification] update_streak hatası:', streakResult.error.message);
      }
      return null;
    }

    // Streak ve milestone sonuçlarından yeni milestone'ları birleştir
    const streakData = streakResult.data as {
      streak_updated: boolean;
      current_streak: number;
      longest_streak: number;
      total_active_days?: number;
      new_milestones: Array<{ slug: string; title: string; icon: string | null }>;
    };

    const milestoneData = milestoneResult.data as {
      new_milestones: Array<{ slug: string; title: string; icon: string | null }>;
    } | null;

    // Her iki kaynaktan gelen yeni milestone'ları birleştir
    const allNewMilestones: NewMilestoneNotification[] = [
      ...(streakData.new_milestones ?? []),
      ...(milestoneData?.new_milestones ?? []),
    ];

    const currentStreak = streakData.current_streak ?? 0;

    // ── Streak-based slot token earning (fire-and-forget) ──
    // 3 gunluk streak: +1 token, 7 gunluk streak: +2 token
    if (streakData.streak_updated && userId) {
      if (currentStreak === 7 || (currentStreak > 0 && currentStreak % 7 === 0)) {
        earnSlotToken(userId, 2, 'daily_login_7').catch(() => {
          // Token hatasi onemsiz
        });
        logger.log(`[gamification] 7-day streak token earned! streak=${currentStreak}`);
      } else if (currentStreak === 3 || (currentStreak > 0 && currentStreak % 3 === 0 && currentStreak % 7 !== 0)) {
        earnSlotToken(userId, 1, 'streak_3day').catch(() => {
          // Token hatasi onemsiz
        });
        logger.log(`[gamification] 3-day streak token earned! streak=${currentStreak}`);
      }

      // ── Streak reward grants (bonus searches + notifications) ──
      // Fire-and-forget: RPC checks if a reward exists for this streak day
      void (async () => {
        try {
          const { data } = await supabase.rpc('grant_streak_rewards', {
            p_user_id: userId,
            p_streak_days: currentStreak,
          });
          if (data && (data as { bonus_searches: number }).bonus_searches > 0) {
            logger.log(`[gamification] Streak reward granted! streak=${currentStreak}`, data);
          }
        } catch {
          // Non-critical — reward will be retried next activity
        }
      })();
    }

    return {
      streakUpdated: streakData.streak_updated,
      currentStreak,
      longestStreak: streakData.longest_streak ?? 0,
      newMilestones: allNewMilestones,
    };
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[gamification] recordActivity beklenmedik hata:', err);
    }
    return null;
  }
}

/**
 * Kullanıcının güncel streak bilgisini döner.
 * Profil ekranında kullanılır.
 */
export async function getStreakInfo(): Promise<StreakInfo | null> {
  try {
    const userId = await getAppUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('user_streaks')
      .select('current_streak, longest_streak, total_active_days, last_active_date')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Kayıt yoksa henüz hiç streak yok
      if (error?.code === 'PGRST116') {
        return {
          currentStreak: 0,
          longestStreak: 0,
          totalActiveDays: 0,
          lastActiveDate: null,
        };
      }
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[gamification] getStreakInfo hatası:', error?.message);
      }
      return null;
    }

    return {
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      totalActiveDays: data.total_active_days,
      lastActiveDate: data.last_active_date,
    };
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[gamification] getStreakInfo beklenmedik hata:', err);
    }
    return null;
  }
}

/**
 * Kullanıcının kazandığı tüm milestone'ları döner.
 * Profil ekranında ve milestone list view'da kullanılır.
 */
export async function getUserMilestones(): Promise<UserMilestone[]> {
  try {
    const userId = await getAppUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('user_milestones')
      .select(`
        id,
        achieved_at,
        seen,
        milestones (
          id,
          slug,
          title,
          description,
          category,
          threshold,
          icon
        )
      `)
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });

    if (error || !data) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[gamification] getUserMilestones hatası:', error?.message);
      }
      return [];
    }

    return (data as unknown as Array<{
      id: string;
      achieved_at: string;
      seen: boolean;
      milestones: {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        category: string;
        threshold: number;
        icon: string | null;
      };
    }>)
      .filter((row) => row.milestones)
      .map((row) => ({
        id: row.id,
        milestone: {
          id: row.milestones.id,
          slug: row.milestones.slug,
          title: row.milestones.title,
          description: row.milestones.description,
          category: row.milestones.category as Milestone['category'],
          threshold: row.milestones.threshold,
          icon: row.milestones.icon,
        },
        achievedAt: row.achieved_at,
        seen: row.seen,
      }));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[gamification] getUserMilestones beklenmedik hata:', err);
    }
    return [];
  }
}

/**
 * Görülmemiş milestone'ları döner (kutlama göstermek için).
 * Feed veya profil ekranında "new milestone!" banner'ı tetikler.
 */
export async function getUnseenMilestones(): Promise<UserMilestone[]> {
  const all = await getUserMilestones();
  return all.filter((m) => !m.seen);
}

/**
 * Bir milestone'u "görüldü" olarak işaretler.
 * Kutlama animasyonu gösterildikten sonra çağrılır.
 *
 * @param userMilestoneId - user_milestones tablosundaki ID
 */
export async function markMilestoneSeen(userMilestoneId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_milestones')
      .update({ seen: true })
      .eq('id', userMilestoneId);

    if (__DEV__ && error) {
      // eslint-disable-next-line no-console
      console.error('[gamification] markMilestoneSeen hatası:', error.message);
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[gamification] markMilestoneSeen beklenmedik hata:', err);
    }
  }
}

/**
 * Tüm milestone tanımlarını döner (kazanılmış veya değil).
 * "Achievements" sayfasında tüm listeyi göstermek için.
 */
export async function getAllMilestones(): Promise<Milestone[]> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .order('category')
      .order('threshold');

    if (error || !data) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[gamification] getAllMilestones hatası:', error?.message);
      }
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      description: row.description as string | null,
      category: row.category as Milestone['category'],
      threshold: row.threshold as number,
      icon: row.icon as string | null,
    }));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[gamification] getAllMilestones beklenmedik hata:', err);
    }
    return [];
  }
}

declare const __DEV__: boolean;

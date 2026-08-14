/**
 * Geri Bildirim Servisi
 *
 * İzlenen filmlere yıldız puanı ve "öneri isabetli miydi?" sorusunu kaydeder.
 * Kaydedilen geri bildirime göre kullanıcı tercih vektörünü günceller.
 *
 * Kullanım:
 *   - İzleme sonrası: saveFeedback(payload)
 *   - Vektör güncelleme: updateProfileFromFeedback(userId)
 */

import { supabase } from './supabase';
import { VECTOR_DIM } from './vectorEncoder';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface FeedbackPayload {
  userId: string;
  filmId: string;
  /** 1-5 yıldız */
  starRating: number;
  /** "Öneri isabetli miydi?" */
  onPoint: boolean;
}

interface FeedbackRow {
  film_id: string;
  star_rating: number;
  on_point: boolean;
  created_at: string;
}

interface FilmProfileRow {
  film_id: string;
  profile_vector: number[];
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Yıldız puanı ve isabetlilik bilgisine göre feedback ağırlığı döndürür.
 * Pozitif değerler = film vektörüne yaklaş; negatif = uzaklaş.
 *
 * @param starRating - 1-5 arası puan
 * @param onPoint    - Öneri isabetliydi mi?
 * @returns Ağırlık değeri
 */
function computeFeedbackWeight(starRating: number, onPoint: boolean): number {
  if (starRating >= 4 && onPoint) return starRating === 5 ? 3.0 : 2.0;
  if (starRating === 3 || (starRating >= 4 && !onPoint)) return 0.5;
  return -1.0; // 1-2 yıldız veya isabetsiz
}

// ─── Ana Fonksiyonlar ─────────────────────────────────────────────────────────

/**
 * Geri bildirimi `feedback` tablosuna kaydeder ve
 * watchlist'teki `watched_at` alanını günceller.
 *
 * Aynı (user_id, film_id) çifti için tekrar kaydedilirse üzerine yazar (upsert).
 *
 * @param payload - userId, filmId, starRating, onPoint
 */
export async function saveFeedback(payload: FeedbackPayload): Promise<void> {
  const { userId, filmId, starRating, onPoint } = payload;

  try {
    // feedback tablosuna kaydet (varsa güncelle)
    const { error: fbError } = await supabase
      .from('feedback')
      .upsert(
        {
          user_id: userId,
          film_id: filmId,
          star_rating: starRating,
          on_point: onPoint,
        },
        { onConflict: 'user_id,film_id' },
      );

    if (fbError) throw fbError;

    // watchlist'te izlenme zamanını işaretle — yalnızca henüz işaretlenmemişse.
    // Dolu watched_at bugünün tarihiyle ezilirse gerçek izleme tarihi geri
    // getirilemez (bkz. submit-choice/index.ts aynı koruma).
    const { error: wlError } = await supabase
      .from('watchlist')
      .update({ watched_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('film_id', filmId)
      .is('watched_at', null);

    if (wlError) throw wlError;
  } catch (err) {
    if (__DEV__) {
      console.error('[feedback] saveFeedback hatası:', err);
    }
    throw err;
  }
}

/**
 * Kullanıcının tüm feedback kayıtlarını kullanarak `preferences_vector`'ü günceller.
 *
 * Algoritma — Gradient Nudge:
 *   Her feedback için film vektörüne doğru (pozitif) veya
 *   film vektöründen uzağa (negatif) küçük adımlarla ilerler.
 *   Adım büyüklüğü: alpha = |weight| × 0.12
 *
 *   Ağırlık tablosu:
 *     5 yıldız + isabetli  → +3.0
 *     4 yıldız + isabetli  → +2.0
 *     3 yıldız veya karışık → +0.5
 *     1-2 yıldız / isabetsiz → -1.0
 *
 * @param userId - users tablosundaki dahili UUID
 */
export async function updateProfileFromFeedback(userId: string): Promise<void> {
  try {
    // 1. Mevcut preferences_vector'ü al
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('preferences_vector')
      .eq('id', userId)
      .single();

    if (userError) throw userError;
    if (!userRow?.preferences_vector) return;

    const currentVector: number[] = [...userRow.preferences_vector];

    // 2. Kullanıcının tüm feedback'lerini getir
    const { data: feedbacks, error: fbError } = await supabase
      .from('feedback')
      .select('film_id, star_rating, on_point, created_at')
      .eq('user_id', userId);

    if (fbError) throw fbError;
    if (!feedbacks || feedbacks.length === 0) return;

    const typedFeedbacks = feedbacks as FeedbackRow[];
    const filmIds = typedFeedbacks.map((f) => f.film_id);

    // 3. Film profil vektörlerini getir
    const { data: profiles, error: profileError } = await supabase
      .from('film_profiles')
      .select('film_id, profile_vector')
      .in('film_id', filmIds)
      .not('profile_vector', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) return;

    const typedProfiles = profiles as FilmProfileRow[];
    const vectorMap = new Map<string, number[]>(
      typedProfiles.map((p) => [p.film_id, p.profile_vector]),
    );

    // 4. Her feedback için gradient nudge uygula
    let updatedVector = [...currentVector];

    for (const fb of typedFeedbacks) {
      const filmVector = vectorMap.get(fb.film_id);
      if (!filmVector) continue;

      const weight = computeFeedbackWeight(fb.star_rating, fb.on_point);
      const alpha = Math.abs(weight) * 0.12;

      if (weight > 0) {
        // Pozitif: film vektörüne yaklaş
        for (let i = 0; i < VECTOR_DIM; i++) {
          updatedVector[i] = updatedVector[i] + alpha * (filmVector[i] - updatedVector[i]);
        }
      } else {
        // Negatif: film vektöründen uzaklaş
        for (let i = 0; i < VECTOR_DIM; i++) {
          updatedVector[i] = updatedVector[i] - alpha * (filmVector[i] - updatedVector[i]);
        }
      }
    }

    // 5. Güncellenen vektörü kaydet
    const { error: updateError } = await supabase
      .from('users')
      .update({ preferences_vector: updatedVector })
      .eq('id', userId);

    if (updateError) throw updateError;
  } catch (err) {
    if (__DEV__) {
      console.error('[feedback] updateProfileFromFeedback hatası:', err);
    }
    throw err;
  }
}

declare const __DEV__: boolean;

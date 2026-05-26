/**
 * Kullanıcı tercih vektörü yönetimi
 *
 * Swipe verilerinden kullanıcı tercih vektörü hesaplar ve
 * users tablosundaki preferences_vector'ü günceller.
 *
 * Kullanım:
 *   - Swipe sonrası: updateUserPreferenceVector(userId)
 *   - Onboarding cold-start (kalibrasyon): initUserPreferenceFromCalibration(userId, profile)
 *   - Onboarding cold-start (favoriler): initUserPreferenceFromFavorites(userId, filmIds)
 */

import { supabase } from './supabase';
import { VECTOR_DIM, tasteProfileToVector } from './vectorEncoder';
import type { TasteProfile } from '../types';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Zaman bazlı decay yarılanma süresi (gün). 14 günden eski swipe'ların ağırlığı yarıya iner. */
const DECAY_HALF_LIFE_DAYS = 14;

/** Öneri endpoint'indeki hybrid scoring ağırlıkları */
export const SCORE_WEIGHTS = {
  taste: 0.7,
  preference: 0.3,
} as const;

/** Kullanıcı etkileşim türleri */
export type UserAction = 'save' | 'skip' | 'view' | 'remove';

/**
 * Her etkileşim türünün tercih vektörüne etkisi.
 * Pozitif: filmi beğendi → o tarafa yönelen vektör.
 * Negatif: filmi istemedi → o yönden uzaklaşan vektör.
 */
const ACTION_WEIGHTS: Record<UserAction, number> = {
  save: 1.0,
  skip: -0.3,
  view: 0.5,
  remove: -0.5,
};

// ─── Yerel Tipler ─────────────────────────────────────────────────────────────

interface UserVectorRow {
  preferences_vector: number[] | null;
}

interface SwipeWithSession {
  film_id: string;
  timestamp: string;
  sessions: { user_id: string };
}

interface FilmProfileRow {
  film_id: string;
  profile_vector: number[];
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * Zaman bazlı exponential decay ağırlığı hesaplar.
 * Formül: weight = 0.5 ^ (ageDays / DECAY_HALF_LIFE_DAYS)
 *
 * Örnek:
 *   - 0 gün önce  → weight ≈ 1.00
 *   - 14 gün önce → weight ≈ 0.50
 *   - 28 gün önce → weight ≈ 0.25
 *
 * @param timestamp - Swipe'ın ISO 8601 timestamp'i
 * @returns [0, 1] aralığında ağırlık
 */
function computeDecayWeight(timestamp: string): number {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
}

/**
 * Verilen (vektör, ağırlık) çiftlerinin ağırlıklı ortalamasını hesaplar.
 *
 * @param vectors - { vector, weight } çiftlerinin listesi
 * @returns VECTOR_DIM (384) boyutunda normalize edilmiş vektör
 */
function weightedAverageVector(
  vectors: Array<{ vector: number[]; weight: number }>,
): number[] {
  const result = new Array<number>(VECTOR_DIM).fill(0);
  let totalWeight = 0;

  for (const { vector, weight } of vectors) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      result[i] += vector[i] * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight === 0) return result;

  for (let i = 0; i < VECTOR_DIM; i++) {
    result[i] /= totalWeight;
  }

  return result;
}

// ─── Vektör Parse Yardımcısı ─────────────────────────────────────────────────

/**
 * Supabase'den gelen ham vektör değerini number[] tipine çevirir.
 * Değer zaten dizi ise doğrudan döner; string ise JSON.parse ile açar.
 *
 * @param raw - Supabase'den gelen preferences_vector veya profile_vector
 * @returns number[] veya null (parse edilemezse / boşsa)
 */
function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

// ─── EMA Tabanlı Anlık Güncelleme ────────────────────────────────────────────

/**
 * Bir swipe sonrası kullanıcının preferences_vector'ünü günceller.
 *
 * Algoritma:
 *   - Mevcut vektör varsa: newVector = 0.8 * current + 0.2 * filmVector
 *   - Soğuk başlangıç (preferences_vector NULL): filmVector doğrudan atanır
 *
 * @param userId - users tablosundaki dahili UUID
 * @param filmId - film_profiles tablosundaki film UUID
 */
export async function updateUserVector(
  userId: string,
  filmId: string,
): Promise<void> {
  try {
    const [{ data: userData }, { data: filmData }] = await Promise.all([
      supabase.from('users').select('preferences_vector').eq('id', userId).single(),
      supabase.from('film_profiles').select('profile_vector').eq('film_id', filmId).single(),
    ]);

    const filmVector = parseVector(filmData?.profile_vector);
    if (!filmVector) return;

    const currentVector = parseVector(userData?.preferences_vector);

    let newVector: number[];
    if (!currentVector) {
      // Soğuk başlangıç — film vektörünü doğrudan ata
      newVector = filmVector;
    } else {
      // Ağırlıklı ortalama: %80 mevcut + %20 yeni film
      newVector = currentVector.map((val, i) => 0.8 * val + 0.2 * (filmVector[i] ?? 0));
    }

    await supabase
      .from('users')
      .update({ preferences_vector: JSON.stringify(newVector) })
      .eq('id', userId);

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[userProfile] Vector updated for user:', userId);
    }
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[userProfile] updateUserVector hatası:', msg, err);
    }
    // Hata dışarıya yayılmaz — arka plan güncelleme, uygulama çökmemeli
  }
}

// ─── Ana Fonksiyonlar ─────────────────────────────────────────────────────────

/**
 * Kullanıcının sağa kaydırdığı filmlerden tercih vektörü hesaplar ve
 * users tablosundaki preferences_vector'ü günceller.
 *
 * Algoritma:
 *   1. sessions JOIN üzerinden kullanıcıya ait sağa kaydırılan swipe'ları çek
 *   2. İlgili film profil vektörlerini çek
 *   3. Her swipe'a timestamp bazlı exponential decay ağırlığı uygula
 *      (son oturumlar daha ağır)
 *   4. Ağırlıklı ortalama vektörü hesapla
 *   5. users tablosundaki preferences_vector'ü güncelle
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns Hesaplanan preferences_vector, yeterli swipe yoksa null
 */
export async function updateUserPreferenceVector(
  userId: string,
): Promise<number[] | null> {
  try {
    // 1. Kullanıcıya ait sağa kaydırılan swipe'ları getir (sessions JOIN)
    const { data: swipes, error: swipeError } = await supabase
      .from('swipes')
      .select('film_id, timestamp, sessions!inner(user_id)')
      .eq('direction', 'right')
      .eq('sessions.user_id', userId);

    if (swipeError) throw swipeError;
    if (!swipes || swipes.length === 0) return null;

    const typedSwipes = swipes as unknown as SwipeWithSession[];

    // 2. Eşsiz film ID'lerini topla
    const filmIds = [...new Set(typedSwipes.map((s) => s.film_id))];

    // 3. Film profil vektörlerini getir
    const { data: profiles, error: profileError } = await supabase
      .from('film_profiles')
      .select('film_id, profile_vector')
      .in('film_id', filmIds)
      .not('profile_vector', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) return null;

    const typedProfiles = profiles as FilmProfileRow[];
    const vectorMap = new Map<string, number[]>(
      typedProfiles
        .map((p) => [p.film_id, parseVector(p.profile_vector)] as [string, number[] | null])
        .filter((entry): entry is [string, number[]] => entry[1] !== null),
    );

    // 4. Her swipe için (vector, decayWeight) çiftleri oluştur
    const weightedVectors: Array<{ vector: number[]; weight: number }> = [];
    for (const swipe of typedSwipes) {
      const vector = vectorMap.get(swipe.film_id);
      if (!vector) continue;
      const weight = computeDecayWeight(swipe.timestamp);
      weightedVectors.push({ vector, weight });
    }

    if (weightedVectors.length === 0) return null;

    // 5. Ağırlıklı ortalama hesapla
    const prefVector = weightedAverageVector(weightedVectors);

    // 6. users tablosunu güncelle
    const { error: updateError } = await supabase
      .from('users')
      .update({ preferences_vector: prefVector })
      .eq('id', userId);

    if (updateError) throw updateError;

    return prefVector;
  } catch (err) {
    if (__DEV__) {
      console.error('[userProfile] updateUserPreferenceVector hatası:', err);
    }
    return null;
  }
}

/**
 * Cold-start: Onboarding sırasında seçilen favori filmlerden
 * başlangıç preferences_vector'ü oluşturur.
 *
 * Yeni kullanıcıların swipe geçmişi olmadığı için onboarding'de
 * 3 favori film sorulur. Bu filmlerin profil vektörlerinin eşit
 * ağırlıklı ortalaması başlangıç tercihi olarak kaydedilir.
 *
 * Swipe verisi birikince updateUserPreferenceVector çağrısı ile üzerine yazılır.
 *
 * @param userId  - users tablosundaki dahili UUID
 * @param filmIds - Seçilen favori filmlerin ID listesi (en az 1, önerilen 3)
 * @returns Oluşturulan preferences_vector veya null (profil vektörü bulunamadıysa)
 */
export async function initUserPreferenceFromFavorites(
  userId: string,
  filmIds: string[],
): Promise<number[] | null> {
  if (filmIds.length === 0) return null;

  try {
    const { data: profiles, error: profileError } = await supabase
      .from('film_profiles')
      .select('film_id, profile_vector')
      .in('film_id', filmIds)
      .not('profile_vector', 'is', null);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) return null;

    const typedProfiles = profiles as FilmProfileRow[];

    // Eşit ağırlıklı ortalama — cold-start'ta tüm filmler eşdeğer
    const weightedVectors = typedProfiles
      .map((p) => ({ vector: parseVector(p.profile_vector), weight: 1.0 }))
      .filter((entry): entry is { vector: number[]; weight: number } => entry.vector !== null);

    const prefVector = weightedAverageVector(weightedVectors);

    const { error: updateError } = await supabase
      .from('users')
      .update({ preferences_vector: prefVector })
      .eq('id', userId);

    if (updateError) throw updateError;

    return prefVector;
  } catch (err) {
    if (__DEV__) {
      console.error('[userProfile] initUserPreferenceFromFavorites hatası:', err);
    }
    return null;
  }
}

// ─── P8.2: Kalibrasyon Cold-Start ────────────────────────────────────────────

/**
 * Onboarding Taste Calibration tamamlandıktan hemen sonra kullanıcının
 * preferences_vector'ünü başlangıç değeriyle doldurur.
 *
 * Neden gerekli:
 *   - Yeni kullanıcıların preferences_vector = NULL olduğundan getSurprisePicks
 *     hiçbir zaman çalışmıyordu (cold-start sorunu).
 *   - Kalibrasyon TasteProfile'ı 384 boyutlu vektöre çevrilip DB'ye yazılarak
 *     ilk mood session'dan önce bile kişiselleştirilmiş öneri akışı başlar.
 *
 * İlk swipe sonrası updateUserVector EMA ile üstüne yazar; bu değer silinmez.
 *
 * @param userId  - users tablosundaki dahili UUID (getAppUserId ile alınmalı)
 * @param profile - buildCalibrationProfile ile üretilen TasteProfile
 */
export async function initUserPreferenceFromCalibration(
  userId: string,
  profile: TasteProfile,
): Promise<void> {
  const vector = tasteProfileToVector(profile);

  const { error } = await supabase
    .from('users')
    .update({ preferences_vector: JSON.stringify(vector) })
    .eq('id', userId);

  if (error) {
    // Hata firlatilir — cagiran taraf (onboarding) offline queue'ya ekleyebilir
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[userProfile] initUserPreferenceFromCalibration hata:', error.message);
    }
    throw new Error(`[userProfile] calibration vector write failed: ${error.message}`);
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      '[userProfile] Kalibrasyon vektörü kaydedildi:',
      `userId=${userId}`,
      `vektör boyutu=${vector.length}`,
    );
  }
}

declare const __DEV__: boolean;

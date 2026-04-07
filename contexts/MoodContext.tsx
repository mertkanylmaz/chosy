/**
 * Mood analiz sonucunu ve filtrelerini ekranlar arası paylaşan context.
 * Feed ekranı buradan profil okur, Mood ekranı buraya yazar.
 *
 * P7.1: lastMoodText + lastSessionFilms eklendi — Home Header LastSessionCard için.
 * In-memory only (restart'ta sıfırlanır) — P7.x'te AsyncStorage persist edilebilir.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

import { FilmFilters, TasteProfile } from '@/types';
import type { Film } from '@/types/film';

interface MoodState {
  /** AI tarafından ayrıştırılmış 12 boyutlu profil; null ise feed boş görünür */
  currentProfile: TasteProfile | null;
  /** Kullanıcının seçtiği filtreler */
  currentFilters: FilmFilters | null;
  /** Entry ekranından mood input'una aktarılacak ön doldurma metni */
  presetMoodText: string | null;
  /**
   * Supabase sessions tablosundaki aktif session UUID'si.
   * Watchlist'e eklenen filmlerin hangi mood prompt'undan geldiğini izler.
   * null = henüz session oluşturulmadı veya film detay sayfasından eklendi.
   */
  currentSessionId: string | null;
  /**
   * Son session'da kullanıcının girdiği ham mood metni.
   * Home Header'daki LastSessionCard için. clearMood() ile sıfırlanmaz.
   */
  lastMoodText: string | null;
  /**
   * Son session'da sağa swipe edilen filmler (watchlist'e eklenenler).
   * Home Header'daki LastSessionCard için. Yeni session başlayınca sıfırlanır.
   */
  lastSessionFilms: Film[];
  /** Yeni mood analizi tamamlandığında çağrılır */
  setMoodResult: (profile: TasteProfile, filters: FilmFilters) => void;
  /** Mevcut mood temizlenir (yeni mood başlatıldığında) */
  clearMood: () => void;
  /** Mood input'una ön doldurma metni set eder */
  setPresetMoodText: (text: string | null) => void;
  /** Aktif session ID'yi set eder — mood parsedıktan sonra çağrılır */
  setCurrentSessionId: (id: string | null) => void;
  /** Son session'ın ham mood metnini kaydeder — LastSessionCard için */
  setLastMoodText: (text: string) => void;
  /** Sağa swipe edilen filmi son session listesine ekler — max 5 film tutulur */
  addLastSessionFilm: (film: Film) => void;
}

const MoodContext = createContext<MoodState | null>(null);

/**
 * Global mood state'ini sağlar. app/_layout.tsx'te sarılmalıdır.
 */
export function MoodProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState<TasteProfile | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FilmFilters | null>(null);
  const [presetMoodText, setPresetMoodTextState] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [lastMoodText, setLastMoodTextState] = useState<string | null>(null);
  const [lastSessionFilms, setLastSessionFilms] = useState<Film[]>([]);

  /**
   * Yeni mood sonucu gelince profil + filtreler güncellenir.
   * lastSessionFilms sıfırlanır (yeni session başladı).
   * lastMoodText KORUNUR — clearMood'da da korunur (LastSessionCard için).
   */
  const setMoodResult = useCallback((profile: TasteProfile, filters: FilmFilters) => {
    setCurrentProfile(profile);
    setCurrentFilters(filters);
    setLastSessionFilms([]);
  }, []);

  /**
   * Feed'den ayrılmak ya da "New Mood" basmak için profili temizler.
   * lastMoodText ve lastSessionFilms KORUNUR (LastSessionCard görünsün).
   */
  const clearMood = useCallback(() => {
    setCurrentProfile(null);
    setCurrentFilters(null);
    setCurrentSessionIdState(null);
  }, []);

  const setPresetMoodText = useCallback((text: string | null) => {
    setPresetMoodTextState(text);
  }, []);

  const setCurrentSessionId = useCallback((id: string | null) => {
    setCurrentSessionIdState(id);
  }, []);

  /** Son session'ın ham mood metnini kaydeder. mood.tsx'den çağrılır. */
  const setLastMoodText = useCallback((text: string) => {
    setLastMoodTextState(text);
  }, []);

  /**
   * Sağa swipe edilen filmi son session listesine ekler.
   * Max 5 film tutulur — LastSessionCard en fazla 3 gösterir.
   */
  const addLastSessionFilm = useCallback((film: Film) => {
    setLastSessionFilms((prev) => {
      if (prev.find((f) => f.id === film.id)) return prev;
      return [...prev, film].slice(0, 5);
    });
  }, []);

  return (
    <MoodContext.Provider
      value={{
        currentProfile,
        currentFilters,
        presetMoodText,
        currentSessionId,
        lastMoodText,
        lastSessionFilms,
        setMoodResult,
        clearMood,
        setPresetMoodText,
        setCurrentSessionId,
        setLastMoodText,
        addLastSessionFilm,
      }}
    >
      {children}
    </MoodContext.Provider>
  );
}

/**
 * MoodContext'e erişim hook'u.
 */
export function useMood(): MoodState {
  const ctx = useContext(MoodContext);
  if (!ctx) throw new Error('useMood must be used within MoodProvider');
  return ctx;
}

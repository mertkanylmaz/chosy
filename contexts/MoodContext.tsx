/**
 * Mood analiz sonucunu ve filtrelerini ekranlar arası paylaşan context.
 * Feed ekranı buradan profil okur, Mood ekranı buraya yazar.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';

import { FilmFilters, TasteProfile } from '@/types';

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
  /** Yeni mood analizi tamamlandığında çağrılır */
  setMoodResult: (profile: TasteProfile, filters: FilmFilters) => void;
  /** Mevcut mood temizlenir (yeni mood başlatıldığında) */
  clearMood: () => void;
  /** Mood input'una ön doldurma metni set eder */
  setPresetMoodText: (text: string | null) => void;
  /** Aktif session ID'yi set eder — mood parsedıktan sonra çağrılır */
  setCurrentSessionId: (id: string | null) => void;
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

  const setMoodResult = useCallback((profile: TasteProfile, filters: FilmFilters) => {
    setCurrentProfile(profile);
    setCurrentFilters(filters);
  }, []);

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

  return (
    <MoodContext.Provider
      value={{
        currentProfile,
        currentFilters,
        presetMoodText,
        currentSessionId,
        setMoodResult,
        clearMood,
        setPresetMoodText,
        setCurrentSessionId,
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

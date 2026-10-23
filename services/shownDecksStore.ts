/**
 * shownDecksStore — son mood desteleri (en fazla 3) için yerel, kalıcı film
 * kimliği deposu.
 *
 * Amaç: ilk batch'te aynı filmlerin art arda desteye girmesini önlemek
 * (QUALITY-3). `getRecommendations` ilk batch'te bu kimlikleri `exclude_ids`'e
 * ekler; aday yetmezse çağıran bu "yumuşak" dışlamayı bırakıp yeniden dener.
 *
 * Saklama: AsyncStorage tek anahtar, `string[][]` (eski → yeni). Sunucuya
 * yazılmaz. Hesap sıfırlamada `sessionReset.sweepUserStorage` anahtarı siler
 * (allowlist dışı). Okuma/yazma hatası `logger.error` ile Sentry'ye gider; okuma hatasında boş liste
 * döner (öneri akışı durmaz), hata yine görünür kalır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '../utils/logger';

export const RECENT_DECKS_KEY = 'chosy_recent_deck_ids';

/** Hatırlanan deste sayısı. */
export const RECENT_DECK_LIMIT = 3;

function isDeckList(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every((deck) => Array.isArray(deck) && deck.every((id) => typeof id === 'string'))
  );
}

async function readDecks(): Promise<string[][]> {
  const raw = await AsyncStorage.getItem(RECENT_DECKS_KEY);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!isDeckList(parsed)) {
    throw new Error('shownDecksStore: depolanan değer string[][] değil');
  }
  return parsed;
}

/** Son (en fazla 3) desteden film kimlikleri — yeniden eskiye, tekrarsız. */
export async function getRecentDeckIds(): Promise<string[]> {
  try {
    const decks = await readDecks();
    return [...new Set(decks.slice().reverse().flat())];
  } catch (err) {
    logger.error('[shownDecksStore] okuma hatasi', err, { code: 'SHOWN_DECKS_READ_FAILED' });
    return [];
  }
}

/** Gösterilen desteyi kaydeder; en eski deste 3'ü aşınca düşer. */
export async function recordShownDeck(filmIds: string[]): Promise<void> {
  if (filmIds.length === 0) return;
  try {
    const decks = await readDecks();
    const next = [...decks, [...new Set(filmIds)]].slice(-RECENT_DECK_LIMIT);
    await AsyncStorage.setItem(RECENT_DECKS_KEY, JSON.stringify(next));
  } catch (err) {
    logger.error('[shownDecksStore] yazma hatasi', err, { code: 'SHOWN_DECKS_WRITE_FAILED' });
  }
}

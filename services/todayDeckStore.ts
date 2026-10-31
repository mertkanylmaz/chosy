/**
 * Bugünkü mood destesinin YEREL deposu (MONEY-1C P0, mood_offer bayrağı arkasında çağrılır).
 *
 * Yalnız AsyncStorage: sunucu çağrısı, parse-mood ya da rerank YOK. Hatalar Sentry'ye
 * yazılır (sessiz değil) ve çağıran için "kayıt yok" anlamına gelir — kurtarma yoksa
 * kullanıcı normal arama akışını görür.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { localDateKey, parseTodayDeck, type TodayDeckSnapshot } from '@/utils/todayDeck';

const KEY = 'chosy_today_mood_deck_v1';

function report(step: 'save' | 'load' | 'clear', err: unknown): void {
  Sentry.captureException(err, { level: 'warning', tags: { flow: 'today_deck', step } });
}

export async function saveTodayDeck(snapshot: TodayDeckSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch (err) {
    report('save', err);
  }
}

export async function clearTodayDeck(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (err) {
    report('clear', err);
  }
}

/** Bugünün (yerel gün) ve bu hesabın destesi; yoksa / bayatsa / bozuksa null (bayat silinir). */
export async function loadTodayDeck(ownerId: string, now: Date = new Date()): Promise<TodayDeckSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === null) return null;
    const snapshot = parseTodayDeck(raw, localDateKey(now), ownerId);
    if (!snapshot) await clearTodayDeck();
    return snapshot;
  } catch (err) {
    report('load', err);
    return null;
  }
}

/**
 * Ask Coordinator — champion sonrası tek modal istemin (K-13 auth / K-15
 * bildirim) TEK karar noktası. `services/championPrompts.ts`'in yerini alır.
 *
 * Karar saf fonksiyonda (`utils/askDecision.ts`, birim testli); bu modül
 * yalnız girdileri toplar ve gösterimi kalıcı yazar.
 *
 * ── Depolama (CTO kararı, 3 Eki 2026 — migration YOK) ──────────────────────
 * `chosy_ask_state` (AsyncStorage): { lastAskDay, auth: { count, lastAt } }.
 * Cihaz-yereldir; yeniden kurulumda sıfırlanır — bilinen ve kabul edilen
 * sonuç. Bildirim izni için ayrıca `chosy_push_permission_asked` korunur.
 * `users.auth_prompt_seen` yalnız gerçek giriş tamamlanınca yazılır ve
 * burada "girişe dönüşmüş" olarak okunur.
 *
 * ── Hata (Kural 1) ─────────────────────────────────────────────────────────
 * Girdilerden biri okunamazsa ask GÖSTERİLMEZ (güvenli taraf) ve hata
 * Sentry'ye `fatal` yazılır. Gösterim kalıcı yazılamazsa da gösterilmez —
 * yazılamayan gösterim cooldown'u ve 3 gösterim sınırını delerdi.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { readAppUserId } from './auth-utils';
import { getDailyChallenge } from './gameApi';
import { getChampionDatesSince } from './gauntletService';
import { shouldAskForNotificationPermission } from './pushNotifications';
import { supabase } from './supabase';
import { readUserFlags } from './userFlags';
import { isPuzzleUnavailableError } from '../utils/puzzleAvailability';
import {
  askedToday,
  localDayKey,
  parseAskState,
  recordAskShown,
  shouldShowAsk,
  spotlightStateFrom,
  type AskState,
  type AskTrigger,
  type AskType,
  type SpotlightState,
} from '../utils/askDecision';

const ASK_STATE_KEY = 'chosy_ask_state';

/** `getChampionDatesSince` alt sınırı — tüm geçmişi kapsar. */
const ALL_TIME = '1970-01-01';

/** Gösterilmesine karar verilen ask. */
export interface AskDecision {
  type: AskType;
  dayIndex: number;
}

async function readAskState(): Promise<AskState> {
  return parseAskState(await AsyncStorage.getItem(ASK_STATE_KEY));
}

/**
 * Bugünkü Spotlight bulmacasının durumu (`get-daily-challenge`).
 *
 * P-1c E: bulmaca yoksa (NO_PUZZLE) `unavailable` — karar girdisidir, hata
 * değil; Sentry uyarısını `gameApi` (oyun, gün) başına bir kez yazdı. Diğer
 * her hata fırlar ve çağıranda `fatal` olarak kalır.
 */
async function readSpotlightState(today: string): Promise<SpotlightState> {
  try {
    const data = await getDailyChallenge('spotlight', today);
    return spotlightStateFrom(data.progress);
  } catch (err) {
    if (isPuzzleUnavailableError(err)) return 'unavailable';
    throw err;
  }
}

/** Kişisel champion günü sayısı — `daily_gauntlets`, yeni sorgu yok. */
async function readDayIndex(): Promise<number> {
  const userId = await readAppUserId();
  if (!userId) throw new Error('askCoordinator: public.users.id çözülemedi');
  const dates = await getChampionDatesSince(userId, ALL_TIME);
  return dates.length;
}

/** Oturum anonim mi + girişe dönüşmüş mü. */
async function readAuthState(): Promise<{ isAnonymous: boolean; authConverted: boolean }> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('askCoordinator: oturum yok');
  // `is_anonymous` yoksa güvenli varsayım anonimdir; bayrak yine okunur.
  const isAnonymous = user.is_anonymous ?? true;
  if (!isAnonymous) return { isAnonymous, authConverted: true };

  const flags = await readUserFlags();
  if (!flags) throw new Error('askCoordinator: kullanıcı bayrakları okunamadı');
  return { isAnonymous, authConverted: flags.authPromptSeen };
}

/**
 * Tetik anında hangi askın gösterileceğine karar verir ve gösterimi kalıcı
 * yazar. `null` → gösterme. Hiçbir zaman fırlatmaz: hata Sentry'ye `fatal`.
 *
 * @param knownSpotlightState Çağıran Spotlight durumunu az önce okuduysa
 *   (spotlight_return) tekrar ağa gidilmez.
 */
export async function resolveAsk(
  trigger: AskTrigger,
  knownSpotlightState?: SpotlightState,
): Promise<AskDecision | null> {
  try {
    const nowDate = new Date();
    const today = localDayKey(nowDate);

    const askState = await readAskState();
    // Ucuz ön eleme: bugün ask gösterildiyse ağa hiç çıkılmaz.
    if (askedToday(askState, today)) return null;

    const [spotlightState, dayIndex, auth, shouldAskNotif] = await Promise.all([
      knownSpotlightState ?? readSpotlightState(today),
      readDayIndex(),
      readAuthState(),
      shouldAskForNotificationPermission(),
    ]);

    const type = shouldShowAsk({
      today,
      now: nowDate.getTime(),
      dayIndex,
      spotlightState,
      askState,
      isAnonymous: auth.isAnonymous,
      authConverted: auth.authConverted,
      notifAsked: !shouldAskNotif,
    });
    if (!type) return null;

    // Önce yaz, sonra göster: yazılamazsa throw → gösterilmez.
    const next = recordAskShown(askState, type, today, nowDate.getTime());
    await AsyncStorage.setItem(ASK_STATE_KEY, JSON.stringify(next));

    return { type, dayIndex };
  } catch (err) {
    Sentry.captureException(err, {
      level: 'fatal',
      tags: { component: 'askCoordinator', error_code: 'ASK_RESOLVE_FAILED', trigger },
    });
    return null;
  }
}

/** Spotlight dönüşünde durum okuması — hata Sentry'ye `fatal`, ask yok. */
export async function readSpotlightStateForAsk(): Promise<SpotlightState | null> {
  try {
    return await readSpotlightState(localDayKey(new Date()));
  } catch (err) {
    Sentry.captureException(err, {
      level: 'fatal',
      tags: {
        component: 'askCoordinator',
        error_code: 'ASK_SPOTLIGHT_STATE_FAILED',
        trigger: 'spotlight_return',
      },
    });
    return null;
  }
}

/**
 * E-21 — önceki döngü: istemci tarafı iz (marker) ve sorgu kararı.
 *
 * Kararın saf kısmı `previousCycleRules.ts`'te; burası yalnız girdileri
 * toplar (oturum, cihaz dilimi, AsyncStorage iz'i, gauntlet cache'i) ve
 * iz'i yazar. Hatalar yutulmaz — Sentry'ye warning olarak düşer; karar
 * belirsiz kaldığında sunucu yetkili kaynaktır.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { hasCachedGauntletForUser } from './gauntletCache';
import { deviceTimeZone } from './gauntletService';
import { supabase } from './supabase';
import {
  decidePreviousCycleProbe,
  type PreviousCycleMarker,
  type ProbeDecision,
} from './previousCycleRules';

const MARKER_PREFIX = 'chosy_prev_cycle_';

function markerKey(userId: string): string {
  return `${MARKER_PREFIX}${userId}`;
}

/** Cache ile aynı sahip: `auth.users.id`, yerel oturumdan (ağ istemez). */
async function currentAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function reportWarning(step: string, err: unknown): void {
  Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
    level: 'warning',
    tags: { component: 'previousCycle', step },
  });
}

async function readMarker(userId: string): Promise<PreviousCycleMarker | null> {
  const raw = await AsyncStorage.getItem(markerKey(userId));
  return raw === 'previous' || raw === 'closed' ? raw : null;
}

/**
 * 18:00 öncesi `before_18` kararından ÖNCE çağrılır. Oturum yoksa (temiz
 * kurulum, bootstrap henüz bitmedi) iz ve cache de yoktur → sorgu atılır;
 * 401 penceresi GauntletShell'in mevcut retry makinesiyle karşılanır.
 */
export async function decidePreviousCycleProbeNow(unlocked: boolean): Promise<ProbeDecision> {
  const timezone = deviceTimeZone();
  let marker: PreviousCycleMarker | null = null;
  let hasCacheForUser: boolean | null = false;

  let userId: string | null = null;
  try {
    userId = await currentAuthUserId();
  } catch (err) {
    reportWarning('session', err);
  }

  if (userId) {
    try {
      marker = await readMarker(userId);
    } catch (err) {
      reportWarning('marker_read', err);
    }
    try {
      hasCacheForUser = await hasCachedGauntletForUser(userId);
    } catch (err) {
      reportWarning('cache_check', err);
      hasCacheForUser = null;
    }
  }

  const decision = decidePreviousCycleProbe({ unlocked, timezone, marker, hasCacheForUser });

  if (decision.reason === 'no_timezone') {
    // Sessiz before_18 yasak: kohort dışı kalan kullanıcı görünür olmalı.
    Sentry.captureMessage('previousCycle: cihaz timezone yok, önceki döngü sorulmadı', {
      level: 'warning',
      tags: { component: 'previousCycle', error_code: 'PREVIOUS_CYCLE_NO_TZ' },
    });
  }
  if (decision.writeClosed && userId) {
    await markPreviousCycle('closed');
  }
  Sentry.addBreadcrumb({
    category: 'gauntlet.cycle',
    message: `probe ${decision.probe ? 'yes' : 'no'} (${decision.reason})`,
    level: 'info',
  });
  return decision;
}

/** İz'i yazar. Oturum yoksa yazacak sahip yoktur — breadcrumb bırakılır. */
export async function markPreviousCycle(value: PreviousCycleMarker): Promise<void> {
  try {
    const userId = await currentAuthUserId();
    if (!userId) {
      Sentry.addBreadcrumb({
        category: 'gauntlet.cycle',
        message: `marker ${value} yazılamadı: oturum yok`,
        level: 'warning',
      });
      return;
    }
    await AsyncStorage.setItem(markerKey(userId), value);
  } catch (err) {
    reportWarning('marker_write', err);
  }
}

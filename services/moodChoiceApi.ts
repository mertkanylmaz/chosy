/**
 * Mood Gauntlet seçim kaydı (submit-mood-choice) — istemci çağrı noktası.
 *
 * Sunucu fonksiyonu henüz DEPLOY EDİLMEMİŞ olabilir (Faz 2-1: deploy "deploy et" ile).
 * Bu durumda gateway 404 + `code: 'NOT_FOUND'` döner: seçim SESSİZCE atlanır (kullanıcıya hata
 * gösterilmez), Sentry breadcrumb'ı düşülür. Kendi 404'lerimiz (`SEARCH_NOT_FOUND`) farklı koddur
 * ve gerçek hata sayılır. Diğer hatalar da kullanıcıya gösterilmez ama Sentry'ye yazılır.
 */
import * as Sentry from '@sentry/react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants/config';
import { isFunctionNotDeployed } from '../utils/moodChoicePolicy';
import { getFreshSession } from './authSession';

export interface MoodChoiceEvent {
  moodSearchId: string;
  setId: string;
  setIndex: number;
  round: 1 | 2 | 3;
  filmA: string;
  filmB: string;
  winner: string | null;
  outcome: 'choice' | 'neither';
}

export type MoodChoiceResult = 'recorded' | 'idempotent' | 'not_deployed' | 'failed';

export async function recordMoodChoice(ev: MoodChoiceEvent): Promise<MoodChoiceResult> {
  try {
    const session = await getFreshSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-mood-choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        mood_search_id: ev.moodSearchId,
        set_id: ev.setId,
        set_index: ev.setIndex,
        round: ev.round,
        film_a: ev.filmA,
        film_b: ev.filmB,
        winner: ev.winner,
        outcome: ev.outcome,
      }),
    });
    const body: unknown = await res.json().catch(() => null);
    if (isFunctionNotDeployed(res.status, body)) {
      Sentry.addBreadcrumb({
        category: 'mood_gauntlet',
        level: 'info',
        message: 'submit-mood-choice deploy edilmemis — secim kaydi atlandi',
      });
      return 'not_deployed';
    }
    if (!res.ok) {
      Sentry.captureMessage('[MoodGauntlet] submit-mood-choice basarisiz', {
        level: 'warning',
        tags: { flow: 'mood_gauntlet', step: 'record_choice' },
        extra: { status: res.status, code: (body as { code?: unknown } | null)?.code ?? null, round: ev.round },
      });
      return 'failed';
    }
    return (body as { idempotent?: unknown } | null)?.idempotent === true ? 'idempotent' : 'recorded';
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { flow: 'mood_gauntlet', step: 'record_choice' } });
    return 'failed';
  }
}

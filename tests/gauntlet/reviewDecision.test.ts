import { assertEquals } from 'jsr:@std/assert';

import { reviewSkipReason, type ReviewInputs } from '../../utils/reviewDecision.ts';

const ELIGIBLE: ReviewInputs = {
  dayCount: 3,
  appVersion: '2.1.1',
  lastPromptedVersion: null,
  isFirstSession: false,
  paywallVisible: false,
  appActive: true,
};

Deno.test('3. gün, ilk istem → iste', () => {
  assertEquals(reviewSkipReason(ELIGIBLE), null);
});

Deno.test('önceki sürümde istenmiş, yeni sürümde tekrar istenir', () => {
  assertEquals(reviewSkipReason({ ...ELIGIBLE, lastPromptedVersion: '2.1.0' }), null);
});

Deno.test('aynı sürümde ikinci kez istenmez', () => {
  assertEquals(
    reviewSkipReason({ ...ELIGIBLE, lastPromptedVersion: '2.1.1' }),
    'already_prompted_this_version',
  );
});

Deno.test('3. gün değilse istenmez (1, 2, 4, 30)', () => {
  for (const dayCount of [0, 1, 2, 4, 30]) {
    assertEquals(reviewSkipReason({ ...ELIGIBLE, dayCount }), 'not_third_day');
  }
});

Deno.test('ilk oturumda asla', () => {
  assertEquals(reviewSkipReason({ ...ELIGIBLE, isFirstSession: true }), 'first_session');
});

Deno.test('paywall açıkken asla', () => {
  assertEquals(reviewSkipReason({ ...ELIGIBLE, paywallVisible: true }), 'paywall_visible');
});

Deno.test('uygulama aktif değilken istenmez', () => {
  assertEquals(reviewSkipReason({ ...ELIGIBLE, appActive: false }), 'app_inactive');
});

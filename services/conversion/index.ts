/**
 * Conversion Funnel — public API.
 *
 * Orchestrator, A/B testing ve tipleri tek noktadan export eder.
 */

export {
  shouldShowPaywall,
  recordPaywallShown,
  recordPaywallDismissed,
  recordPaywallConverted,
  recordTrialStarted,
} from './triggerOrchestrator';

export {
  getExperimentGroup,
  setExperimentOverride,
  clearExperimentOverride,
  getActiveExperiments,
} from './abTesting';

export {
  isWatchlistFull,
  isStreakMilestone,
  isPerfectGameMilestone,
} from './integrations';

export type {
  TriggerEvent,
  TriggerType,
  PaywallVariant,
  PaywallVariantName,
  PaywallEventInsert,
} from './types';

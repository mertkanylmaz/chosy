# RevenueCat Migration Plan: 3-Tier to 4-Tier

## Current State (V1.0.2)

| Plan | Product ID | Price | Status |
|------|-----------|-------|--------|
| Weekly | `chosyai_weekly` | $1.99/w | Active (3-day trial) |
| Monthly | `chosyai_monthly` | $4.99/m | Active |
| Yearly | `chosyai_yearly` | $39.99/y | Active |

**Entitlement:** `premium`
**Offering:** `default`

## New State (V1.1)

| Plan | Product ID | Price | Status |
|------|-----------|-------|--------|
| Weekly | `chosyai_weekly` | $1.99/w | **HIDDEN** (no new signups) |
| Monthly | `com.chosy.monthly` | $6.99/m | **NEW** |
| Annual | `com.chosy.annual` | $39.99/y | **NEW** (replaces yearly) |
| Lifetime | `com.chosy.lifetime` | $89.99 | **NEW** (non-consumable) |

**Entitlement:** `chosy_plus` (master entitlement)
**Offering:** `default` (updated)

## Migration Steps

### 1. App Store Connect

1. Create new products:
   - `com.chosy.monthly` — Auto-Renewable, $6.99/month
   - `com.chosy.annual` — Auto-Renewable, $39.99/year
   - `com.chosy.lifetime` — Non-Consumable, $89.99
2. Keep `chosyai_weekly` active but remove from subscription group display
3. Update subscription group name to "Chosy Plus"

### 2. RevenueCat Dashboard

1. **Create new entitlement:** `chosy_plus`
   - Attach ALL products (old + new) to this entitlement
   - Keep `premium` entitlement active for backward compatibility

2. **Update Offering `default`:**
   - Remove `chosyai_weekly` package
   - Add `com.chosy.monthly` as "Monthly" package
   - Add `com.chosy.annual` as "Annual" package
   - Add `com.chosy.lifetime` as "Lifetime" package

3. **Create Offering `legacy`:**
   - Add `chosyai_weekly` for existing weekly subscribers (renewal only)

### 3. Existing Weekly Users (Grandfather)

- Weekly subscribers continue on `chosyai_weekly` until they cancel
- Their tier maps to `weekly_legacy` in our DB
- `weekly_legacy` has its own quota limits (14 search/day, 5 slots)
- When they cancel + resubscribe, they see the new plans only

### 4. Code Changes

```typescript
// constants/subscriptionPlans.ts
export const RC_ENTITLEMENT_ID = 'chosy_plus'; // was 'premium'

// Paywall shows new plans from 'default' offering
// Old weekly users auto-renew via RevenueCat, no code needed
```

### 5. Rollout Order

1. Deploy DB migration (021_quota_system.sql)
2. Deploy Edge Functions (check-quota, updated parse-mood/parse-taste)
3. Update RevenueCat Dashboard (new products + offerings)
4. Submit app update to App Store
5. Once approved: switch offering to show new plans

### 6. Rollback Plan

- If issues: revert offering to old 3-plan setup in RevenueCat Dashboard
- DB migration is additive (no destructive changes), safe to keep
- `weekly_legacy` tier handles old subscribers automatically

## Pricing Rationale

| Plan | Old | New | Change |
|------|-----|-----|--------|
| Monthly | $4.99 | $6.99 | +$2 (more value: 15 searches vs 3/day) |
| Annual | $39.99 | $39.99 | Same (better value prop vs new monthly) |
| Lifetime | N/A | $89.99 | ~13 months of monthly |
| Weekly | $1.99 | Hidden | Grandfather existing, no new signups |

# RevenueCat Final Setup — V1.1

## Offerings

### 1. `default` — Main Paywall Flow
| Package | Product ID | Price | Type |
|---------|-----------|-------|------|
| `$rc_monthly` | `com.chosy.monthly` | $6.99/mo | Auto-renewable |
| `$rc_annual` | `com.chosy.annual` | $39.99/yr | Auto-renewable |

### 2. `lifetime_founding` — Founding Member
| Package | Product ID | Price | Type |
|---------|-----------|-------|------|
| `$rc_lifetime` | `com.chosy.lifetime` | $89.99 | Non-consumable |

**Display condition:** Only show if `get_lifetime_counter().remaining > 0`

### 3. `winback_50off` — Churned User Re-engagement
| Package | Product ID | Price | Type |
|---------|-----------|-------|------|
| 50% off | Offer Code via App Store Connect | 50% x 3 months | Promotional |

## Entitlements

| Entitlement ID | Description | Grants |
|---------------|-------------|--------|
| `chosy_plus` | Base premium | Monthly/Annual features |
| `chosy_lifetime` | Lifetime access | All features + future releases |

## App Store Connect Products

### Monthly (`com.chosy.monthly`)
- Price: $6.99
- Duration: 1 month
- Free Trial: None (handled via Offer Codes)
- Auto-renew: Yes

### Annual (`com.chosy.annual`)
- Price: $39.99
- Duration: 1 year
- Free Trial: None
- Auto-renew: Yes

### Lifetime (`com.chosy.lifetime`)
- Price: $89.99
- Type: Non-consumable
- Auto-renew: No

## Webhooks

Configure in RevenueCat Dashboard > Project Settings > Integrations > Webhooks:

**URL:** `https://<SUPABASE_URL>/functions/v1/process-lifetime-purchase`
**Auth:** `Bearer <REVENUECAT_WEBHOOK_SECRET>`

### Events to Listen

| Event | Action |
|-------|--------|
| `INITIAL_PURCHASE` | Check if lifetime product -> `claim_lifetime_spot` RPC |
| `NON_RENEWING_PURCHASE` | Same as above (lifetime is non-renewing) |
| `RENEWAL` | Analytics event (for monthly/annual) |
| `CANCELLATION` | Update status + trigger winback sequence |
| `EXPIRATION` | Update `users.subscription_tier` to `free` |

## Environment Variables (Edge Functions)

```env
REVENUECAT_WEBHOOK_SECRET=<generate-secure-token>
FOUNDING_MEMBER_NOTIFY_URL=<slack-or-discord-webhook-url>  # Optional
```

## RevenueCat SDK Configuration (Client)

Already configured in `services/purchaseService.ts`:
- API Key: Set in `.env` as `EXPO_PUBLIC_RC_API_KEY`
- App User ID: Supabase auth user ID
- Entitlement check: `chosy_plus` for premium access

## Migration Checklist

- [ ] Create products in App Store Connect
- [ ] Create offerings in RevenueCat Dashboard
- [ ] Map products to entitlements
- [ ] Configure webhook URL + secret
- [ ] Deploy `process-lifetime-purchase` Edge Function
- [ ] Deploy `lifetime-counter` Edge Function
- [ ] Test purchase flow in Sandbox
- [ ] Test lifetime counter increment
- [ ] Test sold-out scenario
- [ ] Verify webhook delivery in RC Dashboard

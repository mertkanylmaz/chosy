/**
 * Teklifte "7 gün ücretsiz" yalnız deneme-uygun (eligible) kullanıcıya (MONEY-1C F2-7).
 * Henüz App Store Connect'te deneme tanımlı değil: eligibility 'ineligible' / 'unknown'
 * (veya intro offer yok) dönse bile kullanıcı FİYATLI teklifi görmeli, deneme vaadi DEĞİL.
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import en from '../../locales/en.json' with { type: 'json' }
import tr from '../../locales/tr.json' with { type: 'json' }
import { buildOffer, type OfferCopy, type TrialEligibility } from '../../utils/paywallPricing'

type Dict = Record<string, unknown>

function render(dict: Dict, copy: OfferCopy): string {
  const [ns, key] = copy.key.split('.')
  const template = (dict[ns] as Dict)[key] as string
  return template.replace(/%\{(\w+)\}/g, (_m, name: string) => String(copy.params[name]))
}

const TRIAL_WORDS = /free trial|7-day|7 day|nothing due|ücretsiz deneme|7 gün|bugün ücret yok/i
const ANNUAL = { priceString: '$29.99', introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 } }
// ASC'de deneme yok: intro offer tanımsız
const ANNUAL_ASC_NO_TRIAL = { priceString: '$29.99', introPrice: null }

Deno.test('ASC\'de deneme YOK: eligible bile dönse fiyatlı teklif, deneme vaadi yok (en + tr)', () => {
  for (const elig of ['eligible', 'ineligible', 'unknown'] as TrialEligibility[]) {
    const o = buildOffer('annual', ANNUAL_ASC_NO_TRIAL, elig)
    assertEquals(o.kind, 'paid', elig)
    assertEquals(o.canPurchase, true, elig)
    for (const dict of [en, tr]) {
      const text = `${render(dict, o.cta)} ${render(dict, o.description!)}`
      assert(!TRIAL_WORDS.test(text), `${elig}: ${text}`)
      assert(text.includes('$29.99'), `${elig}: fiyat görünmeli → ${text}`)
    }
  }
})

Deno.test('ASC\'de deneme VAR ama kullanıcı uygun değil: fiyatlı teklif', () => {
  for (const elig of ['ineligible', 'unknown'] as TrialEligibility[]) {
    const o = buildOffer('annual', ANNUAL, elig)
    assertEquals(o.kind, 'paid', elig)
    assertEquals(o.trialDays, 0, elig)
    for (const dict of [en, tr]) {
      const text = `${render(dict, o.cta)} ${render(dict, o.description!)}`
      assert(!TRIAL_WORDS.test(text), `${elig}: ${text}`)
    }
  }
})

Deno.test('yalnız eligible + intro tanımlı → deneme (tek yol)', () => {
  const o = buildOffer('annual', ANNUAL, 'eligible')
  assertEquals(o.kind, 'trial')
  assertEquals(o.trialDays, 7)
})

Deno.test('teklif kopyası ve PaywallMoodOffer kendi başına deneme vaadi taşımaz', () => {
  for (const dict of [en, tr] as { moodOffer: Dict }[]) {
    for (const [key, value] of Object.entries(dict.moodOffer)) {
      assert(!TRIAL_WORDS.test(String(value)), `moodOffer.${key}`)
    }
  }
  const src = Deno.readTextFileSync(new URL('../../components/paywalls/PaywallMoodOffer/index.tsx', import.meta.url))
    .replace(/\/\*[\s\S]*?\*\//g, '') // yorumlar sayılmaz
  // Deneme kararı PaywallBase'e (buildOffer + getTrialEligibility) bırakılır; burada yalnız trialShown iletilir.
  assert(/<PaywallBase/.test(src) && /ctx\.trialShown/.test(src))
  assert(!/getTrialEligibility|7 days|7 gün/.test(src))
})

/**
 * Editoryal takvim — E-19 (ilk 100 gün)
 *
 * Şema: `supabase/migrations/112_editorial_calendar.sql`
 * Keşif: `docs/investigations/E19_GENERATE_GAUNTLET_KESIF.md`
 * Ürün dayanağı: `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` §E-19
 *
 * ── Neden `gauntletCore.ts` DEĞİL ────────────────────────────────────────────
 * `gauntletCore` "algoritmanın tamamı"dır: sert filtre, puanlama, çeşitlilik,
 * ağırlıklı rastgele seçim. Editoryal takvim bunların HİÇBİRİNİ kullanmaz —
 * günün dörtlüsü elle kurgulanmıştır ve tek iş onu sırasıyla okumaktır. İkisini
 * aynı dosyaya koymak, "editoryal yol da bir puanlama yoludur" yanılsamasını
 * kodun şeklinde üretirdi.
 *
 * `Candidate` ve `fetchCandidatesByIds` ise oradan İTHAL EDİLİR, kopyalanmaz:
 * poster normalizasyonu (`toW500PosterUrl`) ve NULL kapısı (`rowToCandidate`)
 * tek yerde tanımlı kalmalı — M3 Faz 2'de iki ıraksak çözümleme yolunun ne
 * ürettiği ölçüldü (`generate-gauntlet/index.ts:252-268`).
 *
 * ── Bu modülün YAPMADIĞI şey ────────────────────────────────────────────────
 * Yedek kulübesine (position 5-6) DOKUNMAZ. `neither`/`seen` yenilemesinin
 * editoryal karşılığı K-23'ün işidir; burada yalnızca ana sıra (1-4) okunur.
 * `submit-choice` o güne ait yenilemeyi `isEditorialGauntlet` ile kapatır.
 */

import { type Candidate, fetchCandidatesByIds } from './gauntletCore.ts'
import { getAppConfig } from './gameUtils.ts'
import type { DailyGauntlet } from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/** Takvimin uzunluğu — `112`'nin `CHECK (day_number BETWEEN 1 AND 100)`'ü ile birebir. */
export const EDITORIAL_CALENDAR_LENGTH = 100

/**
 * Günün bracket'ini kuran pozisyon bandı. 5-6 YEDEK KULÜBESİDİR ve bu modül
 * onu hiç okumaz (K-23, ayrı iş kalemi).
 */
export const EDITORIAL_MAIN_POSITIONS = 4

/** `app_config` anahtarı — `scripts/ingest-editorial-films.ts:94` ile aynı. */
const LAUNCH_DATE_KEY = 'launch_date'

const MS_PER_DAY = 86_400_000

/**
 * Editoryal günde dört slotun da etiketi.
 *
 * Fonksiyon, sabit DEĞİL: modül seviyesinde paylaşılan bir dizi, çağıranın
 * yanlışlıkla mutasyona uğratabileceği ortak durumdur. Her çağrıda yeni dizi
 * döner.
 */
export function editorialSlotTypes(): DailyGauntlet['slotTypes'] {
  return ['editorial', 'editorial', 'editorial', 'editorial']
}

// ─── Gün numarası ────────────────────────────────────────────────────────────

/**
 * `YYYY-MM-DD` metnini UTC gece yarısına çözer.
 *
 * Round-trip doğrulaması var: `Date.UTC(2026, 1, 31)` sessizce 3 Mart'a taşar,
 * bu da `day_number`'ı iki gün kaydırırdı. Biçim doğru ama tarih uydurma olan
 * değer REDDEDİLİR — sessiz düzeltme yok (CLAUDE.md #1).
 */
function parseUtcDate(value: string, label: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) {
    throw new Error(`${label} 'YYYY-MM-DD' biçiminde olmalı, gelen: ${value}`)
  }
  const [, y, mo, d] = m
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d))
  if (new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} geçerli bir takvim tarihi değil: ${value}`)
  }
  return ms
}

/**
 * Bugünün editoryal gün numarası, ya da takvim dışındaysa `null`.
 *
 * SAF fonksiyon: iki `YYYY-MM-DD` metni alır, DB'ye ve saate bakmaz. Çağıran
 * `todayDate`'i `utcDateString()`'ten geçirir — burada ikinci bir `new Date()`
 * BİLİNÇLİ OLARAK yok: gün dönümünde `daily_gauntlets.date` ile `day_number`
 * ayrışırsa kullanıcı "yarının temasını" görürdü (keşif G-01).
 *
 * `null` üç durumda döner ve üçü de algoritmik dal demektir:
 *   - yayın öncesi (`day_number < 1`)
 *   - takvim bitti (`day_number > 100`)
 * Bu bir fallback DEĞİL, tanımın kendisidir: editoryal dönem sonludur.
 *
 * ⚠️ M2 Faz 2b (kullanıcı-yerel gün anahtarı) geldiğinde bu hesap da o anahtara
 * taşınmalıdır; bugün ikisi de UTC olduğu için ayrışma yok (keşif DUR-5,
 * ertelendi).
 */
export function editorialDayNumber(
  todayDate: string,
  launchDate: string,
): number | null {
  const diffDays = Math.round(
    (parseUtcDate(todayDate, 'bugünün tarihi') -
      parseUtcDate(launchDate, `app_config.${LAUNCH_DATE_KEY}`)) / MS_PER_DAY,
  )
  const dayNumber = diffDays + 1
  if (dayNumber < 1 || dayNumber > EDITORIAL_CALENDAR_LENGTH) return null
  return dayNumber
}

/**
 * `app_config.launch_date` — istek başına LAZY okunur, modül seviyesinde cache
 * YOK (CLAUDE.md #6). Anahtar yoksa `getAppConfig` throw eder; değer metin
 * değilse burada throw edilir.
 *
 * Varsayılan bir tarihe düşmek YASAK: yanlış `launch_date`, 100 günün
 * tamamını yanlış güne kaydırır ve hata ancak kullanıcı "yanlış günün
 * temasını" gördüğünde fark edilir. `scripts/ingest-editorial-films.ts:139-173`
 * aynı kararı verdi; iki yol aynı davranışta kalır.
 */
export async function fetchLaunchDate(service: SupabaseClient): Promise<string> {
  const raw = await getAppConfig<unknown>(service, LAUNCH_DATE_KEY)
  if (typeof raw !== 'string') {
    throw new Error(
      `app_config.${LAUNCH_DATE_KEY} 'YYYY-MM-DD' metni olmalı, gelen tip: ${typeof raw}`,
    )
  }
  return raw
}

// ─── Günün dörtlüsü ──────────────────────────────────────────────────────────

interface EditorialFilmRow {
  position: number
  film_id: string
}

/**
 * `day_number`'ın ana sırasını (position 1-4) SIRASIYLA çözer.
 *
 * ── Sıra neden korunur ──────────────────────────────────────────────────────
 * Sıralı dörtlü günün ÜÇ eşleşmesini tamamen belirler: position 1 = defender,
 * 2/3/4 = tur 1/2/3 meydan okuyucusu (`112_editorial_calendar.sql` COMMENT;
 * istemci aynası `GauntletShell/index.tsx:128-137`). Bu yüzden editoryal yol
 * `arrangeUnseen`'i ÇAĞIRMAZ — o fonksiyon dörtlüyü yeniden dizer ve CTO'nun
 * kurguladığı üç eşleşmeyi rastgele üç eşleşmeye çevirirdi.
 *
 * ── Neden `fetchPool` değil `fetchCandidatesByIds` ──────────────────────────
 * Ölçüldü (19 Eyl 2026): 400 editoryal filmin 33'ü `curation_tier='archive'`
 * (havuz `ACTIVE_TIERS` ile sınırlı) ve 32'sinin `release_date`'i NULL
 * (`isDuelEligible` elerdi). Havuz yolundan gidilseydi o günler 4'ten az filmle
 * kalırdı. `chosy-conventions` "seçim filtresi ile çözümleme yolu ayrıdır"
 * kuralı tam olarak bunu tarif ediyor: editoryal film SEÇİLMİŞTİR, yeniden
 * seçilmez — yalnızca çözümlenir.
 *
 * ── Eksik film ──────────────────────────────────────────────────────────────
 * 4'ten az satır ya da çözümlenemeyen bir film `throw` eder: dış catch Sentry'ye
 * fatal düşürür ve istek 503 döner. Algoritmik havuza SESSİZCE düşmek yasak
 * (CLAUDE.md #1) — o gün editoryal kurguyu değil, rastgele dört filmi gösterirdi
 * ve kimse fark etmezdi.
 */
export async function fetchEditorialQuartet(
  service: SupabaseClient,
  dayNumber: number,
): Promise<Candidate[]> {
  const { data, error } = await service
    .from('editorial_calendar_films')
    .select('position,film_id')
    .eq('day_number', dayNumber)
    // Yedek kulübesi (5-6) BİLİNÇLİ OLARAK dışarıda — K-23 ayrı iş kalemi.
    .lte('position', EDITORIAL_MAIN_POSITIONS)
    .order('position', { ascending: true })

  if (error) {
    throw new Error(
      `editoryal takvim sorgusu başarısız (gün ${dayNumber}): ${error.message}`,
    )
  }

  const rows = (data ?? []) as EditorialFilmRow[]
  if (rows.length !== EDITORIAL_MAIN_POSITIONS) {
    throw new Error(
      `editoryal gün ${dayNumber}: ${rows.length} ana slot bulundu, ` +
        `${EDITORIAL_MAIN_POSITIONS} bekleniyordu`,
    )
  }
  rows.forEach((r, i) => {
    if (r.position !== i + 1) {
      throw new Error(
        `editoryal gün ${dayNumber}: pozisyon dizisi boşluklu ` +
          `(${rows.map((x) => x.position).join(',')})`,
      )
    }
  })

  const ids = rows.map((r) => r.film_id)
  const byId = await fetchCandidatesByIds(service, ids)

  const films: Candidate[] = []
  for (const id of ids) {
    const c = byId.get(id)
    if (!c) {
      // `rowToCandidate` kapısı: poster_url / runtime / year NULL ya da poster
      // normalize edilemiyor. Ölçümde 400 filmin hepsi bu kapıyı geçiyor —
      // yine de atlanmaz, çünkü veri sonradan bozulabilir ve bozulduğunda
      // sessiz kalmamalı (keşif G-08).
      throw new Error(
        `editoryal gün ${dayNumber}: film çözümlenemedi: ${id}`,
      )
    }
    films.push(c)
  }
  return films
}

// ─── Editoryal gün tespiti (submit-choice guard'ı) ───────────────────────────

/**
 * Kayıtlı bir gauntlet editoryal takvimden mi geldi.
 *
 * Kaynak `daily_gauntlets.slot_types` — üretim anındaki gerçeği taşır ve
 * `launch_date` sonradan değiştirilse bile DEĞİŞMEZ. `day_number`'ı yeniden
 * hesaplamak yerine satıra bakmanın sebebi bu: dün üretilmiş bir gauntlet'e
 * bugünün takvim penceresiyle karar vermek, gece yarısını geçen bir oturumu
 * ortasından kırardı.
 *
 * "Herhangi biri editoryal" yeterlidir, "dördü birden" değil: kısmi bir karışım
 * bugün üretilemez, ama üretilseydi de o gün editoryal kurgu altındadır ve
 * algoritmik yenileme yine yasak olmalıdır — kapı güvenli yöne kapanır.
 */
export function isEditorialGauntlet(slotTypes: readonly string[] | null): boolean {
  return (slotTypes ?? []).includes('editorial')
}

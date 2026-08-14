# 🛠️ CHOSY CLAUDE CODE OS

**Versiyon:** v2.0 · 5 Ağustos 2026
**Kapsam:** Çalışma protokolü + kalan faz promptları
**Bağlı:** `1_PRODUCT_OS` · `2_BUSINESS_MODEL` · `3_DESIGN_OS`

> ✅ doğrulandı (repo/kod, 5 Ağu 2026) · ⚠️ varsayım

> **05.08.2026 sonrası** — B.2 sırasında üç netleştirme B.4'e taşındı:
> DB CHECK/422 davranışı, latencyMs reddet-clamp-değil, baseline ölçüm sırası.
> Ayrıca B.4'teki "Zod ile doğrula" talimatı geçersiz kılındı (silinmedi,
> altına gerekçe yazıldı) — B.2'de Zod eklenmeme kararı alındı.

---

## 0. TEK CÜMLE

> **Claude Code bir uygulayıcıdır, karar verici değil.** Mimari kararlar CTO oturumunda alınır; Claude Code uygular ve doğrular.

---

## 1. REPO GERÇEKLERİ ✅

Bu bölüm ezberden değil, envanterden. Prompt yazarken buradan bakılır.

### 1.1 Klasör yapısı — **`src/` YOKTUR**

```
moodflix/
├── app/            Expo Router ekranları  ((tabs)/, games/, film/[id].tsx …)
├── components/     games/ (21 klasör), paywalls/, Themed.tsx …
├── services/       41 dosya
├── constants/      13 dosya
├── hooks/  contexts/  utils/  types/  locales/  scripts/  docs/
└── supabase/       migrations/ (68), functions/ (31)
```

### 1.2 Sürümler

Expo **~54.0.34** · React Native **0.81.5** · Reanimated ~4.1.1 · expo-router ~6.0.23
**Kurulu değil:** `@shopify/react-native-skia`, `expo-secure-store` (yerel depolama → AsyncStorage 2.2.0)

### 1.3 Şema notları

| Doğru | Yanlış |
|---|---|
| `films.poster_url` | ~~`poster_path`~~ |
| `films.backdrop_url` | — |
| `films.imdb_votes` (OMDb kaynaklı) · `vote_average` | ~~`vote_count`~~ |
| `films.title` (TMDb `en-US` zorlanmış) · `tr_title` | — |
| `films.country text[]` · `genres text[]` · `metadata_json` | ~~`films.dimensions_json`~~ |
| `film_profiles.dimensions_json` · `film_profiles.profile_vector` | Bu ikisi `films`'te DEĞİL |
| `films.tmdb_vote_count` (TMDb kaynaklı, `imdb_votes`'tan ayrı kolon) | — |
| İzlenmiş film → `watchlist.watched_at` | Ayrı tablo yok |
| Oyun temaları → `constants/gameThemes.ts` | ~~`gameTokens.ts`~~ |
| Oyun kabuğu → `GameShell` | ~~`GameScreenShell`~~ |

> **13 Ağustos 2026 düzeltmesi — `dimensions_json` yer değiştirmedi, tablo baştan yanlıştı.**
> Canlı şema PostgREST kolon probu ile doğrulandı: `films.dimensions_json` **YOK**,
> `film_profiles.dimensions_json` **VAR**. Bu satır `films.*` grubunun içinde
> yazıldığı için okuyanı `films`'te sanmaya itiyordu. `profile_vector` zaten
> `film_profiles`'ta — iki kolon aynı tabloda, birlikte anılıyor.
>
> ⚠️ **Aynı hata kök `CLAUDE.md`'nin "Şema notları" bölümünde de var**
> ("`films` kolonları: … `dimensions_json`"). Bu turun kapsamı `docs/os/` ile
> sınırlı olduğu için oraya dokunulmadı — **ayrı turda düzeltilmeli.**
>
> `tmdb_vote_count` ölçümde çıktı ve belgede hiç geçmiyordu. `imdb_votes`
> kirliliğiyle (OMDb ve TMDb iki farklı metrik aynı kolonda) doğrudan ilgili
> olduğu için eklendi.

### 1.4 Migration

En yüksek: ~~**077** (`077_cron_pattern_repair.sql`, 12.08.2026)~~ →
**081** (`081_activate_weekly_trending_sync.sql`, **13.08.2026** doğrulandı).
Yeni migration **082**'den başlar. Yine de eklemeden önce klasörü listele.

> **13 Ağustos 2026:** C.0d dört migration üretti (078-081, ayrıntı → "C.0d
> DURUM ÖZETİ ⏳ KOŞULLU"). `supabase migration list` local/remote **081'e
> kadar tam senkron**, sarkan migration yok.
>
> ⚠️ Kök `CLAUDE.md` hâlâ "En yüksek mevcut numara **076**" diyor — iki tur
> geride. Kapsam dışı, ayrı turda düzeltilmeli.

### 1.5 Gate'ler

```powershell
npm run typecheck            # → tam 14 hata, hepsi scripts/ altında
npm run typecheck:functions  # → 32 hata (deno check, düşüş hedefli değil)
```

> **13 Ağustos 2026 senkronu: ~~42~~ → 32.** Bu düşüş bu turda olmadı — daha
> önceki bir turda gerçekleşmiş ve kök `CLAUDE.md`'ye 32 olarak yazılmıştı; bu
> dosya güncellenmeyi kaçırmış. 13 Ağustos'ta `npm run typecheck:functions`
> canlı koşuldu, çıktı **"Found 32 errors"**. İki dosya artık hizalı.
>
> **`npm run typecheck` → 14 doğrulandı**, hepsi `scripts/` altında:
> `seed-database.ts` 6 · `enrich-films.ts` 3 · `ai-profile-films.ts` 1 ·
> `enrich-imdb-ratings.ts` 1 · `verify-ai-profiles.ts` 1 · `verify-db-state.ts` 1.
> Regresyon yok.

⚠️ **Sapma varsa dur.** 14'ten fazlaysa veya `scripts/` dışında hata varsa yeni regresyon vardır.

### 1.6 Koruma ağı ✅

`.claude/hooks/guard.js` — PreToolUse, `Bash|PowerShell` matcher, **8 kural**, izin modundan bağımsız çalışır. `.claude/settings.json`'da `permissions.deny` 10 kural (ikinci katman).

Bloklanan: `supabase db reset` · `db wipe/drop` · `DROP TABLE/…` · `TRUNCATE` · `git push --force/-f` · `rm -rf` · `git reset --hard`
Serbest: `db push` · `--force-with-lease` · `rm -r` · `git reset --soft/--mixed`

> **Kullanım notu:** Guard kendi test komutlarını da blokluyor. "DROP TABLE" gibi bir metni shell'e yazman gerekirse dosya üzerinden geç (`git commit -F <dosya>`).

---

## 2. GENİŞLETME YÜZEYLERİ

| Katman | Nerede | Ne zaman |
|---|---|---|
| **CLAUDE.md** | Repo kökü | **Her zaman doğru** olan kısa kurallar |
| **Skills** | `.claude/skills/<ad>/SKILL.md` | Bağlama göre gereken zengin iş akışı |
| **Subagents** | `.claude/agents/<ad>.md` | İzolasyon veya paralellik |
| **Hooks** | `.claude/settings.json` | Kural **kesin** olmalıysa |
| **Permissions** | `.claude/settings.json` | Tehlikeli aracı kapıda durdurmak |

### Seçim kuralı

```
Kural her zaman geçerli ve kısa mı?   → CLAUDE.md
Sadece belirli bir işte mi gerekli?    → Skill
Ayrı context window gerekli mi?        → Subagent
İhlali KESİNLİKLE yasak mı?            → Hook (exit code 2)
Aracın kendisi mi tehlikeli?           → Permission denial
```

**CLAUDE.md kısa tutulur.** Uzadıkça talimatların görmezden gelinme olasılığı artar. Her satır için: *bunu silsem Claude hata yapar mı?* Hayırsa sil.

**Skill `description` alanı kritik** — Claude'un skill'i ne zaman yükleyeceğine karar verdiği tek yer.

---

## 3. OTURUM PROTOKOLÜ

```
┌─ CTO OTURUMU (claude.ai) ──────────────────────┐
│  Karar al → prompt hazırla (paste-and-run)     │
└──────────────────┬─────────────────────────────┘
┌─ CLAUDE CODE ────▼─────────────────────────────┐
│  /clear → yapıştır → (Plan modu) → onayla      │
│  → uygula → doğrula → rapor                    │
└──────────────────┬─────────────────────────────┘
┌─ CTO OTURUMU ────▼─────────────────────────────┐
│  Diff incele → onay → commit                   │
└────────────────────────────────────────────────┘
```

### Değişmez kurallar

| # | Kural |
|---|---|
| 1 | İzin modu **Manual**. Bypass yok. ⚠️ `~/.claude/settings.json`'daki `defaultMode: bypassPermissions` kaldırıldı; **etkili olması için Claude Code yeniden başlatılmalı** |
| 2 | Her task **yeni `/clear`** ile başlar |
| 3 | Büyük task'lar önce **Plan modunda** (Shift+Tab) |
| 4 | Doğrulama **yeşil** gelmeden sonrakine geçme |
| 5 | Maliyet gerektiren işte **DUR ve sor** |
| 6 | Mimari karar gerekiyorsa **DUR, CTO'ya sor** |

### 3.1 Onay mekanizması ✅ — bu sprintte netleşti

> **`AskUserQuestion` üzerinden alınan onay geçerli onaydır.** Kurucu bir seçenek işaretlediyse karar verilmiştir. CTO oturumunda görünmüyor olması onayı geçersiz kılmaz.
>
> **Karşılığında:** Claude Code raporlarında **onay alınan kararlar açıkça listelenir** — "onayınla" gibi geçiştirilmiş ifade yerine hangi soruya hangi cevabın verildiği. Asenkron akışta CTO o ekranı görmez.

### 3.2 Sürüm kararı 🔒 (12.08.2026)

> **App Store sürümü Faz C tamamlanana kadar ÇIKMAZ.** Eksiksiz ürün, tek seferde.

Sonuçları — bunlar regresyon değil, **beklenen davranış:**

| Durum | Açıklama |
|---|---|
| 87 yetim kimlik onarılmıyor | `f44fac2` yalnızca TestFlight'ta. C.7 backfill'ine kadar böyle kalır |
| `parse-mood` 403 deploy'u ⏸ | Kod hazır, sürümle birlikte gidecek (§3 kural 7) |
| Sentry alert'leri sessiz | **"Veri yok" ≠ "sorun yok."** Sessizliği doğrulama sayma |

### 3.3 PowerShell'den PostgREST/RPC çağrısı ⚠️ (13.08.2026)

**Her `Invoke-WebRequest` çağrısına `-UserAgent 'chosy-cli/1.0'` ekle.**

Varsayılan PowerShell User-Agent'ı (`Mozilla/5.0 … WindowsPowerShell/5.1`)
tarayıcı gibi görünüyor ve Supabase'in secret-key koruması devreye giriyor:

```
Forbidden use of secret API key in browser
```

Bu **yanlış alarmdır** — anahtar geçerli, izin doğru, sorun yalnızca User-Agent.
Hata metni anahtarı suçladığı için tur kaybettirir: 13 Ağustos'ta
`cron_job_status()` çağrılırken tam olarak bu yaşandı ve `.env`'deki iki anahtar
kuşağı (`sb_secret_` vs legacy JWT) boş yere şüpheli sanıldı.

**Bilinen PowerShell 5.1 tuzakları — aynı yol üzerinde:**

| Tuzak | Belirti | Çözüm |
|---|---|---|
| `Range` başlığı | `'Range' üst bilgisi uygun özellik veya metot kullanılarak değiştirilmelidir` | Başlığı kullanma; `Prefer: count=exact` + `&limit=1` yeterli, sayı `Content-Range` yanıt başlığından okunur |
| `max-rows=1000` | Satır çekip istemcide saymak sessizce yanlış sonuç verir | Toplam için **her zaman** `Prefer: count=exact` |
| `information_schema` | PostgREST göstermiyor | Kolon varlığı `?select=<kolon>&limit=1` probuyla ölçülür (200 = var, 400 = yok) |
| `cron` şeması | PostgREST göstermiyor | `cron_job_status()` RPC'si (079) üzerinden |

---

## 4. PROMPT ANATOMİSİ

Altı bölüm. Eksik bölüm = tahmin edilen bölüm = hata.

```markdown
## BAĞLAM      Hangi fazdayız, hangi dosyalar ilgili
## GÖREV       Numaralı, sıralı adımlar
## KISITLAR    Neyi yapmayacaksın  ← en önemli bölüm
## DUR NOKTALARI  Hangi noktada onay isteyeceksin
## DOĞRULAMA   Komutlar ve beklenen çıktı
## RAPOR       Bitince hangi soruları cevaplayacaksın
```

### Standart kısıt bloğu

```
KISITLAR (her zaman geçerli):
- Sessiz fallback YASAK. Hata Sentry'ye ve/veya kullanıcıya yansımalı.
- Boş catch bloğu YASAK.
- Migration'lar sadece `supabase db push`. SQL editor kullanma.
- Film verisinde DELETE yok — curation_tier ile arşivle.
- Feature flag'ler lazy getter ile okunur, modül seviyesi sabit YASAK.
- app_config değerleri istek başına lazy okunur.
- Tüm string'ler t() üzerinden, en.json + tr.json parite (1223/1223).
- Yeni Edge Function'lar jsr: kanalını kullanır (esm.sh değil).
- Mimari karar gerekiyorsa DUR ve sor.
```

### İyi vs kötü kısıt

| ❌ | ✅ |
|---|---|
| "Dikkatli ol" | "`films` tablosunda DELETE yasak — `curation_tier='archive'`" |
| "Mevcut kodu bozma" | "`match_films_v2` imzası değişmeyecek" |
| "Test et" | "`npm run typecheck` çalıştır, tam 14 olmalı, çıktıyı yapıştır" |

---

## 5. CONTEXT VE MODEL

| Komut | Ne zaman |
|---|---|
| `/clear` | **Her yeni task** |
| `/compact` | Uzun task ortası |
| `/context` | Şüphelendiğinde |

Keşif işleri için subagent kullan — kendi context'inde okur, sana özet döner. ⚠️ Subagent-yoğun akış tek oturuma göre belirgin şekilde daha çok token harcar; keşif ve inceleme için kullan, her ufak iş için değil.

| Model | Chosy'de |
|---|---|
| **Opus** | Şema tasarımı, algoritma, zor debug |
| **Sonnet** | Varsayılan geliştirme |
| **Haiku** | Keşif, dosya arama |

✅ Production pipeline'ı (mood parsing, film profiling) **Haiku 4.5** kullanır — maliyet kararı, değişmez. 84 filmin profillenmesi $0,163.

---

## 6. İNCELEME DİSİPLİNİ

### Öncelik sırası

```
1. Migration dosyaları        ← geri alınması en zor
2. Edge Function'lar          ← production'ı doğrudan etkiler
3. Sözleşme/tip tanımları
4. Servis katmanı
5. Ekran/component
6. Stil/token
```

### Her diff için

- [ ] Sessiz fallback var mı? (`catch` bloklarını oku)
- [ ] Modül seviyesi sabit var mı?
- [ ] Mimari karar alınmış mı? (yeni tablo/pattern/bağımlılık)
- [ ] `types/gauntlet.ts` değişmiş mi? → kilitli sözleşme
- [ ] Doğrulama gerçekten çalıştırılmış mı, yoksa "çalışmalı" mı denmiş?
- [ ] `t()` dışında hardcoded string var mı?
- [ ] Token dışında hardcoded renk var mı?

### Kurucu testi otomatik testleri ezer

> ✅ Bu sprintte dört gerçek runtime hatası bulundu; hiçbirini otomatik testler yakalamadı: `useColorScheme` çökme yolu · `winback-sequencer` PromiseLike `.catch` · Spotlight locale i/I · Spotlight ölü hücre. Üçü tip kontrolü açıldıktan sonra, biri kod okumasıyla çıktı.

---

## 7. SUBAGENT VE SKILL SETİ

| Agent | Rol | Araç |
|---|---|---|
| `cto-reviewer` | Diff incelemesi, kural ihlali avı | Salt okunur |
| `migration-guard` | Migration numarası, geri alınabilirlik, RLS | Salt okunur |
| `ui-retrofit-guard` | "Logic değişmez" denetimi | Salt okunur |

**Neden salt okunur:** Yazma yetkisi olan inceleyici kendi bulduğunu sessizce düzeltir ve sen ne olduğunu göremezsin.

| Skill | Tetiklenme |
|---|---|
| `chosy-conventions` | Otomatik — kod yazarken |
| `health-check` | `/health-check` |
| `sprint-close` | `/sprint-close` |
| `gauntlet-contract` | Otomatik — sözleşmeye dokunulunca |

---

## 8. ANTI-PATTERN'LER

| ❌ | ✅ |
|---|---|
| "Şu ekranı düzelt" | "Şu 3 şeyi şu şekilde düzelt, logic'e dokunma" |
| Tek prompt'ta 5 task | Her task ayrı prompt, ayrı `/clear` |
| Doğrulamayı atlamak | Her adımda komut, çıktıyı gör |
| `--dangerously-skip-permissions` | Asla |
| CLAUDE.md'yi şişirmek | Bağlama özel bilgi Skill'e |
| Claude Code'a mimari sormak | Mimari CTO oturumunda |
| Diff'i okumadan commit | Her satırı gör |
| `git commit -- <paths>` | ⚠️ `--only` semantiği index'i atlar, `git rm --cached`'i geri alır. Pathspec kullanma |
| `ReturnType<typeof createClient>` | ⚠️ Jenerikleri varsayılanıyla örnekler, `never` üretir. Gerçek çağrı yerinden türet (`ServiceClient` deseni) |

---

## 9. SPRINT BAŞI SAĞLIK KONTROLÜ

```powershell
npm run test:founder
npm run typecheck            # → 14
npm run typecheck:functions  # → 32   (13 Ağu 2026'da ~~45~~'ten güncellendi)
git status                   # → temiz
```

> **13 Ağustos 2026 — baseline ~~45~~ → 32, kasıtlı güncelleme.** Bu bir sessiz
> düşüş değil: `npm run typecheck:functions` iki bağımsız koşumda `Found 32
> errors.` verdi. Düşüş bu turda olmadı, daha önceki bir turda gerçekleşti ve
> belgeye yansıtılmamıştı. Değer CTO onayıyla güncellendi (13 Ağustos 2026).
>
> ⚠️ Bu dosya güncellemeden önce **üç farklı sayı** taşıyordu: §1.5'te 42,
> burada ve B.3/B.4 prompt bloklarında 45, gerçek 32. Altı yerin tamamı aynı
> turda hizalandı — biri güncellenip diğeri bırakılırsa tutarsızlık geri gelir.

Ayrıca (Claude Code yapamaz, kurucuya sorulur): **Anthropic kredi durumu** · Sentry 7 günlük hata oranı.

⚠️ 14 günlük production kesintisi tam olarak kredi kontrolünün atlanmasından çıktı. **Biri kırmızıysa sprint başlamaz.**

---

# BÖLÜM II — FAZ DURUMU

> **⚠️ B.1–B.5 promptları ARŞİVLENDİ — uygulanmıştır, yeniden koşturulamaz.**
> Aşağıdaki bloklar tarihsel kayıttır. İçlerindeki migration numaraları, "PLAN MODU"
> işaretleri ve DUR NOKTALARI **geçersizdir.** Yeni iş için §1.4'e bak.

## Faz B — ✅ KAPANDI (Ağustos 2026)

| # | İş | Sonuç |
|---|---|---|
| B.1 | Migration 069 — 6 tablo | ✅ Uygulandı. ⚠️ `device_id` kolonları kimlik anti-pattern'i — C.7'de sökülecek |
| B.2 | `types/gauntlet.ts` | ✅ 🔒 Kilitli sözleşme yürürlükte |
| B.3 | `generate-gauntlet` v0 | ⚠️ Kısmen — bkz. aşağıdaki eksik listesi |
| B.4 | `submit-choice` | ✅ |
| B.5 | `recompute-cinema-dna` | ⚠️ `submit-guess`'ten 403 alıyor, 3 haftadır ongoing |

### B.3'ün teslim ETMEDİKLERİ 🔴

`gauntletCore.ts` "yazıldı" ama sözleşmenin üç maddesi karşılanmadı. Bunlar
bug değil, **eksik teslim** — C.2 planlamasında kapsam sayılır:

| Eksik | Durum | Nereye |
|---|---|---|
| Global slot | `generate-global-slot` üretiyor, `generate-gauntlet` **okumuyor**. Slot yalnızca etiket. "Ortak konuşma zemini" ve paylaşım kartı dayanaksız | C.2 |
| `contextPredicted` | Her zaman `false`. Bağlam tahmin motoru yazılmadı | C.3 |
| `refreshesRemaining` | Sabit 2. Harcanan hak düşülmüyor, entitlement kontrolü yok | C.2 |
| Eksen zıtlığı | Yazılmadı — **bilinçli**, Faz F'e ertelendi | F |

## Faz C.0 — üretim öncesi altyapı onarımı

| # | İş | Durum |
|---|---|---|
| C.0b | Cron deseni (migration 077), pg_net doğrulaması | ✅ `last_value` 7→24 |
| C.0c | Kimlik zinciri: `body.user_id` → JWT, `ensureAppUser`, parse-mood 403 | ✅ *(parse-mood deploy'u sürüme bağlı)* |
| C.0d | Migration 078 + `sync-trending` onarımı | 🔄 **AKTİF** |
| C.0e | Havuz kalite filtresi (`gauntletCore.ts`) | ⏸ 078 raporundaki sayılarla başlar |

## Faz sırası 🔒 (12.08.2026 — değiştirildi)

```
C.0d → C.0e → C.7 → C.1 → C.2 → C.3 → C.4 → ...
```

~~C.1 → C.2 → ... → C.7~~

**C.7 neden öne alındı:** 069'daki `device_id` kolonları, C.0c'de kapattığımız
`body.user_id` anti-pattern'inin çekirdek döngüdeki tekrarı. Gauntlet ekranını
kimlik zinciri sağlam olmadan inşa etmek, aynı hatayı daha pahalı bir yerde
yapmaktır. Doğru mekanizma: Supabase Anonymous Sign-In (gerçek `auth.users`
satırı + JWT), cihaz takma adı değil.

**C.7 zorunlu kapsamı:** backfill migration'ı. 87 yetim kimlik kendiliğinden
onarılmayacak — `f44fac2` yalnızca yeni oturumlarda çalışıyor.

---

## B.1 — Gauntlet şeması 🔴 PLAN MODU

> 🗄️ ARŞİV — uygulandı, yeniden koşturma.

```
## BAĞLAM
Ham olay tabloları. Temel prensip: HAM OLAYLARI SAKLA, TÜRETİLMİŞ DURUMU
ASLA TEK KAYNAK YAPMA. cinema_dna bir CACHE'tir, kaynak değil.

Migration numarası: en yüksek 068 → yeni 069. Yine de klasörü listele.

## GÖREV
1. supabase/migrations/ klasörünü listele, en yüksek numarayı doğrula. ONAY BEKLE.

2. Migration 069_gauntlet_events.sql

   choice_events (
     id uuid pk default gen_random_uuid(),
     user_id uuid references auth.users,
     device_id text,                    -- anonim oyun
     gauntlet_id uuid not null,
     session_id uuid not null,
     round int not null check (round between 1 and 3),
     film_a uuid references films not null,
     film_b uuid references films not null,
     winner uuid references films,
     outcome text not null check (outcome in ('choice','neither','seen','timeout')),
     position_of_winner text check (position_of_winner in ('left','right')),
     latency_ms int,
     low_confidence boolean default false,
     context jsonb not null default '{}',
     algorithm_version text not null,
     created_at timestamptz default now()
   )

   watch_feedback (
     id uuid pk, user_id uuid, device_id text,
     film_id uuid references films,
     gauntlet_id uuid,
     response text check (response in ('loved','ok','abandoned','not_watched')),
     asked_at timestamptz, answered_at timestamptz
   )

   duel_impressions (
     user_id uuid, device_id text,
     film_a_id uuid, film_b_id uuid,
     pair_key text generated always as (
       least(film_a_id::text, film_b_id::text) || '|' ||
       greatest(film_a_id::text, film_b_id::text)
     ) stored,
     shown_at timestamptz default now(),
     choice text, latency_ms int, context_hash text
   )

   daily_gauntlets (
     id uuid pk, user_id uuid,          -- null = global slot
     date date not null,
     film_ids uuid[] not null check (array_length(film_ids,1) = 4),
     slot_types text[] not null,
     champion_film_id uuid references films,
     context jsonb,
     relaxed boolean default false,
     algorithm_version text not null,
     generated_at timestamptz default now()
   )

   context_patterns (
     user_id uuid, day_type text, hour_bucket int,
     companion text, duration_pref text, energy text,
     observation_count int default 1, last_seen timestamptz,
     primary key (user_id, day_type, hour_bucket)
   )

   context_corrections (
     id uuid pk, user_id uuid, gauntlet_id uuid,
     predicted jsonb, corrected jsonb, at timestamptz default now()
   )

3. Index'ler:
   choice_events (user_id, created_at desc), (gauntlet_id)
   duel_impressions UNIQUE (user_id, pair_key), UNIQUE (device_id, pair_key)
   daily_gauntlets (user_id, date), (date) where user_id is null
   watch_feedback (user_id, film_id)

4. RLS: her tablo — kullanıcı sadece kendi satırlarını görür.
   daily_gauntlets'te user_id IS NULL satırları HERKESE okunabilir (global slot).

5. Down script yaz.

6. supabase db push. SQL editor KULLANMA.

## KISITLAR
- Mevcut hiçbir tabloyu DEĞİŞTİRME. Sadece yeni tablo.
- films / film_profiles'a DOKUNMA.
- DROP yok, DELETE yok.
- algorithm_version ZORUNLU, nullable olamaz.
- pair_key generated column — uygulama katmanına bırakma.

## DUR NOKTALARI
- Migration numarası onayı
- db push öncesi içerik gösterimi

## DOĞRULAMA
supabase db push
supabase db diff     → boş

select table_name from information_schema.tables
 where table_name in ('choice_events','watch_feedback','duel_impressions',
                      'daily_gauntlets','context_patterns','context_corrections');
→ 6 satır

## RAPOR
- Migration numarası
- 6 tablo + RLS durumu
- pair_key generated column testi (test insert ile göster)
```

**🚦 GATE B.1:** Şema CTO onayı olmadan B.2'ye geçilmez. **Bu şema kilitlenecek.**

---

## B.2 — Kilitli sözleşme

> 🗄️ ARŞİV — uygulandı, yeniden koşturma.
>
> **➕ EK — 14.08.2026 (C.2-0, CTO onaylı):** `DailyGauntlet`'a
> `progress?: GauntletProgress` eklendi (resume yolu: `completedRounds` ·
> `status` · `defender` · `challenger` · `champion` · `exhaustedReason?`).
> Alan EKLEMESİ, şekil değişikliği değil — aşağıdaki arayüzlerin hiçbir
> mevcut alanı değişmedi. Güncel şekil: `types/gauntlet.ts`; gerekçe:
> PRODUCT_OS §11 (14.08.2026).

```
## BAĞLAM
Client ↔ backend sözleşmesi. KİLİTLİ olacak: arkadaki algoritma ne kadar
değişirse değişsin bu arayüz değişmeyecek.

Yol: types/gauntlet.ts  (src/ YOK)

## GÖREV
1. types/gauntlet.ts:

   export interface GauntletContext {
     companion: 'alone' | 'partner' | 'friends' | 'family';
     duration: 'short' | 'medium' | 'any';
     energy: 'drained' | 'normal' | 'open';
   }

   export interface OklchColor { l: number; c: number; h: number }

   export interface GauntletFilm {
     id: string; title: string; year: number;
     runtime: number; posterUrl: string;
     dominantColor?: OklchColor;      // opsiyonel — ışık sızması
   }

   export interface DailyGauntlet {
     gauntletId: string;
     date: string;
     context: GauntletContext;
     contextPredicted: boolean;
     films: GauntletFilm[];              // tam 4, sırası karışık
     slotTypes: ('global'|'personal'|'discovery')[];
     userConfidence: number;             // 0-1
     refreshesRemaining: number;
     algorithmVersion: string;
   }

   export type ChoiceOutcome = 'choice' | 'neither' | 'seen' | 'timeout';

   export interface ChoiceSubmission {
     gauntletId: string; round: 1|2|3;
     filmA: string; filmB: string;
     winner: string | null;
     outcome: ChoiceOutcome;
     positionOfWinner: 'left'|'right'|null;
     latencyMs: number;
   }

2. Dosya başına:
   /**
    * 🔒 KİLİTLİ SÖZLEŞME
    * Bu arayüzü değiştirmek CTO onayı gerektirir.
    * Arkadaki algoritma serbestçe değişebilir; bu şekil değişemez.
    * Değiştirmek zorundaysan DUR ve sor.
    */

3. types/gauntlet.schema.ts — Zod şeması (Edge Function runtime doğrulaması)

4. services/gauntletService.ts iskeleti:
   getTodayGauntlet() · submitChoice() · refreshRound()
   Hepsi şimdilik throw new Error('not implemented')

## KISITLAR
- Mevcut servisleri değiştirme.
- İş mantığı YOK, sadece tip ve iskelet.
- not-implemented gerçekten throw etmeli, boş dönmemeli.

## DOĞRULAMA
npm run typecheck → 14

## RAPOR
- Dosyalar
- Zod şeması tiplerle birebir mi
```

---

## B.3 — generate-gauntlet v0

> 🗄️ ARŞİV — uygulandı, yeniden koşturma.

```
## BAĞLAM
Günün 4 filmini üreten Edge Function. Katman 3 — EN ÇOK DEĞİŞECEK YER.
TÜM algoritma tek dosyada, tam izole. Client asla "neden bu 4 film" bilmez.

v0'da kişiselleştirme YOK: bağlam filtresi + çeşitlilik + rastgele.

Havuz gerçeği: core+extended+trending = 1866, düello-uygun 1865.
archive (1528) migration 050 ile zaten dışlanıyor.

## GÖREV
1. supabase/functions/generate-gauntlet/index.ts
   ⚠️ supabase-js için jsr: kanalını kullan (esm.sh DEĞİL).
   ⚠️ Client'ı ServiceClient deseniyle tiple — ReturnType<typeof createClient>
      KULLANMA, never üretir (winback-sequencer/index.ts:100 örneğine bak).

2. ADIM 1 — SERT FİLTRE
   profile_vector IS NOT NULL
   poster_url IS NOT NULL              ← poster_path DEĞİL
   curation_tier IN ('core','extended','trending')
   runtime <= contextMaxRuntime(context)   // short:110, medium:150, any:999
   NOT IN (izlenenler)                  -- watchlist.watched_at IS NOT NULL
   NOT IN (son 21 gün gösterilenler)
   NOT IN (son 45 gün reddedilenler)
   çift daha önce gösterilmemiş (duel_impressions.pair_key)

   Az aday → SIRAYLA gevşet (cooldown → tier). ASLA boş dönme.
   Gevşetildiyse logla + response'a relaxed: true.

3. ADIM 2 — TANINIRLIK (YÜZDELİK)
   ⚠️ Mutlak eşik KULLANMA. imdb_votes dağılımı iki tepeli ve kolon kirli.
   ⚠️ imdb_votes = 0 → NULL sayılır, ASLA gerçek değer kabul edilmez.

   percent_rank(imdb_votes) havuz içinde, imdb_votes > 0 filtresiyle
   hedef bant 55-80, app_config'ten LAZY:
     recognition_band_low / recognition_band_high
   puan = 1 - |percentile - 67.5| / 32.5, min 0
   imdb_votes NULL → vote_average fallback → o da yoksa 0.4 nötr

4. ADIM 3 — ÇEŞİTLİLİK (sert kurallar)
   aynı yönetmen ≤1 · aynı on yıl ≤2 · aynı birincil tür ≤2 · aynı dil ≤3
   süre yayılımı: ≥1 film <110dk, ≥1 film >130dk
   Bulunamazsa sırayla gevşet: dil → tür → on yıl.
   director NULL → "bilinmeyen yönetmen" bucket'ı, dörtlüde en fazla 1.

5. ADIM 4 — SLOT
   slot 0 global · 1,2 personal · 3 discovery
   v0'da personal ve discovery aynı mantık, sadece etiket.
   Yeni kullanıcı (0 sinyal) → 4'ü de global gauntlet'tan.

6. ADIM 5 — SIRA KARIŞTIRMA
   Rastgele. Skora göre sıralama YASAK (maruz kalma bias'ı).

7. Çift kontrolü: 3 çiftten biri gösterilmişse kombinasyonu reddet,
   yeniden seç. Max 5 deneme.

8. algorithm_version = 'v0-random-diverse'

9. generate-global-slot: her gün UTC 00:00 cron, user_id = NULL.
   Mevcut generate-puzzles cron desenini örnek al.

10. Idempotent: aynı kullanıcı+gün ikinci çağrıda YENİ üretim yapmaz.

## KISITLAR
- Client'a algoritma bilgisi SIZMAYACAK.
- Sessiz fallback YASAK. Aday yoksa Sentry fatal + anlamlı hata. Boş liste dönme.
- Bu fonksiyon DIŞINDA algoritma mantığı YOK.
- match_films_v2'yi DEĞİŞTİRME (okuyabilir, kullanabilirsin).
- app_config LAZY okunur.
- Boş catch yasak.

## DUR NOKTALARI
- Implement etmeden önce boru hattı planını göster

## DOĞRULAMA
supabase functions deploy generate-gauntlet     ← DEPLOY İÇİN ONAY İSTE
npm run typecheck:functions → 32'yi geçmemeli   (~~45~~, 13 Ağu 2026)

10 test çağrısı (3 farklı bağlam):
→ 4 film · 4 farklı yönetmen · ≥1 film <110dk · ≥1 film >130dk
→ aynı çağrı 2. kez → AYNI 4 film

## RAPOR
- 10 çağrıda çeşitlilik kuralları kaç kez gevşetildi
- Ortalama aday havuzu (filtre sonrası)
- En sık ihlal edilen kural
- typecheck:functions kaç (32'den artmamalı — ~~45~~, 13 Ağu 2026)
```

**🚦 GATE B.3:** 10 test çağrısı CTO incelemesinden geçmeden B.4'e geçilmez.

---

## B.4 — submit-choice

> 🗄️ ARŞİV — uygulandı, yeniden koşturma.

```
## BAĞLAM
Her turdaki seçimi kaydeden Edge Function.
Mevcut submit-guess'i desen olarak oku (jsr değil esm.sh kullanıyor —
YENİ fonksiyon jsr kullanacak).

## GÖREV
0. Önce baseline doğrula: npm run typecheck:functions çalıştır, 32 olduğunu
   teyit et ve raporla. types/gauntlet.ts import'unu eklemeden ÖNCE.
   (baseline ~~45~~ → 32, 13 Ağu 2026'da güncellendi)
   Bu Edge Function'ların types/ klasöründen ilk import'u — precedent kırıyor.

1. supabase/functions/submit-choice/index.ts
   Girdi: ChoiceSubmission (Zod ile doğrula)
   ⚠️ 7 Ağu 2026 — "Zod ile doğrula" GEÇERSİZ. B.2'de Zod eklenmedi:
   zod package.json'da tanımlı değil (transitif) ve 20+ Edge Function elle
   doğrulama deseninde. Yerine `types/gauntlet.ts`'teki
   `isValidChoiceSubmission()` import edilir, mevcut
   errorResponse('INVALID_INPUT', ..., 400) desenine bağlanır.
   Çıktı: { next: 'round2'|'round3'|'champion'|'refresh'|'exhausted',
            champion?: GauntletFilm }

2. Mantık:
   'choice'  → kaydet, sonraki tur
   'neither' → TUR HARCANMAZ, aynı tur için yeni çift, refresh azalt
   'seen'    → TUR HARCANMAZ, film değişir, watchlist.watched_at yaz
   'timeout' → kaydet, düşük ağırlık

3. Her seçim → choice_events + duel_impressions

4. Gürültü koruması:
   latency_ms < 1500 → low_confidence = true
   3 art arda <1500ms → oturum low_intent
   rejection_rate > 0.5 → response'a suggest_single_film: true

5. 3. tur bitince şampiyon + daily_gauntlets.champion_film_id

6. Yenileme limiti: Free 2/gün, Pro sınırsız.
   app_config'ten LAZY. Entitlement SUNUCU tarafında.

## KISITLAR
- Cevap/skor mantığı client'a ASLA gitmez.
- Entitlement hatası → kullanıcıyı Free'ye DÜŞÜRME. Sentry + mevcut durumu koru.
- Idempotent: aynı (gauntletId, round) ikinci POST yeni kayıt açmaz.
- jsr: kanalı. ServiceClient deseni.
- Sessiz fallback yasak, boş catch yasak.
- DB CHECK ihlali (örn. choice_events_distinct_films,
  choice_events_outcome_winner_coherence) guard'ı geçip Postgres'e ulaşırsa:
  yakala, 422 + anlamlı mesaj döndür, Sentry fatal. Ham Postgres hatası
  client'a asla sızmaz.
- latencyMs: Number.isInteger(latencyMs) && latencyMs <= 600000 — clamp
  değil, reddet (422). Sessizce 600000'e indirme.

## DOĞRULAMA
Tam akış: choice → round2 · neither → refresh (TUR İLERLEMEMELİ) ·
choice → round3 · choice → champion

select count(*) from choice_events where gauntlet_id = '<test>';
select pair_key from duel_impressions limit 5;   → yön bağımsız

- npm run typecheck:functions → önce (baseline) ve sonra (import eklendikten
  sonra) ölçülüp fark raporlanır. 32'yi aşarsa DUR.   (~~45~~, 13 Ağu 2026)

## RAPOR
- Tam akış çıktısı
- Idempotency testi
- neither'da tur ilerledi mi (İLERLEMEMELİ)
- typecheck:functions önce/sonra farkı
```

---

## B.5 — recompute-cinema-dna uyarlaması

> 🗄️ ARŞİV — uygulandı, yeniden koşturma.

```
## BAĞLAM
cinema_dna artık CACHE. Kaynak: choice_events + watch_feedback.
Mevcut supabase/functions/recompute-cinema-dna var (053_cinema_dna migration).

## GÖREV
1. Mevcut fonksiyonu oku, bana özetle. ONAY BEKLE.

2. Yeni girdi:
   choice_events — kazanan vektörü pozitif, kaybeden negatif
   watch_feedback — loved güçlü+, abandoned güçlü−, ok zayıf+, not_watched nötr

3. Ağırlık:
   meydan okuyucu kazandı 1.0 · 1. savunma 0.9 · 2. savunma 0.8
   low_confidence 0.3 · low_intent oturum 0.1 · watch_feedback loved 3.0

4. Shrinkage:
   taste_vector = w × gözlenen + (1−w) × en_yakın_arketip_merkezi
   w = min(1.0, sinyal_sayısı / 50)
   user_confidence = w  (client gösterecek)

5. TAM YENİDEN HESAPLAMA: --full bayrağı cinema_dna'yı sıfırlayıp
   tüm choice_events geçmişinden yeniden kurar. KRİTİK — algoritma
   değiştiğinde geçmişi kurtarma yolu.

6. 12 arketip küme merkezi: constants/archetypes.ts'ten TÜRET, yenisini uydurma.

## KISITLAR
- choice_events / watch_feedback ASLA silinmez, güncellenmez. Sadece OKU.
- Onboarding quiz'ine dokunma ama ondan veri BEKLEME.
- Sessiz fallback yasak.

## DUR NOKTALARI
- Mevcut fonksiyon özeti sonrası
- --full testi öncesi

## DOĞRULAMA
20 sahte choice_event → user_confidence ~0.4 olmalı
--full iki kez → aynı sonuç (deterministik)
0 sinyalli kullanıcı → arketip prior'u devralmalı, boş vektör OLMAMALI

## RAPOR
- --full deterministik mi
- 0 sinyalde ne oluyor
```

**🚦 GATE B:** Şema kilitlendi, sözleşme donduruldu, 4 Edge Function deploy edildi.

---

## Faz C — Ürün (iş tanımları)

> **⚠️ Bu tablo sırasız.** Faz sırası tek yerde tanımlıdır: BÖLÜM II → "Faz sırası 🔒".
> Buradaki satır düzeni uygulama sırası DEĞİLDİR.

| # | İş | Not |
|---|---|---|
| C.1 | Token katmanı — **159 hardcoded renk** temizliği dahil | `3_DESIGN_OS` §12 |
| C.2 | Gauntlet ekranı → oynanabilir ürün. **B.3 eksik teslimleri kapsam içinde:** global slot okuma + `refreshesRemaining` gerçek düşüm + entitlement | `3_DESIGN_OS` §10.1 · BÖLÜM II |
| C.2b | Işık sızması backend (`films.dominant_color`, w92, LLM yok) | ✅ onaylı |
| C.2c | Işık sızması istemci + erişilebilirlik kapatmaları | |
| C.3 | `ContextBar` + **bağlam tahmin motoru** (`contextPredicted` bugün hep `false`) | |
| **C.4** | **"Dün izledin mi?" + izleme sinyali kurtarma** | 🔴 kritik yol |
| C.5 | Metin paylaşım kartı | Still kullanılmaz. ⚠️ Global slot okunmadan dayanaksız → C.2'ye bağımlı |
| C.6 | Oyun budaması: Spotlight aktif, 6 oyun dondurulur, Roulette/Slot kaldırılır | `app_config.games_enabled` yapısını ÖNCE oku |
| **C.7** | **Kimlik mimarisi + anonim oyun** | 🔴 C.2'nin ön koşulu — aşağıya bak |
| C.8 | Cihaz testi + TestFlight | Sürüm kararı: §3.2 |

### C.7 — tanım değişti 🔒 (12.08.2026)

> ~~**C.7:** Onboarding sıfırlama + anonim oyun (AsyncStorage, SecureStore yok)~~
>
> **Bu tanım mimari olarak yanlıştı ve geri alındı.** AsyncStorage'da tutulan
> cihaz takma kimliği, C.0c'de kapattığımız `body.user_id` anti-pattern'inin
> aynısıdır: kimlik istemcinin beyanından türetiliyor. Kilitli kural (K1) —
> **kimlik çağrı kanalından türetilir.**

**Yeni C.7 kapsamı:**

| # | İş |
|---|---|
| 1 | **Supabase Anonymous Sign-In** — gerçek `auth.users` satırı + JWT. Cihaz takma adı yok |
| 2 | **069 `device_id` kolonlarının sökülmesi** — `choice_events`, `watch_feedback`, `duel_impressions`. Kolon DROP edilmez, yazma yolu kapatılır ve deprecated işaretlenir |
| 3 | **Backfill migration'ı — ZORUNLU.** 87 yetim kimlik (`auth.users` var, `public.users` yok, 2026-04-23'ten beri). `f44fac2` yalnızca yeni oturumlarda çalışıyor; kendiliğinden onarım bu 87'ye ulaşmayacak |
| 4 | `getAppUserId()` 22 çağrı noktasından INSERT yetkisinin alınması (C.0c-5 borcu) |
| 5 | Anonim → kayıtlı geçişte veri taşıma (`auth.users` satırı korunur, kimlik yükseltilir) |
| 6 | Onboarding sıfırlama (quiz kaldırma) — tek bu madde eski tanımdan devam ediyor |

**Neden C.2'den önce:** Gauntlet ekranı `choice_events`'e yazar. Kimlik zinciri
kırıkken yazılan her satır, sonradan hangi kullanıcıya ait olduğu bilinemeyen
ölü veridir. Cinema DNA'nın kaynağı bu tablo — kirli başlarsa `--full`
yeniden hesaplama bile kurtaramaz.

### C.4 neden kritik yol

`watchlist.watched_at` = 0/318 ✅. İzleme bilgisi yalnızca
`AsyncStorage: chosy_watched_films`, sunucuya hiç yazılmıyor. Faz A atlandığı
için **watched-it rate'in tek kaynağı C.4.**

C.4 dört iş birden yapar: (a) **63 kör `.update()` denetimi — ilk madde**,
(b) AsyncStorage → sunucu senkronu, (c) "dün izledin mi?" halkası,
(d) `watchlist.watched_source` kolonu (`manual` | `gauntlet_feedback` | `local_sync`).

---

## Faz D–F

**D** — Arşiv + paywall (entitlement refactor, tek varyant, ilk kaçırılan gün ücretsiz)
**E** — Web gauntlet (Next.js ince istemci) + App Store yeniden konumlandırma + dağıtım
**F** — Kişiselleştirme (MMR λ=0.6, eksen zıtlığı, keşif slotu) — **sözleşme değişmeden, tek dosyada**

---

## C.0d DURUM ÖZETİ ⏳ KOŞULLU — kapanmadı (13 Ağustos 2026)

> **Bu bölüm bir kapanış kaydı DEĞİLDİR.** C.0d'nin kod ve migration tarafı
> bitti; kapanış **17 Ağustos 2026, 06:00 UTC** koşumunun doğrulanmasına
> bağlıdır ve o koşum **bugün itibarıyla henüz gerçekleşmemiştir.**
>
> Gerçekleşmemiş bir olayı geçmiş zamanla kaydetmek, kodda yasakladığımız
> sessiz fallback'in belge karşılığıdır. Aşağıdaki ✅'ler yalnızca
> **13 Ağustos'ta fiilen ölçülmüş** kalemler içindir.
>
> **Kapsam ayrımı (a) — 13 Ağustos CTO kararı:** kapanışa aday olan kalemler
> yalnızca **cron pattern (077)** ve **legacy JWT**'dir; bu ikisi ölçümle
> doğrulandı. **RevenueCat fail-open bu pakete DAHİL DEĞİL** — kod tarafı bu
> turda doğrulanmadı, §10'da 🟠 Yüksek altında açık kalem olarak duruyor.
> Gerekçe: doğrulanmış iki bulguyu doğrulanmamış üçüncüye bağlamak, ileride
> "zaten kapattık" yanılgısı üretir.

Tek bakışta neredeyiz.

### Üretilen migration'lar

| # | Dosya | Tek satır özet |
|---|---|---|
| 078 | `films_schema_reconciliation.sql` | `films` şema borçlarının kapatılması |
| 079 | `trending_tier_restore.sql` | 3 kurban film + 44 filmlik `pre_trending_tier` backfill; `cron_job_status()` migration takibine alındı |
| 080 | `profile_missing_films_cron.sql` | GATE 3 — `profile-missing-films` cron'u, vektörsüz film birikmesini kapatır |
| 081 | `activate_weekly_trending_sync.sql` | Şema değiştirmez; `weekly-trending-sync` `active=true`. Açma kararının denetlenebilir kaydı |

Commit zinciri: `f91e1ae` → `80857fc` → `8fd5f82` → `f1e0163` → `c6947f5`.

**⚠️ 081 job'u yaratmadı, AÇTI.** `weekly-trending-sync`'in kökeni C.0d'den
çok eski — tam geçmiş:

| migration | ne yaptı |
|---|---|
| **049** `trending_sync_cron.sql` | Job'u **yarattı** |
| **077** `cron_pattern_repair.sql` | Desen onarımı — sabit tam URL |
| 078, 079 | `active=false` bırakıldı ("GATE 3 sonrası açılır" notuyla) |
| **081** | `active=true` — **açtı** |

**İsim uyumsuzluğu:** cron job'un adı `weekly-trending-sync`, çağırdığı Edge
Function'ın slug'ı `sync-trending`. İkisi **aynı işin iki adı**, farklı şeyler
değil. Job'un `command`'ı `https://…/functions/v1/sync-trending` URL'ini
çağırıyor (081 yorumunda teyit kaydı var). 049'dan beri süregelen isimlendirme
borcu — `TEKNIK_BORC.md`'ye 🔵 düşük öncelikle kaydedildi.

### Cron durumu — 8 job, **4 aktif**

| jobid | job | schedule | active |
|---|---|---|---|
| 1 | `posterle-daily-curation` | `0 23 * * *` | ❌ |
| **2** | **`cleanup-rate-limits`** | `0 * * * *` | **✅** |
| 3 | `send-daily-pick-hourly` | `0 * * * *` | ❌ |
| 4 | `watchlist-activation-weekend` | `0 15 * * 5` | ❌ |
| 5 | `watchlist-activation-mood-recall` | `0 17 * * 3` | ❌ |
| **6** | **`weekly-trending-sync`** | `0 6 * * 1` | **✅ ← 081 açtı** |
| **7** | **`global-slot-daily`** | `5 0 * * *` | **✅** |
| **18** | **`profile-missing-films`** | `0 8 * * 1` | **✅ ← 080 açtı** |

**🔎 4 pasif job'un durumu belirsiz — C.0e öncesi teyit bekliyor.**
`posterle-daily-curation`, `send-daily-pick-hourly`,
`watchlist-activation-weekend`, `watchlist-activation-mood-recall` pasif.
Bu pasiflik **kasıtlı bir ürün kararı mı**, yoksa C.0b/C.0c'nin "dead cron"
bulgusunun kalıntısı mı **belirlenmedi** — bu tur yalnızca durumu okudu,
sebebini araştırmadı. Kasıtlıysa geçilir; değilse ayrı borç kalemi açılmalı.
C.0e'yi bloklamaz ama C.0e'den önce tek cümleyle teyit edilmeli.

### Sayılar — yalnızca 13 Ağustos'ta fiilen ölçülenler

| Gate | Değer | Ölçüm durumu |
|---|---|---|
| Öneri havuzu | **1.867** film | ✅ ölçüldü (archive hariç) |
| Düello-uygun | **1.867 (%100)** | ✅ ölçüldü (vektör + poster tam) |
| `profile_vector` NULL (aktif tier) | **0** | ✅ ölçüldü |
| `npm run typecheck` | **14** | ✅ koşuldu, hepsi `scripts/` altında |
| `npm run typecheck:functions` | **32** | ✅ koşuldu (`Found 32 errors.`, ~~45~~ baseline'ı bu turda güncellendi) |
| `supabase migration list` | **081** | ✅ koşuldu, local/remote senkron |
| 17 Ağustos otomatik koşum | — | ⏳ **BEKLİYOR — henüz gerçekleşmedi** |
| RevenueCat fail-open kod yolu | — | ⏳ **ölçülmedi**, §10'da açık kalem |

### GATE 3 — 13 Ağustos ölçümü ✅, sürekliliği doğrulanmadı ⏳

**Ölçülen (kesin):** aktif tier'daki (`core`+`extended`+`trending`) **1.867
filmin tamamının** `film_profiles` satırı var ve hiçbirinde `profile_vector`
NULL değil.

**Ölçülmeyen (iddia):** `profile-missing-films` cron'unun bu durumu *sürekli*
koruyacağı. Cron `active=true` ve 080 ile kuruldu, ama **hiç otomatik koşmadı** —
ilk koşumu 17 Ağustos 08:00 UTC. Yani "kendini onaran bir duruma dönüştü"
cümlesi şu an **tasarım iddiasıdır, ölçüm değil.** 17 Ağustos'ta doğrulanacak.

### 🔭 Bir sonraki gerçek test: **17 Ağustos 2026, 06:00 UTC**

`weekly-trending-sync`'in **ilk otomatik koşumu.** Bugüne kadarki tüm
doğrulamalar elle tetiklenmişti; bu, zincirin kendi kendine çalıştığı ilk an.
İki saat sonra (08:00 UTC) `profile-missing-films` devreye girecek.

**İzlenecek 3 madde** (081 migration yorumundan, birebir):

1. `films.curation_tier` dağılımı beklenmedik şekilde kaymadı mı
   *(13 Ağu referansı: core 862 · extended 949 · trending 56 · archive 1.537)*
2. `pre_trending_tier` doğru çalıştı mı — yeni trending filmler için
3. `profile-missing-films` 08:00'de çalışıp yeni filmleri yakaladı mı

> ⚠️ 17 Ağustos koşumu **doğrulanmadan C.0d gerçekten kapanmış sayılmaz.**
> Kod ve migration tarafı bitti; kanıt bekleniyor.

### 🔎 Açık soru — DESIGN_OS mood arama sayısı tanım belirsizliği

`3_CHOSY_DESIGN_OS.md:496` "**57 arama/90 gün**" diyor (mood-search dondurma
gerekçesi). 13 Ağustos ölçümü aynı pencerede **39** verdi — %30 düşüş.

Ancak 13 Ağustos'ta `mood_searches` **toplamı** da 56 ölçüldü, yani 57'ye çok
yakın. Bu, DESIGN_OS'taki "57"nin aslında **90-günlük değil toplam** olması
ihtimalini güçlü kılıyor — yani sapma gerçek bir düşüş değil, etiket hatası
olabilir.

**Yapılacak:** iki sorgu yan yana karşılaştırılmalı — büyük olasılıkla farklı
tanım ya da farklı join kullanılıyor. Çözülene kadar **DESIGN_OS §496'ya
dokunulmadı** (13 Ağustos, CTO kararı): yanlış olduğu kanıtlanmamış bir sayıyı
değiştirmek, doğru olanı bozma riski taşır.

---

## 10. AÇIK BORÇLAR ✅

`docs/TEKNIK_BORC.md`'de kayıtlı. Öncelik = *ne zaman patlar*, ne kadar büyük değil.

### 🔴 Kritik — bloklayıcı

| Kalem | Bloklar |
|---|---|
| `webhook_events` tablosu **hiç yok** — BUSINESS_MODEL §10 Kural 3 ihlali. Webhook düşerse "ödedi ama erişemiyor" sessizce oluşur | Faz D |
| `getAppUserId()` 22 çağrı noktasında hâlâ INSERT yapabiliyor (C.0c-5) | C.7 |
| 75 `.update()`'in ≥63'ü 0-satır durumunu göremiyor → **sessiz başarı** | C.4 |
| `device_id` kimlik olarak kullanılamaz (069 şeması) | C.7 |

> ⚠️ **63 kör `.update()` ile C.4 yazılamaz.** C.4 tek gerçek başarı metriğini
> (watched-it rate) üretiyor. `.update()` 0 satır etkileyip başarı dönerse
> metrik sessizce sıfır kalır ve bunu **fark etmenin yolu olmaz.** C.4'ün ilk
> maddesi yazma yolu denetimidir, "dün izledin mi?" halkası değil.

### 🟠 Yüksek

| Kalem |
|---|
| `submit-guess` → `recompute-cinema-dna` **403**, 3 haftadır ongoing (C.0c-6) |
| 401 sınıflandırıcı: `recommendations.ts:732` anon-key fallback + `matchExplanation` cache zehirlenmesi |
| PostHog Edge'de 3 ayrı isimle okunuyor (`POSTHOG_API_KEY` / `EXPO_PUBLIC_POSTHOG_KEY` / `POSTHOG_HOST`) → tek isme indir |
| 2026-05-11 haftası **32 kimlik kaybı** — `git log 05-04..05-18` incelenmedi |
| supabase-js iki kanal (esm.sh ×16, jsr ×5) → iki ayrı `SupabaseClient` tipi |
| `generate-puzzles` `db()` tiplenmemiş → `as never` gerekti |
| 🔺 **RevenueCat webhook fail-open** — "Kapandı"dan **geri alındı** (13 Ağu 2026, seçenek (a)). Secret yokken auth atlanıyor; isim uyuşmazlığı bunu bir süre canlı yapmıştı. **Neden hâlâ açık:** kod düzeltmesi yazıldı ama **CTO onayı bekliyor** — onaysız deploy edilmedi, dolayısıyla canlıda fail-open yolu kapanmış DEĞİL. Ayrıca §3.2 sürüm kararı gereği düzeltme App Store sürümüne kadar deploy edilmiyor. Kaynak kayıt: `MEMORY.md` → `project_revenuecat_webhook_fail_open.md` ("kod düzeltmesi onay bekliyor"). **Hiçbir turda kod yolu yeniden ölçülmedi** |
| 🔴→🟠 `recommend/index.ts:338-346` — **SCRAM/ASCII bug'ı**, ham `SUPABASE_DB_URL` → `new Client()`. `profile-missing-films` canlı testinde birebir bu hata alındı; `recommend` canlıda muhtemelen **her çağrıda 500** veriyor ve fark edilmemiş. Çözüm A (elle decode) 13 Ağu'da denendi ve **BAŞARISIZ** — çalışan yol PostgREST/supabase-js. Önce (a) hâlâ çağrılıyor mu doğrula (13 Ağu 2026, C.0d) |

### 🟡 Orta

`_shared/sentry.ts` fingerprint iletmiyor · hata kodu→metin eşlemesi iki yerde (`tasteParser.ts` + `errorHelpers.ts`) · `scripts/` 14 tip hatası · `supabase/functions` ~~42~~ **32** tip hatası (13 Ağu 2026 ölçümü) · `QuickResult:83` + `ResultCard:72` inline `GameType` union · Spotlight V2 kalıntı tipleri · **159 hardcoded renk** (C.1 kapsamı)

**13 Ağustos 2026'da eklenenler (C.0d):**

- **`dbRowToRawFilm` iki ayrı kopya** — `scripts/ai-profile-films.ts` ve
  `supabase/functions/profile-missing-films/index.ts` aynı DB satırı →
  `RawFilmJSON` dönüşümünü ayrı ayrı yazıyor. Ayrışırsa **aynı film CLI'den ve
  cron'dan profillenince farklı vektör alır.** Prompt/doğrulama/`CLAUDE_MODEL`
  GATE 3'te `services/filmProfilePrompt.ts`'e çıkarıldı, bu fonksiyon kapsam
  dışında kaldı. Engel: CLI supabase-js üzerinden okuyor (`release_date`
  string), Edge ham SQL üzerinden (`release_date` Date olabiliyor) — ortak
  imza bu farkı normalize etmeli.

- **⏱️ PostToolUse hook `npx tsc --noEmit` bloke ediyor** —
  `PostToolUse [Edit|Write]` → `npx tsc --noEmit`, **ortalama 20 sn, en kötü
  77 sn**. Ölçüm penceresinde **1.122 çalışma ≈ 6,2 saat kümülatif** bloke
  süre. *Kaynak: 13 Ağustos 2026 `/doctor` bakım oturumu tespiti; o turda
  ertelendi, kayıt borcu unutulmuştu — bu satır o borcu kapatıyor.*

### 🟢 Düşük

`The Bourne Ultimatum` `imdb_votes` NULL · archive tier metadata boşlukları (508/506/957) · **`cron_job_status()` `command` kolonunu bilerek döndürmüyor** — yalnızca `jobid, jobname, schedule, active`. 079'daki gerekçe sır sızıntısıydı; 13 Ağu'da doğrulandı ki `command` içinde açık sır **yok** (Vault'a yalnızca isimle başvuruluyor, değer çalışma anında okunuyor — 077'nin bilinçli tasarımı), yani **sızıntı gerekçesi zayıfladı.** Yine de eklenmedi: (1) teşhis aracı, ürün yüzeyi değil — dar kapsam kendi başına değer, (2) Dashboard SQL Editor'dan manuel erişim mümkün. **Yeniden değerlendirme koşulu:** tüm erişim yolları tükenir (PostgREST `cron` şemasını göstermiyor · Docker yok · doğrudan Postgres yok · deno-postgres SCRAM/ASCII engeli) **ve** `command` okumaya düzenli ihtiyaç doğarsa

### Kapandı ✅

~~`send-notifications/index.ts:188` PromiseLike `.catch()`~~ · ~~cron desen bozukluğu (077)~~ · ~~legacy `eyJhbGci` JWT~~

> **13 Ağustos 2026 teyidi — C.0d-partial (cron + JWT).** İki kalem C.0d
> ölçümleriyle yeniden kontrol edildi ve kapalı olduğu **doğrulandı**:
> - **cron desen bozukluğu (077)** — `cron_job_status()` 8 job'ın tamamını
>   sağlam schedule ifadeleriyle döndürüyor; 081 aynı deseni (`cron.alter_job`)
>   kullanarak sorunsuz uygulandı.
> - **legacy `eyJhbGci` JWT** — 13 Ağustos'un tüm canlı sorguları
>   `sb_secret_` kuşağı anahtarla koşuldu, hepsi geçti.
>
> ⚠️ **RevenueCat fail-open bu listeden ÇIKARILDI** (13 Ağustos, CTO kararı,
> seçenek (a)). Daha önce burada "kapandı" olarak duruyordu; kod tarafı hiçbir
> turda yeniden doğrulanmamıştı. 🟠 Yüksek'e taşındı. Gerekçe: ölçülmüş iki
> bulguyu ölçülmemiş bir üçüncüyle aynı torbada kapatmak, ileride "zaten
> kapattık" yanılgısı üretir ve doğrulanmış kapanışı doğrulanmamışa bağlar.

---

*5 Ağustos 2026 · Bağlı: 1_PRODUCT_OS · 2_BUSINESS_MODEL · 3_DESIGN_OS*
*Konfigürasyon: kök `CLAUDE.md` · `.claude/` — settings.json, hooks/, agents/, skills/*
*Emekli agent/skill/command'lar: `.claude/_archive/` (7 Ağu 2026)*

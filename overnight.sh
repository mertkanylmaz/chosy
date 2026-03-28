#!/bin/bash
# MoodFlix Gece Otomasyon Script'i
# Kullanım: cd moodflix && bash overnight.sh
# 
# Bu script Claude Code CLI'yi kullanarak oturumları sırayla çalıştırır.
# Her oturumun çıktısı logs/ klasörüne kaydedilir.
# Hata olursa durur, sabah loglardan kontrol edersin.
#
# ÖNEMLİ: Çalıştırmadan önce:
# 1. SQL gerektiren oturumları Supabase'de çalıştır (aşağıda listelenmiş)
# 2. Bu script'i moodflix proje klasöründe çalıştır
# 3. claude CLI'nin çalıştığından emin ol: claude --version

set -e

LOGDIR="./logs/overnight-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }

SUMMARY="$LOGDIR/00-summary.txt"
echo "MoodFlix Overnight Run - $(date)" > "$SUMMARY"
echo "================================" >> "$SUMMARY"

run_session() {
  local ID="$1"
  local TITLE="$2"
  local PROMPT="$3"
  local LOGFILE="$LOGDIR/${ID//./-}-${TITLE// /-}.log"
  
  log "Oturum $ID: $TITLE başlıyor..."
  echo "" >> "$SUMMARY"
  echo "[$ID] $TITLE" >> "$SUMMARY"
  echo "  Başlangıç: $(date +%H:%M:%S)" >> "$SUMMARY"
  
  # Claude Code'u çalıştır, çıktıyı logla
  if claude -p "$PROMPT" --output-format text > "$LOGFILE" 2>&1; then
    ok "Oturum $ID tamamlandı → $LOGFILE"
    echo "  Durum: ✓ BAŞARILI" >> "$SUMMARY"
    echo "  Bitiş: $(date +%H:%M:%S)" >> "$SUMMARY"
    return 0
  else
    err "Oturum $ID HATA ALDI → $LOGFILE"
    echo "  Durum: ✗ HATA" >> "$SUMMARY"
    echo "  Bitiş: $(date +%H:%M:%S)" >> "$SUMMARY"
    echo "  Hata detayı: $(tail -5 "$LOGFILE")" >> "$SUMMARY"
    return 1
  fi
}

# ============================================================
# HANGİ OTURUMLAR ÇALIŞABİLİR?
# ============================================================
#
# ✅ Otomatik çalışabilir (SQL/görsel gerektirmeyen):
#    0.1, 0.2, 1.1, 1.2, 1.3, 2.1
#
# ⚠️  SQL önce gerekiyor (script çalıştırmadan önce Supabase'de çalıştır):
#    1.1 → ALTER TABLE films ADD COLUMN ...
#    2.3 → match_films fonksiyonu
#    2.4 → watchlist sütunları
#    2.5 → user_stats view
#    3.1 → surprise_picks fonksiyonu
#    4.1 → mood_history view
#
# ❌ Görsel referans gerekiyor (manuel çalıştırılmalı):
#    2.2, 2.3, 2.4, 2.5, 4.1
#
# Bu script sadece Faz 0 + Faz 1 + Faz 2.1'i çalıştırır.
# Bunlar güvenle otomatik çalışabilir.
# ============================================================

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   MoodFlix Gece Otomasyon Başlıyor       ║"
echo "║   Loglar: $LOGDIR    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

TOTAL=0
SUCCESS=0
FAILED=0

# ──────────────────────────────────────────────
# FAZ 0 — TEMİZLİK
# ──────────────────────────────────────────────

log "═══ FAZ 0: TEMİZLİK ═══"

TOTAL=$((TOTAL+1))
if run_session "0.1" "Kirik-duzelt" "Uygulamadaki tüm kırık şeyleri düzelt, yeni özellik EKLEME. Sadece mevcut olan şeylerin çalışmasını sağla.

## 1. Swipe Sistemi Düzeltmesi (components/SwipeCard/)

Swipe davranışını şu şekilde düzelt:

- SAĞA KAYDIRMA (RIGHT): Film kartı sağa tilt olsun, Saved overlay 0.5 saniye gösterilsin, sonra kart eski pozisyonuna dönsün. Film değişMEsin. Watchlist'e ekleme yapılsın.
- SOLA KAYDIRMA (LEFT): Kart sola tilt olsun, Skip overlay 0.5 saniye gösterilsin, kart geri dönsün. Film değişmesin.
- AŞAĞI KAYDIRMA (DOWN): Sonraki filme geç. FlatList snap davranışı ile smooth geçiş.

Swipe threshold: en az 80px hareket olmalı, yanlışlıkla tetiklenmesin.
Animasyonlar react-native-reanimated worklet bazlı olsun, 60fps hedefle.

## 2. Watchlist INSERT Düzeltmesi (services/watchlistService.ts)

a) app/_layout.tsx'de uygulama açılışında signInAnonymously() çağrılıyor mu?
   Çağrılmıyorsa ekle. supabase servisinden al.
   useEffect içinde getSession kontrol et, session yoksa signInAnonymously çağır.

b) addToWatchlist fonksiyonu SADECE user_id ve film_id göndersin.
   supabase.from('watchlist').upsert({ user_id, film_id }, { onConflict: 'user_id,film_id' }) kullan.

c) user_id'yi doğru al:
   Önce auth.getUser() ile auth_id'yi al
   Sonra users tablosundan id'yi bul (auth_id -> id lookup)
   auth_id'yi direkt user_id olarak KULLANMA

d) Tüm watchlist işlemlerini try-catch ile sar.

## 3. Poster URL Düzeltmesi

- getPosterUrl helper fonksiyonu oluştur
- posterPath null ise null dön
- http ile başlıyorsa direkt dön
- Değilse https://image.tmdb.org/t/p/w780 + posterPath dön
- Boşsa placeholder göster
- HER YERDE uygula: SwipeCard, Watchlist, Film Detail

## 4. userProfile Hata Yönetimi

updateUserVectorForFilm ve benzeri fonksiyonları try-catch ile sar.

## 5. Export Default Kontrolü

Tüm screen dosyalarında export default kontrol et.

YAPMA: Yeni ekran/özellik/tema/i18n/tab ekleme. Sadece mevcut kodu düzelt."; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "0.1 başarısız, ama devam ediyorum..."
fi

sleep 3

TOTAL=$((TOTAL+1))
if run_session "0.2" "Akis-baglantisi" "Mood sekmesi ve Feed sekmesi arasındaki akışı bağla:

1. contexts/MoodContext.tsx oluştur:
   - currentProfile: TasteProfile | null
   - currentFilters: FilterParams | null
   - setMoodResult(profile, filters)
   - clearMood()

2. app/_layout.tsx'de MoodProvider ile sar

3. Mood sekmesinde (mood.tsx):
   Find Movies basılınca tasteParser çalıştır
   Sonucu MoodContext'e kaydet
   router.push('/(tabs)/') ile Feed'e navigate et

4. Feed sekmesinde (index.tsx):
   MoodContext'den profile oku
   Profile varsa -> match_films çağır, kartları göster
   Profile yoksa -> Describe your mood mesajı + Go to Mood butonu

5. Ayrı discover.tsx varsa sil. Feed = kartlar."; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "0.2 başarısız, ama devam ediyorum..."
fi

sleep 3

# ──────────────────────────────────────────────
# FAZ 1 — EŞLEŞME KALİTESİ
# ──────────────────────────────────────────────

log "═══ FAZ 1: EŞLEŞME KALİTESİ ═══"

TOTAL=$((TOTAL+1))
if run_session "1.1" "Film-havuzu" "Film veritabanını iyileştir:

1. scripts/fetch-films.ts güncelle:
   TMDb'den şunları çek:
   - /movie/top_rated — 500 film
   - /movie/popular — 300 film
   - /discover/movie?vote_average.gte=7&vote_count.gte=1000 — 200 film
   Toplam ~1000 film. Upsert yap.

2. Her film için credits endpoint'ten:
   Yönetmen -> films.director
   İlk 5 başrol -> films.cast_json
   Ülke -> films.country

3. Orijinal İngilizce isimleri de tut

4. Scripti çalıştır: npx tsx scripts/fetch-films.ts

NOT: .env'de TMDB_API_KEY tanımlı olmalı. Rate limit için 250ms delay.

ÖNEMLİ: films tablosunda director, country, cast_json, backdrop_url, runtime sütunları yoksa önce oluştur:
ALTER TABLE films ADD COLUMN IF NOT EXISTS director text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS country text[];
ALTER TABLE films ADD COLUMN IF NOT EXISTS cast_json jsonb;
ALTER TABLE films ADD COLUMN IF NOT EXISTS backdrop_url text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS runtime int;

Bu ALTER TABLE komutlarını Supabase client ile çalıştır veya migration dosyası oluştur."; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "1.1 başarısız, ama devam ediyorum..."
fi

sleep 3

TOTAL=$((TOTAL+1))
if run_session "1.2" "Profilleme" "scripts/profile-films.ts'deki rule-based profillemeyi iyileştir:

Mevcut sorun: sadece genre'a bakıyor.

1. Genre ağırlıkları:
   Drama -> thematic_depth: 0.7
   Thriller -> fear: 0.6, anticipation: 0.8
   Romance -> joy: 0.7, trust: 0.8

2. Overview keyword analizi (her kategori 50+ keyword):
   Pozitif -> joy | Negatif -> sadness | Gerilim -> fear+anticipation
   Felsefi -> thematic_depth | Görsel -> visual_style: cinematic

3. Runtime: <100dk fast | 100-130 medium | >130 slow

4. Vote >8.0 -> depth+visual boost

5. Country: US=Hollywood, FR=Fransız, JP=Uzakdoğu, KR=Kore

6. Yeniden oluştur:
   npx tsx scripts/profile-films.ts
   npx tsx scripts/seed-database.ts"; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "1.2 başarısız, ama devam ediyorum..."
fi

sleep 3

TOTAL=$((TOTAL+1))
if run_session "1.3" "Taste-parser" "services/tasteParser.ts iyileştir:

Sorun: her girdi benzer profil çıkarıyor.

1. Keyword sözlüğü (EN + TR):
   happy/mutlu -> joy:0.85 | sad/hüzünlü -> sadness:0.85
   scary/korku -> fear:0.8 | angry/öfke -> anger:0.8
   romantic/aşk -> joy:0.7,trust:0.8
   calm/sakin -> energy:0.2 | energetic -> energy:0.9
   slow/yavaş -> pace:slow | fast/hızlı -> pace:fast
   beautiful/güzel -> cinematic | raw/gerçekçi -> raw
   deep/derin -> depth:0.9 | light/hafif -> depth:0.2
   happy ending -> hopeful | sad ending -> tragic | bittersweet

2. Çoklu duygu AND: funny but sad -> joy:0.7 + sadness:0.7

3. Negasyon: not scary -> fear:0.1

4. Varsayılan: belirtilmeyen boyutlar 0.5"; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "1.3 başarısız, ama devam ediyorum..."
fi

sleep 3

# ──────────────────────────────────────────────
# FAZ 2.1 — TEMA (görsel gerektirmiyor)
# ──────────────────────────────────────────────

log "═══ FAZ 2.1: TEMA + FONT ═══"

TOTAL=$((TOTAL+1))
if run_session "2.1" "Tema-font-tab" "Tasarım sistemini kur:

1. Playfair Display yükle:
   npx expo install @expo-google-fonts/playfair-display expo-font

2. constants/colors.ts güncelle:
   background: '#0A0E27', backgroundGradient: '#0D1B2A'
   card: '#1A1F35', cardTransparent: 'rgba(26,31,53,0.8)'
   gold: '#D4A843', goldDark: '#B8922D', goldLight: '#F0D78C'
   textWhite: '#FFFFFF', textGrey: '#8A8290', textLightGrey: '#B0A8B9'
   imdbYellow: '#F5C518', success: '#4ADE80', error: '#FF4444'
   tabBarBg: 'rgba(10,14,39,0.95)'
   tabActive: '#D4A843', tabInactive: '#6A6270'

3. constants/theme.ts oluştur:
   spacing (xs:4, sm:8, md:12, lg:16, xl:20, xxl:24)
   borderRadius (card:16, button:12, chip:20)
   typography (heading: PlayfairDisplay_700Bold, body: system)

4. app/(tabs)/_layout.tsx — 4 tab:
   Feed (Home icon), Watchlist (Bookmark), Mood (Sparkles), Profile (User)
   Tab bar: rgba(10,14,39,0.95), blur efekti
   Aktif: #D4A843, Pasif: #6A6270

5. app/_layout.tsx'de fontu yükle:
   useFonts hook ile PlayfairDisplay_700Bold

6. Tüm mevcut ekranlardaki eski hardcoded renkleri yeni Colors'dan al."; then
  SUCCESS=$((SUCCESS+1))
else
  FAILED=$((FAILED+1))
  warn "2.1 başarısız"
fi

# ──────────────────────────────────────────────
# BİTİŞ
# ──────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          GECE ÇALIŞMASI BİTTİ            ║"
echo "╠══════════════════════════════════════════╣"
printf "║  Toplam: %-3s  Başarılı: %-3s  Hata: %-3s   ║\n" "$TOTAL" "$SUCCESS" "$FAILED"
echo "╠══════════════════════════════════════════╣"
echo "║  Loglar: $LOGDIR  ║"
echo "╚══════════════════════════════════════════╝"

echo "" >> "$SUMMARY"
echo "================================" >> "$SUMMARY"
echo "Toplam: $TOTAL | Başarılı: $SUCCESS | Hata: $FAILED" >> "$SUMMARY"
echo "Bitiş: $(date)" >> "$SUMMARY"

log "Özet: $SUMMARY"
log "Sabah logları kontrol et: ls $LOGDIR/"

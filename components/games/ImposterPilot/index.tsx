/**
 * ImposterPilot — Imposter oynanış ekranının alternatif görsel dili.
 *
 * PILOT. Kabul/red kararı verilene kadar geçici. Doktrin gerekçesi ve
 * silme talimatı: ./pilotTokens.ts dosya başı.
 *
 * Bu bileşen YALNIZCA görsel. Veri yükleme, tahmin gönderimi, otomatik
 * kilitleme, telemetri, paywall ve sonuç ekranı `app/games/imposter.tsx`'te
 * kalır — sunucu sözleşmesi ve Hard Rule 1-5 davranışları değişmez.
 *
 * ── TUR 3 (31 Tem 2026) — "tek sayfa" düzeni ──────────────────────────────
 *   "scroll'u yok et"        → ScrollView kaldırıldı. Ekran bir kez ölçülüyor
 *                              (`onLayout`), kart boyutu kalan yüksekliğe göre
 *                              hesaplanıyor; hiçbir cihazda taşma yok.
 *   "sadece 4 seçenek"       → 2 sütun sabit; 4 seçenek = 2x2. (Henüz
 *                              yenilenmemiş 5-6 seçenekli eski bulmacalar
 *                              3 satıra düşüp yine kaydırmasız sığar.)
 *   "afişi kırpma"           → hero tam kanamalı kırpılmış poster yerine
 *                              `contentFit="contain"` ile TAM poster; üstteki
 *                              brief şeridinde film adı ve soru yanında durur.
 *   "oyuncuların altında     → portrenin ÜSTÜNDEKİ isim şeridi kaldırıldı;
 *    karakter adları"          isim + rol adı portrenin ALTINDA kendi bloğunda.
 *
 * Rol adı (`option.character`) gerçek oyuncuda ekrandaki filmin karakteri,
 * sahtekârda oynadığı BAŞKA bir filmin karakteridir — ipucu bu kıyastan çıkar.
 * Satır ya tüm kartlarda vardır ya hiçbirinde: eksik satır "bu oyuncunun rolü
 * yok" sinyali verip cevabı ele verirdi (bkz. `showCharacters`).
 */
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { CheckCircle, CloudSlash, XCircle } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { gridItemWidth } from '@/constants/gameLayout';
import { useGameContentWidth } from '@/hooks/useGameLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPosterUrl } from '@/services/tmdb';
import type { ImposterRound } from '@/types/game';

import { PilotTokens } from './pilotTokens';
import { styles } from './styles';

/** Izgara sütun sayısı — 4 seçenek 2x2 olsun diye sabit */
const COLUMNS = 2;

/** Kartlar arası boşluk (hem yatay hem dikey) */
const CARD_GAP = 12;

/** Portre en/boy oranı — TMDb profil görselleri 2:3'e yakın */
const PHOTO_ASPECT = 1.4;

/** Kart içi cam çerçeve payı (her kenar) */
const CARD_INSET = 5;

/** İsim + rol bloğunun yüksekliği — iki satır + nefes */
const LABEL_HEIGHT = 44;

/**
 * Brief şeridindeki posterin ekran yüksekliğine oranı ve sınırları.
 * Alt sınır posterin okunurluğu için değil, YANINDAKİ metin sütunu için:
 * rozet + iki satır film adı + soru etiketi + seçim sayacı ~126px tutuyor.
 */
const POSTER_RATIO = 0.22;
const POSTER_MIN = 128;
const POSTER_MAX = 190;

/** Poster çerçevesi 2:3 — TMDb poster oranı, kırpma yok */
const POSTER_ASPECT = 2 / 3;

/** Brief ile ızgara arasındaki dikey boşluk */
const BRIEF_GAP = 16;

/** Cam yüzeylerin bulanıklık şiddeti — daha yükseği zemini tamamen yutuyor */
const GLASS_BLUR = 24;

interface RoundOutcome {
  round: number;
  correct: boolean;
  revealedImposters: string[];
}

interface ImposterPilotProps {
  /** Aktif round verisi */
  round: ImposterRound;
  /** Kaçıncı round (1-3) */
  currentRound: number;
  /** Bu roundda kaç sahte seçilmeli */
  requiredSelections: number;
  /** Seçili aktör id'leri */
  selectedIds: Set<number>;
  /** Aktör kartına dokunuldu */
  onToggle: (actorId: number) => void;
  /** Etkileşim kapalı (gönderim uçuşta) */
  disabled: boolean;
  /** Öğrenme anı görünür mü */
  showReveal: boolean;
  /** Öğrenme anı içeriği */
  outcome: RoundOutcome | null;
  /** Gönderim hatası — sessiz fallback YASAK */
  submitError: boolean;
}

/** Fotoğrafı olmayan aktör için baş harfler */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Ekran ambiyansı — GameShell'in `background` slotuna verilir.
 *
 * Zifiri siyah yerine gece mavisi bir taban, üstüne iki yumuşak neon küre.
 * Küreler `LinearGradient`in şeffafa inen hâlidir; radyal gradyan yerine
 * yuvarlatılmış kutu kullanılıyor — ek bağımlılık gerektirmiyor ve cam
 * yüzeylerin arkasında renk oynaması yaratmaya yetiyor.
 */
export function ImposterBackdrop(): React.ReactElement {
  return (
    <View style={styles.backdrop}>
      <LinearGradient colors={PilotTokens.ambientBase} style={styles.backdropBase} />
      <LinearGradient
        colors={PilotTokens.ambientGlowViolet}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.glowTop}
      />
      <LinearGradient
        colors={PilotTokens.ambientGlowCyan}
        start={{ x: 0.7, y: 1 }}
        end={{ x: 0.1, y: 0 }}
        style={styles.glowBottom}
      />
    </View>
  );
}

/**
 * Imposter oynanış ekranı — tek sayfa, kaydırmasız.
 *
 * Ölçüm sırası: `onLayout` ile kullanılabilir yükseklik alınır → poster ve
 * ızgara payları bölüşülür → kart genişliği hem genişlik hem yükseklik
 * sınırının küçüğünden seçilir. Böylece küçük ekranda kartlar küçülür,
 * hiçbir yerde taşma ya da kaydırma oluşmaz.
 */
export function ImposterPilot({
  round,
  currentRound,
  requiredSelections,
  selectedIds,
  onToggle,
  disabled,
  showReveal,
  outcome,
  submitError,
}: ImposterPilotProps): React.ReactElement {
  const { t } = useLanguage();
  const contentWidth = useGameContentWidth();

  /** Kullanılabilir dikey alan — ilk çizimde 0, ölçümden sonra gerçek değer */
  const [availableHeight, setAvailableHeight] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setAvailableHeight(e.nativeEvent.layout.height);
  }, []);

  const posterHeight = Math.round(
    Math.min(POSTER_MAX, Math.max(POSTER_MIN, availableHeight * POSTER_RATIO)),
  );

  /*
   * Satır sayısı seçenek sayısından gelir: 4 seçenek = 2 satır (istenen düzen),
   * henüz yenilenmemiş 5-6 seçenekli eski bulmacalar 3 satıra düşer ve kartlar
   * kendiliğinden küçülür — kaydırmaya gerek kalmaz.
   */
  const rows = Math.max(1, Math.ceil(round.options.length / COLUMNS));
  const gridHeight = Math.max(0, availableHeight - posterHeight - BRIEF_GAP);
  const cardHeight = Math.floor((gridHeight - CARD_GAP * (rows - 1)) / rows);
  const photoHeight = Math.max(0, cardHeight - LABEL_HEIGHT - CARD_INSET * 2);

  /** Genişlik iki sınırın küçüğü: satır genişliği ve portrenin kendi oranı */
  const widthLimit = gridItemWidth(contentWidth, COLUMNS, CARD_GAP);
  const cardWidth = Math.min(
    widthLimit,
    Math.floor(photoHeight / PHOTO_ASPECT) + CARD_INSET * 2,
  );
  const gridWidth = cardWidth * COLUMNS + CARD_GAP * (COLUMNS - 1);

  const posterUrl = round.poster_url ? getPosterUrl(round.poster_url, 'w500') : null;

  /** Öğrenme anında sahtekârları isimden işaretle (sunucu isim döner) */
  const revealedSet = new Set(
    showReveal && outcome ? outcome.revealedImposters.map((n) => n.toLowerCase()) : [],
  );

  /** Ölçüm gelmeden kart çizilmez — yanlış boyutla bir kare titremesin */
  const measured = availableHeight > 0 && cardWidth > 0;

  /*
   * Rol adı ya HERKESTE çizilir ya HİÇ KİMSEDE.
   *
   * Sunucu artık rolü bilinmeyen oyuncuyu seçeneğe almıyor, ama eski
   * bulmacalarda alan kısmen dolu olabilir. Satırın yalnız bazı kartlarda
   * çıkması cevabı ele verirdi (satır yoksa "bu oyuncunun rolü bilinmiyor" =
   * ayırt edici sinyal). Bu yüzden tek bir eksik varsa katman komple kapanır.
   */
  const showCharacters = round.options.every((o) => !!o.character);

  return (
    <View style={styles.screen} onLayout={handleLayout}>
      {/*
        ── Brief şeridi ──
        Poster KIRPILMIYOR: 2:3 çerçeve içinde `contain`. Yanında round rozeti,
        film adı ve ana yönerge duruyor — dikeyde tek satır yer kaplasın ki
        ızgaraya mümkün olduğunca çok yükseklik kalsın.
      */}
      <View style={[styles.brief, { height: posterHeight }]}>
        <View
          style={[
            styles.posterFrame,
            { height: posterHeight, width: Math.round(posterHeight * POSTER_ASPECT) },
          ]}
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.posterImage}
              contentFit="contain"
              transition={300}
            />
          ) : null}
        </View>

        <View style={styles.briefText}>
          <View style={styles.roundPill}>
            <Text style={styles.roundPillText}>
              {t('games.imposter.round_label', { n: currentRound })}
            </Text>
          </View>

          <Text style={styles.filmTitle} numberOfLines={2}>
            {round.film_title}
          </Text>

          <LinearGradient
            colors={PilotTokens.questionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.questionTag}
          >
            <Text style={styles.questionText} numberOfLines={2}>
              {requiredSelections === 1
                ? t('games.imposter.question')
                : t('games.imposter.question_multi', { count: requiredSelections })}
            </Text>
          </LinearGradient>

          {requiredSelections > 1 ? (
            <Text style={styles.selectionHint}>
              {t('games.imposter.selected', {
                count: selectedIds.size,
                total: requiredSelections,
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {/*
        ── Portre ızgarası ──
        Öğrenme anında da EKRANDA KALIR (eskiden yerini reveal bandına
        bırakıyordu): sahtekârlar kendi kartlarında işaretlenince "hangisiymiş"
        sorusu doğrudan görselin üstünde cevaplanıyor ve düzen zıplamıyor.
      */}
      <View style={styles.gridArea}>
        {measured ? (
          <Animated.View
            entering={FadeInUp.delay(60).duration(220)}
            style={[styles.grid, { width: gridWidth }]}
          >
            {round.options.map((option) => {
              const isSelected = selectedIds.has(option.id);
              const isRevealed = revealedSet.has(option.name.toLowerCase());
              const isWrongPick = showReveal && isSelected && !isRevealed;
              const photoUrl = getPosterUrl(option.profile_path ?? null, 'w185');

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.card,
                    { width: cardWidth, height: cardHeight },
                    isRevealed
                      ? styles.cardImposter
                      : isWrongPick
                        ? styles.cardWrong
                        : isSelected
                          ? styles.cardSelected
                          : styles.cardIdle,
                  ]}
                  onPress={() => onToggle(option.id)}
                  disabled={disabled}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled }}
                  accessibilityLabel={
                    showCharacters && option.character
                      ? `${option.name} — ${t('games.imposter.character_as', {
                          name: option.character,
                        })}`
                      : option.name
                  }
                >
                  {/*
                    Cam çerçeve. Portre içeride küçük bir radius'la oturuyor,
                    aradaki 5px'lik şeritten arka plan gradyanı sızıyor —
                    kartın "yüzen cam" hissi buradan geliyor, opak kutudan değil.
                  */}
                  <BlurView intensity={GLASS_BLUR} tint="dark" style={styles.cardGlass}>
                    <View style={[styles.photoWrap, { height: photoHeight }]}>
                      {photoUrl ? (
                        <Image
                          source={{ uri: photoUrl }}
                          style={styles.photo}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={[styles.photo, styles.photoEmpty]}>
                          <Text style={styles.initials}>{getInitials(option.name)}</Text>
                        </View>
                      )}

                      {/* Seçili: neon yıkama. Kural 1 ve 5'i esneten yer. */}
                      {isSelected && !showReveal ? (
                        <View style={styles.selectWash} pointerEvents="none" />
                      ) : null}

                      {isSelected ? (
                        <Animated.View entering={FadeIn.duration(150)} style={styles.checkBadge}>
                          <CheckCircle
                            size={20}
                            weight="fill"
                            color={
                              isWrongPick
                                ? Colors.error
                                : isRevealed
                                  ? Colors.success
                                  : PilotTokens.selectAccent
                            }
                          />
                        </Animated.View>
                      ) : null}
                    </View>

                    {/*
                      İsim + rol adı portrenin ALTINDA. Rol satırı ya tüm
                      kartlarda vardır ya hiçbirinde — bkz. `showCharacters`.
                    */}
                    <View style={styles.labelBlock}>
                      <Text
                        style={[styles.name, isSelected && styles.nameSelected]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {option.name}
                      </Text>
                      {showCharacters && option.character ? (
                        <Text style={styles.character} numberOfLines={1}>
                          {t('games.imposter.character_as', { name: option.character })}
                        </Text>
                      ) : null}
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        ) : null}
      </View>

      {/*
        ── Öğrenme anı ──
        Akışı bölmesin diye ızgaranın ÜSTÜNE binen bir bant; kartların yerini
        almıyor, dolayısıyla ekran yüksekliği hesabına da girmiyor.
      */}
      {showReveal && outcome ? (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={styles.revealWrap}
          pointerEvents="none"
        >
          <BlurView intensity={GLASS_BLUR} tint="dark" style={styles.revealBand}>
            {outcome.correct ? (
              <CheckCircle size={24} weight="duotone" color={Colors.success} />
            ) : (
              <XCircle size={24} weight="duotone" color={Colors.error} />
            )}
            <View style={styles.revealBody}>
              <Text
                style={[
                  styles.revealTitle,
                  { color: outcome.correct ? Colors.success : Colors.error },
                ]}
              >
                {outcome.correct
                  ? t('games.imposter.round_correct')
                  : t('games.imposter.round_wrong')}
              </Text>
              <Text style={styles.revealSubtext} numberOfLines={2}>
                {t('games.imposter.imposters_were', {
                  names: outcome.revealedImposters.join(', '),
                })}
              </Text>
            </View>
          </BlurView>
        </Animated.View>
      ) : null}

      {/* ── Gönderim hatası — Hard Rule 5 ── */}
      {submitError ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
          <CloudSlash size={18} color={Colors.error} weight="duotone" />
          <Text style={styles.errorText}>{t('games.result.error_subtitle')}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * QuickResult — tek ekranlik oyun sonucu (60 saniye prototipi).
 *
 * ResultCard'in sikistirilmis muadili. ResultCard bes blok dizer
 * (ResultCard govdesi -> DnaXpReveal -> WhyThisMovieFunnel -> ShareCard ->
 * PlayNextBridge) ve scroll gerektirir; oyun 40 saniye surerken sonuc
 * ekrani 40 saniye daha suruyordu.
 *
 * Burada ayni bilgi tek ekrana iner:
 *   poster -> skor noktalari -> XP/DNA tek satir -> kesif -> paylas/bitir
 *
 * Korunan ortak sistemler (ORTAK SISTEM MATRISI):
 * - Cinema DNA + XP: DnaXpReveal animasyon dizisi yerine tek satir rozet.
 *   DNA yazimi zaten sunucuda, burasi yalnizca gosterim.
 * - Film kesfi koprusu: WhyThisMovieFunnel oldugu gibi kullanilir.
 * - ShareCard + game_share_* telemetrisi: ayni GameShareCard capture akisi.
 *
 * Dusen: PlayNextBridge ve geri sayim — "acip kapatma" hissini bozan
 * ikincil bloklar. Hub zaten sonraki oyunu gosteriyor.
 *
 * ── TUR 2 (30 Tem 2026) ───────────────────────────────────────────────────
 * Su an YALNIZ Imposter bu bileseni kullaniyor, bu yuzden gorsel dili
 * ImposterPilot ile ayni tutuluyor (`PilotTokens`). Pilot reddedilirse bu
 * import'un geri alinmasi gerekir — talimat: ImposterPilot/pilotTokens.ts.
 *
 * Geri bildirim karsiliklari:
 *   "Amadeus hala serif"        → film adi sans-serif, agir agirlik
 *   "metin kesiliyor"           → ekran artik ScrollView; kesif karti acilinca
 *                                 icerik tasmiyor, kayiyor ("tek ekran, scroll
 *                                 yok" varsayimi acik aciklamada kiriliyordu)
 *   "poster kucuk"              → 120x180, daha yuvarlak, golgeli
 *   "skor sonuk"                → neon tur isaretleri + mor XP rozeti
 *   "butonlar duz"              → gradyan birincil buton + cam ikincil buton
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Fire, ShareNetwork, Star, XCircle } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { PilotTokens } from '@/components/games/ImposterPilot/pilotTokens';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { getPosterUrl } from '@/services/tmdb';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';
import { WhyThisMovieFunnel } from '@/components/games/WhyThisMovie';
import {
  trackResultCardViewed,
  trackShareRendered,
  trackShareCompleted,
} from '@/utils/gameAnalytics';

import { styles } from './styles';

interface QuickResultProps {
  /** Tam basari mi (tum turlar/denemeler dogru) */
  solved: boolean;
  /** Kazanilan tur/deneme sayisi — nokta gostergesini doldurur */
  score: number;
  /** Toplam tur/deneme sayisi */
  total: number;
  /** Cozum filmi */
  filmTitle: string;
  filmYear?: number;
  /** TMDb poster yolu — `filmPosterUrl` verilmediyse kullanilir */
  filmPosterPath?: string | null;
  /** Hazir poster URL'i (sunucudan gelen oyunlar icin) */
  filmPosterUrl?: string | null;
  /** TMDb ID — `filmUuid` yoksa kesif kartinin film cozumu icin kullanilir */
  filmId?: number;
  /** Supabase `films.id` — varsa tmdb_id aramasi atlanir */
  filmUuid?: string;
  /** Gunluk seri */
  streak: number;
  /** Paylasim kartindaki oyun adi */
  gameTitle: string;
  gameType: 'imposter' | 'logline' | 'quoted' | 'fadein' | 'cinemetrics' | 'spotlight' | 'detective';
  /** Gunun bulmaca numarasi — paylasim kartinda film adi YERINE gosterilir */
  puzzleNo?: number;
  /** Sunucudan gelen XP */
  xpAwarded?: number;
  /** DNA guncellendi mi */
  dnaUpdated?: boolean;
  /** Kesif koprusu metinleri */
  whyThisMovie?: {
    why_text?: string;
    fun_fact?: string;
  };
  /** Hub'a donus */
  onBackToHub: () => void;
}

/**
 * Oyun bitisini tek ekranda toplayan sonuc gorunumu.
 */
export function QuickResult({
  solved,
  score,
  total,
  filmTitle,
  filmYear,
  filmPosterPath,
  filmPosterUrl,
  filmId,
  filmUuid,
  streak,
  gameTitle,
  gameType,
  puzzleNo,
  xpAwarded,
  dnaUpdated,
  whyThisMovie,
  onBackToHub,
}: QuickResultProps): React.ReactElement {
  const { t } = useLanguage();
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture();

  const posterUrl = filmPosterUrl ?? getPosterUrl(filmPosterPath ?? null, 'w342');

  // Gorunum telemetrisi bir kez — ResultCard ile ayni event, karsilastirilabilir kalsin
  const hasTrackedView = useRef(false);
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      trackResultCardViewed(gameType, solved);
    }
  }, [gameType, solved]);

  return (
    <>
      {/* Offscreen paylasim karti — PNG capture icin */}
      <View style={styles.offscreen} pointerEvents="none">
        <GameShareCard
          ref={cardRef}
          gameTitle={gameTitle}
          solved={solved}
          attempts={score}
          maxAttempts={total}
          streak={streak}
          gameType={gameType}
          puzzleNo={puzzleNo}
        />
      </View>

      {/*
        Scroll: kesif karti acildiginda ("Why This Movie?") icerik ekrandan
        tasiyor ve metnin alti kirpiliyordu. Kisa sonuclarda `flexGrow: 1` +
        ortalama sayesinde hala tek ekran gibi duruyor, uzun icerikte kayiyor.
      */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(320)} style={styles.container}>
          {posterUrl ? (
            <View style={styles.posterWrap}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.poster}
                contentFit="cover"
                transition={200}
              />
            </View>
          ) : null}

          <Text style={styles.filmTitle}>{filmTitle}</Text>
          {filmYear && filmYear > 0 ? (
            <Text style={styles.filmYear}>{filmYear}</Text>
          ) : null}

          {/* Skor noktalari — tur tur sonuc, metin okumadan taranir */}
          <View style={styles.dots}>
            {Array.from({ length: total }).map((_, i) =>
              i < score ? (
                <View key={i} style={styles.dotHit}>
                  <CheckCircle size={24} weight="fill" color={PilotTokens.scoreHit} />
                </View>
              ) : (
                <XCircle key={i} size={24} weight="duotone" color={PilotTokens.scoreMiss} />
              ),
            )}
          </View>

          <Text style={[styles.scoreLine, solved && styles.scoreLineSolved]}>
            {t('games.result.quick_score', { score, total })}
          </Text>

          {/* XP + DNA tek satirda — DnaXpReveal'in animasyon dizisi yerine */}
          {xpAwarded != null && xpAwarded > 0 ? (
            <View style={styles.metaRow}>
              <Star size={14} color={PilotTokens.xpAccent} weight="fill" />
              <Text style={styles.metaText}>+{xpAwarded} XP</Text>
              {dnaUpdated ? (
                <>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.metaDna}>{t('games.dna_updated')}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          {streak > 0 ? (
            <View style={styles.streakRow}>
              <Fire size={14} weight="fill" color={PilotTokens.streakAccent} />
              <Text style={styles.streakText}>
                {t('games.result.streak', { count: streak })}
              </Text>
            </View>
          ) : null}

          {/* Kesif koprusu — aciklama zaten varsayilan kapali, dikeyde kisa durur */}
          {whyThisMovie ? (
            <View style={styles.funnelWrap}>
              <WhyThisMovieFunnel
                whyText={whyThisMovie.why_text}
                funFact={whyThisMovie.fun_fact}
                filmTitle={filmTitle}
                filmId={filmId}
                filmUuid={filmUuid}
                gameType={gameType}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            {isShareAvailable && (
              <TouchableOpacity
                style={[styles.shareButton, isCapturing && styles.shareButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('games.result.share_score')}
                accessibilityState={{ disabled: isCapturing }}
                disabled={isCapturing}
                activeOpacity={0.85}
                onPress={async () => {
                  hapticLight();
                  trackShareRendered(gameType);
                  const shared = await share();
                  if (shared) {
                    trackShareCompleted(gameType, 'image');
                  }
                }}
              >
                <LinearGradient
                  colors={PilotTokens.questionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareFill}
                >
                  <ShareNetwork size={16} color={Colors.white} weight="bold" />
                  <Text style={styles.shareText}>{t('games.result.share_score')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.hubButton}
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => {
                hapticLight();
                onBackToHub();
              }}
            >
              <Text style={styles.hubText}>{t('games.result.back_to_hub')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </>
  );
}

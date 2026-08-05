/**
 * GameShell — Tüm oyunları saran ortak wrapper (Festival Layer).
 *
 * Header: geri butonu + (opsiyonel eyebrow) + serif oyun adı + opsiyonel sağ slot
 * Progress: altın segment çubuğu (harcanan deneme dolu)
 * Children: oyun içeriği
 * KeyboardAvoidingView: keyboard açıldığında içerik yukarı kayar
 *
 * ── YERLEŞİM SÖZLEŞMESİ ───────────────────────────────────────────────────
 * Yatay 16px padding'i BU bileşen verir (`styles.content`). Oyunlar kendi
 * içeriklerine `paddingHorizontal` EKLEMEZ ve genişlik hesabında
 * `gameContentWidth()` kullanır — ayrıntı: constants/gameLayout.ts.
 *
 * Alt boşluk `insets.bottom`'dan gelir. Eskiden sabit `paddingBottom: 83`
 * vardı (tab bar payı), ama oyun ekranları root Stack'te — tab bar yok.
 * O sabit 83px ölü alan yaratıp içeriği dikeyde sıkıştırıyordu.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretLeft } from 'phosphor-react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  DEFAULT_GAME_THEME,
  resolveGameTheme,
  type GameTheme,
  type GameType,
} from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';

import { GameBackdrop } from '../GameBackdrop';
import { GlassSurface } from '../GlassSurface';
import { styles } from './styles';

// ─── Tema dağıtımı ───────────────────────────────────────────────────────────

/**
 * `null` = provider yok. `DEFAULT_GAME_THEME`'i doğrudan varsayılan yapmak
 * cazip ama yanlış olurdu: o zaman provider'sız kullanım sessizce base temayla
 * çalışır ve fark edilmezdi. Ayrımı `null` ile koruyup `useGameTheme()`
 * içinde açıkça uyarıyoruz.
 */
const GameThemeContext = createContext<GameTheme | null>(null);

/**
 * Belirli bir oyunun temasını çözer — **`GameShell`'i RENDER EDEN ekran** için.
 *
 * Ekran bileşeni `GameShell`'in ebeveynidir, yani provider'ın DIŞINDADIR ve
 * `useGameTheme()` orada çalışmaz (DEFAULT'a düşer + uyarır). Ekranlar temayı
 * doğrudan buradan alır.
 *
 * Sapmayı önlemek için ekranda tek bir sabit tutulur ve ikisine de o verilir:
 * ```ts
 * const GAME_TYPE = 'cinemetrics' as const;
 * const theme = useGameThemeFor(GAME_TYPE);
 * // ...
 * <GameShell gameType={GAME_TYPE} …>
 * ```
 *
 * `GameShell`'in İÇİNDE yaşayan bileşenler bunu değil `useGameTheme()` kullanır.
 */
export function useGameThemeFor(gameType: GameType): GameTheme {
  return useMemo(() => resolveGameTheme(gameType), [gameType]);
}

/**
 * Aktif oyunun temasını okur — **`GameShell`'in İÇİNDEKİ** bileşenler için.
 *
 * Ortak bileşenler (`FilmSearchInput`, `GameStateView`, `HintBoard`) bunu
 * prop drilling olmadan kullanır. **Yalnız oynanış katmanı** temaya bağlanır;
 * ödül katmanı (`ResultCard`, `DnaXpReveal`, `ConfidenceSelector`,
 * `WhyThisMovie`, `PlayNextBridge`, `GameShareCard`) altında kalır —
 * bkz. `DESIGN_SYSTEM.md` › Oyun Temaları › Katman ayrımı.
 *
 * Provider dışında çağrılırsa `DEFAULT_GAME_THEME` döner **ve** `__DEV__`
 * altında uyarır. Sessizce `undefined` tema render edilmez
 * (CLAUDE.md Oyun Sistemi Hard Rule 5 — "silent fallback yasak").
 */
export function useGameTheme(): GameTheme {
  const theme = useContext(GameThemeContext);

  if (theme === null) {
    if (__DEV__) {
      logger.warn(
        '[useGameTheme] GameShell provider bulunamadı — DEFAULT_GAME_THEME (altın/base) ' +
          'kullanılıyor. Bu bileşen bir oyun ekranı dışında render ediliyorsa temaya ' +
          'bağlanmamalı; oyun ekranındaysa GameShell eksik.',
      );
    }
    return DEFAULT_GAME_THEME;
  }

  return theme;
}

/**
 * `floatingHeader` açıkken içeriğin ilk render'da alacağı üst boşluk tahmini.
 * Gerçek değer `onLayout` ile ölçülüp yerine geçer; bu yalnız ilk karede
 * içeriğin header'ın altında doğmasını engeller.
 */
const HEADER_HEIGHT_ESTIMATE = 96;

/** Başlığın küçülmesini tamamladığı scroll mesafesi (px) */
const TITLE_COLLAPSE_DISTANCE = 64;

/**
 * Yüzen cam chrome'un ölçülen yüksekliği — oyuna render-prop ile geçilir.
 *
 * Bu değerin ScrollView'ün SARMALAYICISINA padding olarak verilmesi YANLIŞ
 * olurdu: o zaman ScrollView header'ın altında başlar ve içerik camın altından
 * hiç geçmez — cam dekorasyona düşer. Doğrusu, oyunun kendi
 * `contentContainerStyle`'ına `paddingTop` olarak koyması; böylece içerik
 * gerçekten camın arkasından akar.
 */
export interface GameShellChrome {
  /** Yüzen cam header'ın kapladığı üst boşluk (yığılmış yerleşimde 0) */
  topInset: number;
}

interface GameShellProps {
  /**
   * Oyun kimliği — temanın kaynağı. **Zorunlu.**
   *
   * GameShell bundan `resolveGameTheme()` ile temayı çözer, `GameBackdrop`'u
   * kendisi render eder ve alt ağaca `GameThemeContext` ile dağıtır. Oyun
   * ekranı ambiyanstan haberdar değildir.
   *
   * Opsiyonel bırakılmadı: varsayılan bir tema sessizce base dile düşerdi ve
   * yeni bir oyun eklendiğinde temasız kaldığı fark edilmezdi.
   */
  gameType: GameType;
  /** Oyun başlığı — serif, header ortası */
  title: string;
  /**
   * Başlığın üstündeki mikro etiket — "CASE #041", "LOG #128".
   * Büyük harfe stil katmanında çevrilir, çağıran tarafta uppercase yazmaya gerek yok.
   */
  subtitle?: string;
  /** Header sağ slotu — paylaş, bilgi vb. Verilmezse boş bırakılır (başlık ortalı kalsın diye) */
  headerRight?: React.ReactNode;
  /** Mevcut deneme sayısı */
  currentAttempt: number;
  /** Maksimum deneme sayısı */
  maxAttempts: number;
  /**
   * Oyun içeriği.
   *
   * Fonksiyon verilirse ölçülen chrome bilgisi geri geçilir — `floatingHeader`
   * kullanan ekranlar `topInset`'i kendi `contentContainerStyle`'ına koyar ki
   * içerik camın arkasından aksın.
   */
  children: React.ReactNode | ((chrome: GameShellChrome) => React.ReactNode);
  /** Progress göstergesini gizle (opsiyonel) */
  hideProgress?: boolean;
  /**
   * İçerik alanının yatay padding'i. Varsayılan `true`.
   *
   * `false` verildiğinde içerik tam kanamalı (edge-to-edge) olur ve padding
   * sorumluluğu ekrana geçer — tam genişlik portre/poster ızgaraları için.
   */
  contentPadding?: boolean;
  /**
   * Header + progress'i cam bir chrome katmanına alır ve içeriğin ALTINDAN
   * kaymasına izin verir (Liquid Glass hiyerarşisi: kontrol yüzer, içerik önceliklidir).
   *
   * Varsayılan `false` — mevcut oyunların yığılmış (stacked) yerleşimi aynen korunur.
   * Yalnız kendi `ScrollView`'ü olan ekranlarda `true` verilmeli: cam, arkasında
   * kayan bir içerik olduğu için vardır. Sağlama sorusu ve doktrin:
   * DESIGN_SYSTEM.md › Festival Layer › "Cam Katmanı".
   */
  floatingHeader?: boolean;
  /**
   * İçerik ScrollView'ünün dikey offset'i. Verilirse başlık scroll'da küçülür
   * (klasik iOS büyük başlık → küçük başlık geçişi).
   *
   * Yalnız `floatingHeader` ile anlamlıdır. Ekran tarafında
   * `useAnimatedScrollHandler` veya `onScroll` ile beslenir.
   */
  scrollY?: SharedValue<number>;
}

/**
 * Oyun ekranlarının ortak kabuğu. Header, ilerleme çubuğu ve klavye davranışını
 * tek yerde toplar — oyunlar yalnız kendi içeriklerini render eder.
 */
export function GameShell({
  gameType,
  title,
  subtitle,
  headerRight,
  currentAttempt,
  maxAttempts,
  children,
  hideProgress = false,
  contentPadding = true,
  floatingHeader = false,
  scrollY,
}: GameShellProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const theme = useMemo(() => resolveGameTheme(gameType), [gameType]);

  /** Ölçülen chrome yüksekliği — içeriğin üst boşluğu buradan gelir */
  const [chromeHeight, setChromeHeight] = useState(HEADER_HEIGHT_ESTIMATE);

  /**
   * `scrollY` opsiyonel ama hook koşullu çağrılamaz — verilmediğinde sabit 0
   * kalan bir yedek shared value kullanılır, yani başlık hiç küçülmez.
   */
  const fallbackScrollY = useSharedValue(0);
  const offset = scrollY ?? fallbackScrollY;

  /**
   * Başlık scroll'da küçülür. Yalnız `transform` kullanılıyor — `fontSize`
   * animasyonu her karede layout tetikleyip jank üretirdi.
   */
  const titleAnimatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      offset.value,
      [0, TITLE_COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: 1 - progress * 0.18 }],
    };
  });

  /** Eyebrow küçülmeyle birlikte silinir — üst barda iki satır kalabalık yapıyor */
  const eyebrowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offset.value,
      [0, TITLE_COLLAPSE_DISTANCE * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Cam chrome kendi safe-area boşluğunu taşır; container'ınki sıfırlanır ki
  // bulanıklık durum çubuğunun altına kadar uzansın.
  const containerPaddingTop = floatingHeader ? 0 : insets.top;

  const chrome = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSlot}
          accessibilityRole="button"
          accessibilityLabel={t('games.common.back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            hapticLight();
            router.back();
          }}
        >
          <CaretLeft size={24} color={Colors.textWhite} weight="duotone" />
        </TouchableOpacity>

        <Animated.View style={[styles.titleBlock, floatingHeader && titleAnimatedStyle]}>
          {subtitle ? (
            <Animated.Text
              style={[styles.eyebrow, floatingHeader && eyebrowAnimatedStyle]}
              numberOfLines={1}
            >
              {subtitle}
            </Animated.Text>
          ) : null}
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </Animated.View>

        <View style={styles.headerSlot}>{headerRight}</View>
      </View>

      {/* Progress — harcanan deneme temanın gradyanı, kalan sönük */}
      {!hideProgress && maxAttempts > 1 && (
        <View
          style={styles.progressRow}
          accessibilityRole="progressbar"
          accessibilityLabel={t('games.common.progress_label', {
            current: currentAttempt,
            total: maxAttempts,
          })}
        >
          {Array.from({ length: maxAttempts }).map((_, i) => {
            const used = i < currentAttempt;
            if (used) {
              return (
                <LinearGradient
                  key={i}
                  colors={theme.progressGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.segment}
                />
              );
            }
            return <View key={i} style={[styles.segment, styles.segmentEmpty]} />;
          })}
        </View>
      )}
    </>
  );

  return (
    <GameThemeContext.Provider value={theme}>
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          paddingTop: containerPaddingTop,
          // Sabit 83 (tab bar payı) kaldırıldı — oyunlar tab bar'ın içinde değil.
          // Gesture bar'ı olmayan cihazlarda insets.bottom 0 gelir, o yüzden taban.
          paddingBottom: Math.max(insets.bottom, Theme.spacing.sm),
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // paddingBottom 83 iken klavye telafisi de 83 idi; padding gidince
      // offset de gitmeli, yoksa klavye açılınca içerik 83px fazla kayar.
      keyboardVerticalOffset={0}
    >
      {/*
        Ambiyans — her şeyin arkasında, dokunma almaz. Temadan gelir, oyun
        ekranı bundan haberdar değildir.

        Negatif inset'ler: mutlak konumlu çocuk ebeveynin PADDING kenarına göre
        yerleşir, yani safe-area padding'i kadar içeride başlar. Gradyanın
        durum çubuğunun ve gesture bar'ın altını da boyaması gerekiyor.
      */}
      <View
        style={[
          styles.backdrop,
          { top: -containerPaddingTop, bottom: -Math.max(insets.bottom, Theme.spacing.sm) },
        ]}
        pointerEvents="none"
      >
        <GameBackdrop theme={theme} />
      </View>

      {/*
        Yığılmış yerleşim (varsayılan) — header ve progress içeriği yukarı iter.
        Dört oyunun mevcut davranışı budur, değişmedi.
      */}
      {!floatingHeader && chrome}

      {/*
        Content — padding sözleşmesi: yatay boşluğu burası verir.
        Dikey boşluk BURADA verilmez: yüzen chrome'da içerik tam yükseklikte
        kalmalı ki camın altından akabilsin. Üst boşluğu oyun kendi
        contentContainerStyle'ında `useGameChromeInset()` ile verir.
      */}
      <View style={contentPadding ? styles.content : styles.contentFlush}>
        {typeof children === 'function'
          ? children({ topInset: floatingHeader ? chromeHeight : 0 })
          : children}
      </View>

      {/*
        Cam chrome — içeriğin ÜSTÜNDE yüzer (Liquid Glass hiyerarşisi).
        En sona konuyor ki zIndex'e gerek kalmadan çizim sırası onu öne alsın.
      */}
      {floatingHeader && (
        <GlassSurface
          radius={0}
          noBorder
          noShadow
          style={styles.floatingChrome}
          contentStyle={{ paddingTop: insets.top }}
          onLayout={(e) => setChromeHeight(e.nativeEvent.layout.height)}
        >
          {chrome}
        </GlassSurface>
      )}
    </KeyboardAvoidingView>
    </GameThemeContext.Provider>
  );
}

/**
 * HintBoard — FadeIn ipucu secim izgarasi.
 *
 * Oyuncu her yanlis tahminde 1 ipucu kredisi kazanir ve krediyi
 * istedigi kategoriye harcar. Sirali otomatik acilma YOK — secim
 * oyuncunun karar katmanidir (GAME_INNER_DYNAMICS.md, Tier 2.2).
 *
 * Kilitli kartlar yalnizca kategori etiketini gosterir; icerik
 * ancak acilinca gorunur.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Lightbulb, Lock } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { FadeInHintStub } from '@/types/game';

import { styles } from './styles';

interface HintBoardProps {
  /** Bulmacadaki tum ipucu iskeletleri (order'a gore sirali) — icerik tasimazlar */
  hints: FadeInHintStub[];
  /** Acilmis ipuclarinin order degerleri */
  revealedOrders: number[];
  /** Acilmis ipuclarinin icerigi (order -> metin) — sunucudan gelir */
  contents: Record<number, string>;
  /** Harcanabilir ipucu hakki */
  credits: number;
  /** Bir kart acilmak istendiginde */
  onReveal: (hint: FadeInHintStub) => void;
  /** Oyun bitti/istek ucusta — etkilesim kapali */
  disabled?: boolean;
}

/**
 * Ipucu kartlari listesi.
 */
export function HintBoard({
  hints,
  revealedOrders,
  contents,
  credits,
  onReveal,
  disabled = false,
}: HintBoardProps): React.ReactElement | null {
  const { t } = useLanguage();

  if (hints.length === 0) return null;

  const canSpend = credits > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('games.fadein.hints_title')}</Text>
        {/*
          Cip 0 kredide de gorunur. Gizlendiginde oyuncu kredi diye bir
          mekanik oldugunu hic fark etmiyordu.
        */}
        <Animated.View
          entering={FadeIn.duration(220)}
          style={[styles.creditChip, credits === 0 && styles.creditChipEmpty]}
        >
          <Lightbulb
            size={13}
            weight="duotone"
            color={credits > 0 ? Colors.gold : Colors.textGrey}
          />
          <Text style={[styles.creditText, credits === 0 && styles.creditTextEmpty]}>
            {t(
              credits === 1 ? 'games.fadein.hint_credits' : 'games.fadein.hint_credits_plural',
              { count: credits },
            )}
          </Text>
        </Animated.View>
      </View>

      <Text style={styles.prompt}>
        {canSpend ? t('games.fadein.hint_choose') : t('games.fadein.hint_no_credit')}
      </Text>

      <View style={styles.list}>
        {hints.map((hint) => {
          const isRevealed = revealedOrders.includes(hint.order);
          const isUnlockable = !isRevealed && canSpend;

          return (
            <TouchableOpacity
              key={hint.order}
              style={[
                styles.card,
                isRevealed && styles.cardRevealed,
                isUnlockable && styles.cardUnlockable,
                !isRevealed && !isUnlockable && styles.cardDisabled,
              ]}
              onPress={() => onReveal(hint)}
              disabled={isRevealed || !canSpend}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ disabled: isRevealed || !canSpend }}
              accessibilityLabel={t(`games.fadein.hint_type_${hint.type}`)}
            >
              <View style={styles.iconSlot}>
                {isRevealed ? (
                  <Lightbulb size={18} weight="duotone" color={Colors.gold} />
                ) : (
                  <Lock size={18} weight="duotone" color={Colors.textGrey} />
                )}
              </View>

              <View style={styles.textSlot}>
                <Text style={styles.typeLabel}>{t(`games.fadein.hint_type_${hint.type}`)}</Text>
                {isRevealed ? (
                  <Animated.Text entering={FadeIn.duration(260)} style={styles.content}>
                    {contents[hint.order] ?? ''}
                  </Animated.Text>
                ) : (
                  // Maliyet her kilitli kartta yazili — mekanik bu satirdan okunuyor
                  <Text style={styles.lockedLabel}>{t('games.fadein.hint_cost')}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

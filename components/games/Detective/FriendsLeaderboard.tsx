/**
 * FriendsLeaderboard — Arkadas sonuclari listesi.
 *
 * MVP: Opsiyonel. Social graph gerektirir.
 * Veri yoksa null doner — ekranda yer kaplamaz.
 */
import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Users } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

interface Friend {
  name: string;
  guesses: number;
  solved: boolean;
}

interface FriendsLeaderboardProps {
  /** Arkadas sonuclari (bos = gosterme) */
  friends: Friend[];
}

/**
 * FriendsLeaderboard — Arkadaslarin bugunku sonuclari.
 */
export function FriendsLeaderboard({ friends }: FriendsLeaderboardProps) {
  const { t } = useLanguage();

  if (friends.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(1000).duration(400)} style={localStyles.container}>
      <View style={localStyles.header}>
        <Users size={16} color="#0D9488" weight="duotone" />
        <Text style={localStyles.title}>{t('games.detective.friends_title')}</Text>
      </View>

      {friends.map((friend, idx) => (
        <View key={idx} style={localStyles.row}>
          <Text style={localStyles.name}>{friend.name}</Text>
          <Text style={[localStyles.result, !friend.solved && localStyles.resultFailed]}>
            {friend.solved
              ? `${friend.guesses} ${t('games.detective.guesses_label').toLowerCase()}`
              : t('games.detective.community_failed')}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={localStyles.ctaButton} activeOpacity={0.7} accessibilityRole="button" >
        <Text style={localStyles.ctaText}>{t('games.detective.friends_beat')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  result: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  resultFailed: {
    color: Colors.error,
  },
  ctaButton: {
    backgroundColor: 'rgba(13,148,136,0.15)',
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.35)',
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.tealDeep,
  },
});

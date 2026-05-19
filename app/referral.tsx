/**
 * Referral Program — davet et, odul kazan ekrani.
 *
 * Sections:
 *   1. Hero + invite count
 *   2. Invite code + copy/share
 *   3. Next reward progress bar
 *   4. Milestone roadmap
 *   5. Earned rewards list
 *
 * Entry points:
 *   - Profile > Settings > "Invite Friends"
 *   - Home dashboard widget
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getReferralStats,
  getShareLink,
  shareInviteLink,
  getReferralMilestones,
  type ReferralStats,
  type ReferralMilestone,
} from '@/services/referralService';
import { getAppUserId } from '@/services/watchlist';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReferralScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const userId = await getAppUserId();
        if (!userId) return;

        const data = await getReferralStats(userId);
        if (data) {
          setStats(data);
          setMilestones(getReferralMilestones(data.activatedReferrals));
        }
      } catch (err) {
        logger.error('[referral] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Copy link handler ──────────────────────────────────────────────────
  const handleCopyLink = useCallback(async () => {
    if (!stats?.inviteCode) return;
    hapticLight();

    const link = getShareLink(stats.inviteCode);
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stats?.inviteCode]);

  // ── Share handler ──────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!stats?.inviteCode) return;
    hapticLight();

    const message = t('referral.shareMessage', { code: stats.inviteCode });
    await shareInviteLink(stats.inviteCode, message);
  }, [stats?.inviteCode, t]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accentPrimary} size="large" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const activatedCount = stats?.activatedReferrals ?? 0;
  const nextMilestone = stats?.nextMilestone;
  const progress = stats?.progress ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { if (router.canGoBack()) router.back(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('referral.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Hero Stats ───────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="people" size={32} color={Colors.accentPrimary} />
          </View>
          <Text style={styles.heroCount}>
            {t('referral.invitedCount', { count: stats?.totalReferrals ?? 0 })}
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.gold} />
              <Text style={styles.heroStatText}>
                {t('referral.activatedCount', { count: activatedCount })}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Ionicons name="time-outline" size={14} color={Colors.textGrey} />
              <Text style={styles.heroStatText}>
                {t('referral.pendingCount', { count: stats?.pendingReferrals ?? 0 })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Invite Code Card ─────────────────────────────────────── */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>{t('referral.inviteCodeLabel')}</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{stats?.inviteCode ?? '...'}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopyLink}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copied ? Colors.gold : Colors.accentPrimary}
              />
              <Text style={[styles.copyBtnText, copied && styles.copyBtnTextCopied]}>
                {copied ? t('referral.copiedLink') : t('referral.copyLink')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Share button */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={Colors.textOnAccent} />
            <Text style={styles.shareBtnText}>{t('referral.shareButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Next Reward Progress ─────────────────────────────────── */}
        {nextMilestone && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>{t('referral.nextRewardTitle')}</Text>
            <Text style={styles.progressLabel}>
              {t('referral.progressLabel', {
                current: activatedCount,
                target: nextMilestone,
              })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressReward}>
              {stats?.nextReward ? t(`referral.reward${nextMilestone}`) : ''}
            </Text>
          </View>
        )}

        {/* ── Milestone Roadmap ────────────────────────────────────── */}
        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesTitle}>{t('referral.milestoneTitle')}</Text>
          {milestones.map((milestone, index) => (
            <View
              key={milestone.count}
              style={[styles.milestoneRow, milestone.achieved && styles.milestoneRowAchieved]}
            >
              {/* Connector line */}
              {index > 0 && (
                <View
                  style={[
                    styles.milestoneConnector,
                    milestone.achieved && styles.milestoneConnectorActive,
                  ]}
                />
              )}

              <View
                style={[
                  styles.milestoneIcon,
                  milestone.achieved && styles.milestoneIconAchieved,
                ]}
              >
                <Ionicons
                  name={milestone.achieved ? 'checkmark' : (milestone.iconName as keyof typeof Ionicons.glyphMap)}
                  size={16}
                  color={milestone.achieved ? Colors.textOnAccent : Colors.textGrey}
                />
              </View>

              <View style={styles.milestoneInfo}>
                <Text
                  style={[
                    styles.milestoneCount,
                    milestone.achieved && styles.milestoneCountAchieved,
                  ]}
                >
                  {milestone.count} {milestone.count === 1 ? 'referral' : 'referrals'}
                </Text>
                <Text style={styles.milestoneReward}>{t(milestone.rewardKey)}</Text>
              </View>
            </View>
          ))}

          {activatedCount >= 10 && (
            <Text style={styles.allComplete}>{t('referral.allMilestonesComplete')}</Text>
          )}
        </View>

        {/* ── Earned Rewards ───────────────────────────────────────── */}
        <View style={styles.rewardsSection}>
          <Text style={styles.rewardsTitle}>{t('referral.rewardsEarnedTitle')}</Text>
          {(stats?.rewards.length ?? 0) === 0 ? (
            <Text style={styles.noRewards}>{t('referral.noRewardsYet')}</Text>
          ) : (
            stats?.rewards.map((reward, i) => (
              <View key={`${reward.type}-${i}`} style={styles.rewardRow}>
                <Ionicons name="gift" size={18} color={Colors.gold} />
                <Text style={styles.rewardText}>
                  {t(`referral.reward${reward.count}`)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 83,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // ── Hero Card ──────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroCount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textWhite,
    marginBottom: 8,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroStatText: {
    fontSize: 13,
    color: Colors.textGrey,
    fontWeight: '500',
  },

  // ── Code Card ──────────────────────────────────────────────────────────
  codeCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 20,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textGrey,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Theme.borderRadius.md,
    padding: 14,
    marginBottom: 14,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.accentPrimary,
    letterSpacing: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 13,
    color: Colors.accentPrimary,
    fontWeight: '600',
  },
  copyBtnTextCopied: {
    color: Colors.gold,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Theme.borderRadius.md,
    height: 48,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  // ── Progress Card ──────────────────────────────────────────────────────
  progressCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 20,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.textGrey,
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.white10,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 4,
  },
  progressReward: {
    fontSize: 14,
    color: Colors.accentPrimary,
    fontWeight: '600',
  },

  // ── Milestones ─────────────────────────────────────────────────────────
  milestonesSection: {
    marginBottom: 20,
  },
  milestonesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 16,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 14,
    position: 'relative',
  },
  milestoneRowAchieved: {
    opacity: 1,
  },
  milestoneConnector: {
    position: 'absolute',
    left: 17,
    top: -10,
    width: 2,
    height: 20,
    backgroundColor: Colors.white10,
  },
  milestoneConnectorActive: {
    backgroundColor: Colors.accentPrimary,
  },
  milestoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2,
    borderColor: Colors.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneIconAchieved: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textGrey,
    marginBottom: 2,
  },
  milestoneCountAchieved: {
    color: Colors.textWhite,
  },
  milestoneReward: {
    fontSize: 13,
    color: Colors.textGrey,
  },
  allComplete: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },

  // ── Rewards ────────────────────────────────────────────────────────────
  rewardsSection: {
    marginBottom: 20,
  },
  rewardsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: 12,
  },
  noRewards: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    paddingVertical: 20,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white10,
  },
  rewardText: {
    fontSize: 14,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  bottomSpacer: {
    height: 20,
  },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/auth-store';
import { useI18n } from '../../hooks/use-i18n';
import { repos } from '../../services/container';
import { theme } from '../../theme';
import { usePermissions } from '../../hooks/use-permissions';
import { ThreeDotsMenu } from './ThreeDotsMenu';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useMyTimeEntriesQuery, useUnreadNotificationsCountQuery, useDirectMessageUnreadQuery } from '../../services/queries';
import { TimeEntry } from '../../types';
import { getEffectiveRecordedAt } from '../../utils/point-report-pdf';

const BloodPriorityIcon: React.FC<{ count: number; onPress: () => void }> = ({ count, onPress }) => {
  'use no memo';
  const colors = useThemeColors();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const hasUnread = count > 0;

  useEffect(() => {
    if (!hasUnread) {
      pulseAnim.setValue(0);
      scaleAnim.setValue(1);
      glowAnim.setValue(1);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );

    pulseLoop.start();
    bounceLoop.start();
    glowLoop.start();
    return () => { pulseLoop.stop(); bounceLoop.stop(); glowLoop.stop(); };
  }, [hasUnread]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.25, 0] });

  return (
    <TouchableOpacity
      style={styles.bloodIconTouchable}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {hasUnread && (
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
      )}

      {hasUnread ? (
        <Animated.View
          style={[
            styles.circularIcon,
            styles.bloodPriorityIconActive,
            {
              transform: [{ scale: scaleAnim }],
              opacity: glowAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.85, 1] }),
            },
          ]}
        >
          <Ionicons name="water" size={18} color="#fff" />
        </Animated.View>
      ) : (
        <View style={[styles.circularIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Ionicons name="water-outline" size={18} color={colors.text} />
        </View>
      )}

      {hasUnread && (
        <View style={[styles.countBadge, { borderColor: colors.background }]}>
          <Text style={styles.countBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface TopBarProps {
  title?: string;
}

const COFFEE_DURATION_MS = 15 * 60 * 1000;
const LUNCH_DURATION_MS = 45 * 60 * 1000;
const SWISS_TIMEZONE = 'Europe/Zurich';

function toSwissDateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SWISS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return date.toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function toSwissDateKeyFromIso(iso: string): string {
  return toSwissDateKeyFromDate(new Date(iso));
}

function formatDuration(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs < 0) return '00:00:00';
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = () => {
  'use no memo';
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { hasPermission } = usePermissions();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { data: unreadCount = 0 } = useUnreadNotificationsCountQuery(user?.id);
  const { data: dmUnreadCount = 0 } = useDirectMessageUnreadQuery(user?.id);
  const { data: timeEntries = [] } = useMyTimeEntriesQuery(user?.id);
  const [bloodPriorityUnread, setBloodPriorityUnread] = React.useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadBloodPriorityCount = React.useCallback(async () => {
    if (!user) return;
    try {
      const unreadMessages = await repos.bloodPriorityRepo.getUnreadMessages(user.id);
      setBloodPriorityUnread(unreadMessages.length);
    } catch (error) {
      console.error('Error loading blood priority count:', error);
    }
  }, [user]);

  React.useEffect(() => {
    loadBloodPriorityCount();
    const interval = setInterval(loadBloodPriorityCount, 5000);
    return () => clearInterval(interval);
  }, [loadBloodPriorityCount]);

  const todayKey = toSwissDateKeyFromDate(new Date());
  const todayEntries = timeEntries.filter((entry) => {
    const effective = getEffectiveRecordedAt(entry as TimeEntry);
    return effective && toSwissDateKeyFromIso(effective) === todayKey;
  });

  const clockIn = todayEntries.find((entry) => entry.entryType === 'clock_in') || null;
  const clockOut = todayEntries.find((entry) => entry.entryType === 'clock_out') || null;
  const coffeeStart = todayEntries.find((entry) => entry.entryType === 'coffee_start') || null;
  const coffeeEnd = todayEntries.find((entry) => entry.entryType === 'coffee_end') || null;
  const lunchStart = todayEntries.find((entry) => entry.entryType === 'lunch_start') || null;
  const lunchEnd = todayEntries.find((entry) => entry.entryType === 'lunch_end') || null;

  const coffeeActive = !!(coffeeStart && !coffeeEnd);
  const lunchActive = !!(lunchStart && !lunchEnd);
  const anyPauseActive = coffeeActive || lunchActive;
  const hasClockIn = !!clockIn;
  const hasClockOut = !!clockOut;

  const isWorkRunning = hasClockIn && !hasClockOut;

  useEffect(() => {
    if (!isWorkRunning) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isWorkRunning]);

  const fixedPauseMs =
    (coffeeStart ? COFFEE_DURATION_MS : 0) +
    (lunchStart ? LUNCH_DURATION_MS : 0);

  let todayWorkedMs = 0;
  if (clockIn) {
    const inMs = new Date(getEffectiveRecordedAt(clockIn)).getTime();
    const endMs = clockOut
      ? new Date(getEffectiveRecordedAt(clockOut)).getTime()
      : nowMs;
    if (Number.isFinite(inMs) && Number.isFinite(endMs) && endMs > inMs) {
      todayWorkedMs = Math.max(0, endMs - inMs - fixedPauseMs);
    }
  }

  const workStatusIcon = hasClockOut
    ? 'stop-circle-outline'
    : anyPauseActive
      ? 'pause-circle-outline'
      : isWorkRunning
        ? 'play-circle-outline'
        : 'time-outline';

  const workStatusColor = hasClockOut
    ? '#ef4444'
    : anyPauseActive
      ? '#f59e0b'
      : isWorkRunning
        ? '#22c55e'
        : colors.textSecondary;

  const username = user?.username || 'User';

  return (
    <View style={[styles.container, { paddingTop: insets.top + theme.spacing.md, backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
      <View style={[
        styles.contentWrapper,
        Platform.OS === 'web' && {
          maxWidth: 1400,
          width: '100%',
          alignSelf: 'center',
        },
      ]}>
        <View style={styles.leftSection}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: colors.text }]}>{t('common.hello')}, {username}</Text>
            <TouchableOpacity
              style={[styles.workStatusBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => router.push('/point')}
              activeOpacity={0.7}
            >
              <Ionicons name={workStatusIcon as any} size={14} color={workStatusColor} />
              <Text style={[styles.workStatusValue, { color: workStatusColor }]}>
                {formatDuration(todayWorkedMs)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.rightSection}>
          <BloodPriorityIcon
            count={bloodPriorityUnread}
            onPress={() => router.push('/blood-priority')}
          />
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={() => router.push('/user-messages')}
            activeOpacity={0.7}
          >
            <View style={[styles.circularIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.text} />
            </View>
            {dmUnreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Text style={[styles.badgeText, { color: colors.textInverse }]}>
                  {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {hasPermission('notifications.view') && (
            <TouchableOpacity
              style={styles.iconContainer}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
            >
              <View style={[styles.circularIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Ionicons name="notifications-outline" size={18} color={colors.text} />
              </View>
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}>
                  <Text style={[styles.badgeText, { color: colors.textInverse }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.circularIcon, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <ThreeDotsMenu visible={showMenu} onClose={() => setShowMenu(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    minHeight: 90,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        alignItems: 'center',
      },
    }),
  },
  contentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flex: 1,
  },
  leftSection: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  greeting: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.lineHeight.xl,
    flexShrink: 1,
  },
  workStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: theme.spacing.xs,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  workStatusValue: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodIconTouchable: {
    position: 'relative',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  circularIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  bloodPriorityIconActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  countBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
  },
});

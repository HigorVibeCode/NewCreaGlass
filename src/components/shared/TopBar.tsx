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
import { useUnreadNotificationsCountQuery } from '../../services/queries';

interface TopBarProps {
  title?: string;
}

export const TopBar: React.FC<TopBarProps> = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { hasPermission } = usePermissions();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { data: unreadCount = 0 } = useUnreadNotificationsCountQuery(user?.id);
  const [bloodPriorityUnread, setBloodPriorityUnread] = React.useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const blinkAnimation = useRef(new Animated.Value(1)).current;

  const loadBloodPriorityCount = React.useCallback(async () => {
    if (!user || !hasPermission('bloodPriority.view')) return;
    try {
      const unreadMessages = await repos.bloodPriorityRepo.getUnreadMessages(user.id);
      setBloodPriorityUnread(unreadMessages.length);
    } catch (error) {
      console.error('Error loading blood priority count:', error);
    }
  }, [user, hasPermission]);

  React.useEffect(() => {
    loadBloodPriorityCount();
    const interval = setInterval(loadBloodPriorityCount, 5000);
    return () => clearInterval(interval);
  }, [loadBloodPriorityCount]);

  useEffect(() => {
    if (bloodPriorityUnread > 0) {
      // Create blinking animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnimation, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      blinkAnimation.setValue(1);
    }
  }, [bloodPriorityUnread, blinkAnimation]);

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
          <Text style={[styles.greeting, { color: colors.text }]}>{t('common.hello')}, {username}</Text>
        </View>
        <View style={styles.rightSection}>
        {hasPermission('bloodPriority.view') && (
          <TouchableOpacity
            style={styles.iconContainer}
            onPress={() => router.push('/blood-priority')}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.circularIcon,
                styles.bloodPriorityIcon,
                { opacity: blinkAnimation },
              ]}
            >
              <Ionicons name="water" size={16} color="#ffffff" />
            </Animated.View>
          </TouchableOpacity>
        )}
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
  greeting: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    lineHeight: theme.typography.lineHeight.xl,
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
  circularIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  bloodPriorityIcon: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
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

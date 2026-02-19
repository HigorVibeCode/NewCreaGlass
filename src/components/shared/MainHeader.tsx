import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/auth-store';
import { repos } from '../../services/container';
import { theme } from '../../theme';
import { usePermissions } from '../../hooks/use-permissions';

const PULSE_SIZE = 48;

const PulsingBloodIcon: React.FC<{ count: number; onPress: () => void }> = ({ count, onPress }) => {
  'use no memo';
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (count <= 0) return;

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

    return () => {
      pulseLoop.stop();
      bounceLoop.stop();
      glowLoop.stop();
    };
  }, [count]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.25, 0],
  });

  const hasUnread = count > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.bloodIconTouchable}
    >
      {hasUnread && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      )}

      {hasUnread ? (
        <Animated.View
          style={[
            styles.circularIcon,
            styles.circularIconActive,
            { transform: [{ scale: scaleAnim }], opacity: glowAnim.interpolate({
              inputRange: [0.5, 1],
              outputRange: [0.85, 1],
            }) },
          ]}
        >
          <Ionicons name="water" size={20} color="#fff" />
        </Animated.View>
      ) : (
        <Ionicons name="water-outline" size={24} color={theme.colors.text} />
      )}

      {hasUnread && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface MainHeaderProps {
  title: string;
}

export const MainHeader: React.FC<MainHeaderProps> = ({ title }) => {
  'use no memo';
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [bloodPriorityUnread, setBloodPriorityUnread] = React.useState(0);

  React.useEffect(() => {
    loadCounts();
    const interval = setInterval(loadCounts, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const loadCounts = async () => {
    if (!user) return;
    try {
      const notifCount = await repos.notificationsRepo.getUnreadCount(user.id);
      setUnreadCount(notifCount);

      if (hasPermission('bloodPriority.view')) {
        const unreadMessages = await repos.bloodPriorityRepo.getUnreadMessages(user.id);
        setBloodPriorityUnread(unreadMessages.length);
      }
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer} />
      <View style={styles.iconsContainer}>
        {hasPermission('bloodPriority.view') && (
          <PulsingBloodIcon
            count={bloodPriorityUnread}
            onPress={() => router.push('/blood-priority')}
          />
        )}
        {hasPermission('notifications.view') && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
              </View>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/profile')}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  titleContainer: {
    flex: 1,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconButton: {
    position: 'relative',
    padding: theme.spacing.xs,
  },
  bloodIconTouchable: {
    position: 'relative',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  circularIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  circularIconActive: {
    backgroundColor: theme.colors.error,
    borderColor: theme.colors.error,
    shadowColor: theme.colors.error,
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
    borderColor: theme.colors.background,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
  },
});

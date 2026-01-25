import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { repos } from '../src/services/container';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useNotificationsQuery } from '../src/services/queries';
import { Notification } from '../src/types';
import { triggerNotificationAlert } from '../src/utils/notification-alert';
import { formatNotificationText } from '../src/utils/notification-formatter';

export default function NotificationsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading, error } = useNotificationsQuery(user?.id);
  const clearingRef = React.useRef(false);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;
    
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    // Skip if already read
    if (notification.readAt) return;
    
    const readAtTimestamp = new Date().toISOString();
    
    // Optimistic update: update cache immediately
    queryClient.setQueryData<Notification[]>(['notifications', user.id], (old) => {
      if (!old) return old;
      return old.map(notif => 
        notif.id === notificationId 
          ? { ...notif, readAt: readAtTimestamp }
          : notif
      );
    });

    // Update unread count optimistically
    queryClient.setQueryData<number>(['notifications', 'unreadCount', user.id], (old) => {
      return Math.max(0, (old || 0) - 1);
    });

    try {
      console.log('Marking notification as read:', notificationId);
      await repos.notificationsRepo.markAsRead(notificationId, user.id);
      console.log('Notification marked as read successfully');
      
      // Refetch in background to sync with server (optimistic update already applied)
      queryClient.refetchQueries({ 
        queryKey: ['notifications', user.id],
        exact: true 
      });
      queryClient.refetchQueries({ 
        queryKey: ['notifications', 'unreadCount', user.id],
        exact: true 
      });
    } catch (error) {
      console.error('Error marking as read:', error);
      // Revert optimistic update on error
      queryClient.setQueryData<Notification[]>(['notifications', user.id], (old) => {
        if (!old) return old;
        return old.map(notif => 
          notif.id === notificationId 
            ? { ...notif, readAt: undefined }
            : notif
        );
      });
      queryClient.setQueryData<number>(['notifications', 'unreadCount', user.id], (old) => {
        return (old || 0) + 1;
      });
      Alert.alert(t('common.error'), t('notifications.markAsReadError') || 'Failed to mark notification as read');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      t('notifications.clearAll'),
      t('notifications.clearAllConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('notifications.clearAll'),
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            
            // Set flag to prevent realtime from invalidating during clear
            clearingRef.current = true;
            
            // Optimistic update: remove all notifications from view immediately
            queryClient.setQueryData<Notification[]>(['notifications', user.id], () => []);

            // Update unread count optimistically
            queryClient.setQueryData<number>(['notifications', 'unreadCount', user.id], () => 0);

            try {
              console.log('Clearing all notifications for user:', user.id);
              await repos.notificationsRepo.clearUserNotifications(user.id);
              console.log('All notifications cleared successfully');
              
              // Wait a bit before allowing realtime updates again
              // This prevents notifications from reappearing immediately
              setTimeout(() => {
                clearingRef.current = false;
              }, 2000);
              
              // Don't refetch - optimistic update is already applied
              // The realtime subscription will handle updates if needed
              // Refetching here causes notifications to reappear
            } catch (error: any) {
              clearingRef.current = false;
              console.error('Error clearing notifications:', error);
              // Revert optimistic update on error by refetching
              queryClient.refetchQueries({ 
                queryKey: ['notifications', user.id],
                exact: true 
              });
              queryClient.refetchQueries({ 
                queryKey: ['notifications', 'unreadCount', user.id],
                exact: true 
              });
              
              const errorMessage = error?.message || t('notifications.clearError') || 'Failed to clear notifications';
              Alert.alert(t('common.error'), errorMessage);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          {t('notifications.loadError') || 'Failed to load notifications'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('notifications.title')}
          </Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            {notifications.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAll}
                style={styles.clearButton}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.clearButtonText, { color: colors.error }]}>
                  {t('notifications.clearAll')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('notifications.noNotifications')}</Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  { backgroundColor: colors.cardBackground },
                  !notification.readAt && styles.notificationCardUnread,
                  !notification.readAt && { borderLeftColor: colors.primary },
                ]}
                onPress={() => handleMarkAsRead(notification.id)}
              >
                <Text style={[styles.notificationType, { color: colors.text }]}>
                  {formatNotificationText(notification, t)}
                </Text>
                <Text style={[styles.notificationDate, { color: colors.textSecondary }]}>
                  {new Date(notification.createdAt).toLocaleString()}
                </Text>
                {!notification.readAt && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.unreadBadgeText, { color: colors.textInverse }]}>{t('notifications.unread')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  clearButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
  },
  notificationsList: {
    gap: theme.spacing.md,
  },
  notificationCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  notificationCardUnread: {
    borderLeftWidth: 4,
  },
  notificationType: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  notificationDate: {
    fontSize: theme.typography.fontSize.sm,
  },
  unreadBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
});

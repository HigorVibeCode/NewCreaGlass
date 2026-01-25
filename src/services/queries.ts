import { useQuery } from '@tanstack/react-query';
import { Permission, User, Notification } from '../types';
import { repos } from './container';

export const usePermissionsQuery = (userId?: string) => {
  return useQuery<Permission[]>({
    queryKey: ['permissions', userId],
    queryFn: async () => {
      if (!userId) {
        if (__DEV__) console.log('[usePermissionsQuery] No userId provided');
        return [];
      }
      try {
        const perms = await repos.permissionsRepo.getUserPermissions(userId);
        if (__DEV__) {
          console.log(`[usePermissionsQuery] Loaded ${perms.length} permissions for user ${userId}:`, perms.map(p => p.key));
        }
        return perms;
      } catch (error) {
        console.error('[usePermissionsQuery] Error loading permissions:', error);
        return [];
      }
    },
    enabled: !!userId,
    staleTime: 30000, // Cache for 30 seconds
  });
};

export const useUsersQuery = () => {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => repos.usersRepo.getAllUsers(),
  });
};

export const useAllPermissionsQuery = () => {
  return useQuery<Permission[]>({
    queryKey: ['allPermissions'],
    queryFn: () => repos.permissionsRepo.getAllPermissions(),
  });
};

export const useNotificationsQuery = (userId?: string) => {
  return useQuery<Notification[]>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log('[QUERY] Fetching notifications for user:', userId);
      const notifications = await repos.notificationsRepo.getUserNotifications(userId);
      console.log('[QUERY] Fetched', notifications.length, 'notifications');
      // Sort notifications by date: most recent first
      return notifications.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
    },
    enabled: !!userId,
    // Removed refetchInterval - rely on realtime subscriptions instead
    // This prevents the "notification coming back" issue
    staleTime: 0, // Always consider data stale to allow realtime updates
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    notifyOnChangeProps: ['data', 'error'], // Notify on data changes to ensure UI updates
  });
};

export const useUnreadNotificationsCountQuery = (userId?: string) => {
  return useQuery<number>({
    queryKey: ['notifications', 'unreadCount', userId],
    queryFn: async () => {
      if (!userId) return 0;
      return repos.notificationsRepo.getUnreadCount(userId);
    },
    enabled: !!userId,
    refetchInterval: 5000, // Refetch every 5 seconds as fallback
  });
};

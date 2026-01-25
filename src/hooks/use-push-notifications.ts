import { useEffect, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../store/auth-store';
import { DevicePlatform } from '../types';
import Constants from 'expo-constants';

// Lazy import expo-notifications to handle Expo Go limitations gracefully
let Notifications: typeof import('expo-notifications') | null = null;
let isExpoGo: boolean | null = null;

const checkIfExpoGo = () => {
  if (isExpoGo === null) {
    // Check if running in Expo Go
    try {
      const { appOwnership } = Constants;
      isExpoGo = appOwnership === 'expo';
    } catch {
      isExpoGo = false;
    }
  }
  return isExpoGo;
};

const loadNotifications = async () => {
  // Skip if Expo Go (push notifications don't work in Expo Go SDK 53+)
  if (checkIfExpoGo()) {
    console.log('[usePushNotifications] Running in Expo Go - push notifications disabled (SDK 53+ limitation)');
    return null;
  }

  if (!Notifications) {
    try {
      Notifications = await import('expo-notifications');
      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (error) {
      console.warn('[usePushNotifications] expo-notifications not available:', error);
    }
  }
  return Notifications;
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<boolean>(false);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!user) return;

    // Skip if Expo Go
    if (checkIfExpoGo()) {
      console.log('[usePushNotifications] Skipping push notification setup - Expo Go detected');
      return;
    }

    // Load notifications module and initialize
    loadNotifications().then(NotificationsModule => {
      if (!NotificationsModule) {
        return;
      }

      // Register for push notifications
      registerForPushNotificationsAsync(NotificationsModule)
        .then(token => {
          if (token) {
            setExpoPushToken(token);
            registerDeviceToken(token);
          }
        })
        .catch(error => {
          console.error('[usePushNotifications] Error registering for push:', error);
        });

      // Listen for notifications received while app is foregrounded
      notificationListener.current = NotificationsModule.addNotificationReceivedListener(notification => {
        console.log('[usePushNotifications] Notification received:', notification);
      });

      // Listen for user tapping on notification
      responseListener.current = NotificationsModule.addNotificationResponseReceivedListener(response => {
        console.log('[usePushNotifications] Notification response:', response);
        handleNotificationResponse(response);
      });
    });

    return () => {
      if (notificationListener.current && Notifications) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current && Notifications) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user]);

  const registerDeviceToken = async (token: string) => {
    if (!user) return;

    try {
      // Lazy import to avoid require cycle
      const { repos } = await import('../services/container');
      
      const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const appVersion = Constants.expoConfig?.version || '1.0.0';
      const deviceId = Constants.deviceId || undefined;

      await repos.deviceTokensRepo.registerDeviceToken({
        userId: user.id,
        platform,
        token,
        deviceId,
        appVersion,
        isActive: true,
      });

      console.log('[usePushNotifications] Device token registered successfully');
    } catch (error) {
      console.error('[usePushNotifications] Error registering device token:', error);
    }
  };

  const handleNotificationResponse = (response: any) => {
    const data = response.notification.request.content.data;
    
    if (data?.deepLink) {
      console.log('[usePushNotifications] Navigating to deep link:', data.deepLink);
      
      // Mark notification as read if notificationId is provided
      if (data.notificationId && user) {
        import('../services/container').then(({ repos }) => {
          repos.notificationsRepo.markAsRead(data.notificationId, user.id).catch(err => {
            console.error('[usePushNotifications] Error marking notification as read:', err);
          });
        });
      }

      // Navigate to deep link
      // Handle both absolute paths and relative paths
      const deepLink = data.deepLink.startsWith('/') ? data.deepLink : `/${data.deepLink}`;
      
      // Use setTimeout to ensure navigation happens after app is ready
      setTimeout(() => {
        try {
          router.push(deepLink as any);
        } catch (error) {
          console.error('[usePushNotifications] Error navigating to deep link:', error);
          // Fallback: try to open via Linking
          Linking.openURL(`crea-glass://${deepLink}`).catch(err => {
            console.error('[usePushNotifications] Error opening deep link via Linking:', err);
          });
        }
      }, 100);
    } else if (data?.notificationId && user) {
      // If no deep link, just mark as read and go to notifications
      import('../services/container').then(({ repos }) => {
        repos.notificationsRepo.markAsRead(data.notificationId, user.id).catch(err => {
          console.error('[usePushNotifications] Error marking notification as read:', err);
        });
      });
      setTimeout(() => {
        router.push('/notifications' as any);
      }, 100);
    }
  };

  return {
    expoPushToken,
    notificationPermission,
  };
}

async function registerForPushNotificationsAsync(
  NotificationsModule: typeof import('expo-notifications')
): Promise<string | null> {
  let token: string | null = null;

  try {
    // Request permissions
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[registerForPushNotificationsAsync] Permission not granted');
      return null;
    }

    // Get Expo push token
    token = (await NotificationsModule.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;

    console.log('[registerForPushNotificationsAsync] Expo push token:', token);
  } catch (error) {
    console.error('[registerForPushNotificationsAsync] Error:', error);
  }

  return token;
}

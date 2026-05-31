import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../store/auth-store';
import { DevicePlatform } from '../types';
import Constants from 'expo-constants';
import { webPushService } from '../services/web-push';

/** EAS Project ID (app.json extra.eas.projectId). Fallback quando Constants.expoConfig não expõe no build standalone. */
const EAS_PROJECT_ID = 'b9318a96-8f54-4026-af36-7fe80a52e80a';

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

  // Web push notifications use Web Push API instead of expo-notifications
  // We handle web separately using WebPushService
  if (Platform.OS === 'web') {
    console.log('[usePushNotifications] Web platform detected - using Web Push API');
    // Web is handled separately in the hook
    return null;
  }

  if (!Notifications) {
    try {
      Notifications = await import('expo-notifications');
      // Configure notification handler for iOS and Android
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Configure Android notification channel (required for Android 8.0+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notificações Crea Glass',
          description: 'Notificações gerais do aplicativo Crea Glass',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E6F4FE',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        console.log('[usePushNotifications] Android notification channel configured');
      }

      // iOS doesn't require channel setup, but we log for confirmation
      if (Platform.OS === 'ios') {
        console.log('[usePushNotifications] iOS push notifications configured');
      }
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
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = expoPushToken;

  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!userId) return;

    // Skip if Expo Go
    if (checkIfExpoGo()) {
      console.log('[usePushNotifications] Skipping push notification setup - Expo Go detected');
      return;
    }

    // Handle web push notifications separately
    if (Platform.OS === 'web') {
      initializeWebPushNotifications();
      return;
    }

    let mounted = true;

    const setupPush = (NotificationsModule: typeof import('expo-notifications')) => {
      if (!mounted) return;
      registerForPushNotificationsAsync(NotificationsModule)
        .then(token => {
          if (mounted && token) {
            setExpoPushToken(token);
            tokenRef.current = token;
            registerDeviceToken(token);
          } else if (mounted && !token) {
            console.warn('[usePushNotifications] Push token is null (permission denied or getExpoPushTokenAsync failed). Check logs above.');
          }
        })
        .catch(error => {
          console.error('[usePushNotifications] Error registering for push:', error);
        });
    };

    // Load notifications module and initialize
    loadNotifications().then(NotificationsModule => {
      if (!NotificationsModule || !mounted) return;

      setupPush(NotificationsModule);

      // Listen for notifications received while app is foregrounded
      if (mounted && typeof NotificationsModule.addNotificationReceivedListener === 'function') {
        notificationListener.current = NotificationsModule.addNotificationReceivedListener(notification => {
          console.log('[usePushNotifications] Notification received:', notification);
        });
      }

      // Listen for user tapping on notification
      if (mounted && typeof NotificationsModule.addNotificationResponseReceivedListener === 'function') {
        responseListener.current = NotificationsModule.addNotificationResponseReceivedListener(response => {
          console.log('[usePushNotifications] Notification response:', response);
          handleNotificationResponse(response);
        });
      }
    }).catch(err => {
      console.warn('[usePushNotifications] loadNotifications error:', err);
    });

    // Retry token registration when app comes to foreground
    let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
    try {
      subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState !== 'active') return;
        if (tokenRef.current) return;
        loadNotifications().then(NotificationsModule => {
          if (!NotificationsModule || !mounted) return;
          if (tokenRef.current) return;
          setupPush(NotificationsModule);
        }).catch(() => {});
      });
    } catch (err) {
      console.warn('[usePushNotifications] AppState.addEventListener error:', err);
    }

    return () => {
      mounted = false;
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (e) {
        console.warn('[usePushNotifications] cleanup subscription error:', e);
      }
      try {
        if (notificationListener.current && Notifications && typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        notificationListener.current = undefined;
      } catch (e) {
        console.warn('[usePushNotifications] cleanup notificationListener error:', e);
      }
      try {
        if (responseListener.current && Notifications && typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
        responseListener.current = undefined;
      } catch (e) {
        console.warn('[usePushNotifications] cleanup responseListener error:', e);
      }
    };
  }, [userId]);

  const registerDeviceToken = async (token: string) => {
    if (!userRef.current) return;

    try {
      // Lazy import to avoid require cycle
      const { repos } = await import('../services/container');
      
      const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const appVersion = Constants.expoConfig?.version || '1.0.0';
      const deviceId = Constants.deviceId || undefined;

      await repos.deviceTokensRepo.registerDeviceToken({
        userId: userRef.current!.id,
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
      if (data.notificationId && userRef.current) {
        import('../services/container').then(({ repos }) => {
          repos.notificationsRepo.markAsRead(data.notificationId, userRef.current!.id).catch(err => {
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
    } else if (data?.notificationId && userRef.current) {
      // If no deep link, just mark as read and go to notifications
      import('../services/container').then(({ repos }) => {
        repos.notificationsRepo.markAsRead(data.notificationId, userRef.current!.id).catch(err => {
          console.error('[usePushNotifications] Error marking notification as read:', err);
        });
      });
      setTimeout(() => {
        router.push('/notifications' as any);
      }, 100);
    }
  };

  /**
   * Inicializar Web Push Notifications para web.
   * Estratégia principal: Supabase Realtime + browser Notification API.
   * Fallback: Web Push API com VAPID quando configurada.
   */
  const initializeWebPushNotifications = async () => {
    if (Platform.OS !== 'web' || !user) return;

    try {
      // 1. Solicitar permissão de notificação do browser
      if (!('Notification' in window)) {
        console.warn('[usePushNotifications] Browser não suporta Notification API');
        return;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      setNotificationPermission(permission === 'granted');

      if (permission !== 'granted') {
        console.warn('[usePushNotifications] Permissão de notificação não concedida');
        return;
      }

      console.log('[usePushNotifications] Browser notification permission granted');

      // 2. Subscrever no Supabase Realtime para notificações do usuário atual
      const { supabase } = await import('../services/supabase');
      const { pushNotificationService } = await import('../services/push-notifications');

      const channel = supabase
        .channel('web-push-' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
          },
          (payload: any) => {
            const newNotification = payload.new;
            if (!newNotification) return;

            // Verificar se esta notificação é para o usuário atual
            // (targetUserIds contém o user.id ou é broadcast para todos)
            const targetUserIds: string[] = newNotification.target_user_ids || [];
            if (targetUserIds.length > 0 && !targetUserIds.includes(user.id)) {
              return; // Não é para este usuário
            }

            // Não mostrar notificações criadas pelo próprio usuário
            if (newNotification.created_by === user.id) return;

            // Gerar conteúdo da notificação
            const payloadJson = typeof newNotification.payload_json === 'string'
              ? JSON.parse(newNotification.payload_json)
              : newNotification.payload_json || {};

            const mappedNotification = {
              id: newNotification.id,
              type: newNotification.type,
              payloadJson,
              targetUserIds,
              createdBy: newNotification.created_by,
              createdAt: newNotification.created_at,
            } as any;

            const { title, body } = pushNotificationService.generateNotificationContent(mappedNotification);
            const deepLink = pushNotificationService.generateDeepLink(mappedNotification);

            // Mostrar notificação nativa do browser
            try {
              const notification = new Notification(title, {
                body,
                icon: '/assets/images/icon.png',
                tag: 'crea-glass-' + newNotification.id,
                data: { deepLink, notificationId: newNotification.id },
              });

              notification.onclick = () => {
                window.focus();
                notification.close();
                handleWebNotificationClick({ deepLink, notificationId: newNotification.id });
              };

              console.log('[usePushNotifications] Browser notification shown:', title);
            } catch (notifError) {
              console.error('[usePushNotifications] Error showing browser notification:', notifError);
            }
          }
        )
        .subscribe((status: string) => {
          console.log('[usePushNotifications] Supabase Realtime subscription status:', status);
        });

      // Armazenar canal para cleanup
      (window as any).__webPushChannel = channel;

      // 3. Tentar também Web Push com VAPID (opcional, funciona se configurado)
      try {
        if (webPushService.isSupported()) {
          const initialized = await webPushService.initialize();
          if (initialized) {
            const subscription = await webPushService.subscribe();
            if (subscription) {
              const token = webPushService.subscriptionToToken(subscription);
              setExpoPushToken(token);
              registerDeviceToken(token);
              console.log('[usePushNotifications] Web Push VAPID subscription também ativa');
            }
          }
        }
      } catch (vapidError) {
        // VAPID não configurada - não é problema, Realtime cobre
        console.log('[usePushNotifications] Web Push VAPID não disponível (OK, usando Realtime):', (vapidError as any)?.message);
      }

      // 4. Listener para notificações recebidas (via Service Worker message)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
            handleWebNotificationClick(event.data);
          }
        });
      }
    } catch (error) {
      console.error('[usePushNotifications] Erro ao inicializar Web Push:', error);
    }
  };

  /**
   * Lidar com clique em notificação web
   */
  const handleWebNotificationClick = (data: any) => {
    if (data?.deepLink) {
      const deepLink = data.deepLink.startsWith('/') ? data.deepLink : `/${data.deepLink}`;
      setTimeout(() => {
        try {
          router.push(deepLink as any);
        } catch (error) {
          console.error('[usePushNotifications] Erro ao navegar para deep link:', error);
        }
      }, 100);
    } else if (data?.notificationId && user) {
      import('../services/container').then(({ repos }) => {
        repos.notificationsRepo.markAsRead(data.notificationId, user.id).catch(err => {
          console.error('[usePushNotifications] Erro ao marcar notificação como lida:', err);
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
      // Request permissions with platform-specific options
      const permissionOptions: any = {
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      };

      if (Platform.OS === 'ios') {
        permissionOptions.ios = {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        };
      }

      const { status } = await NotificationsModule.requestPermissionsAsync(permissionOptions);
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[registerForPushNotificationsAsync] Permission not granted. User must enable notifications in device settings.');
      return null;
    }

    // Ensure Android notification channel is set up
    if (Platform.OS === 'android') {
      try {
        const channelId = 'default';
        const existingChannel = await NotificationsModule.getNotificationChannelAsync(channelId);
        if (!existingChannel) {
          await NotificationsModule.setNotificationChannelAsync(channelId, {
            name: 'Notificações Crea Glass',
            description: 'Notificações gerais do aplicativo Crea Glass',
            importance: NotificationsModule.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#E6F4FE',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          });
          console.log('[registerForPushNotificationsAsync] Android notification channel created');
        }
      } catch (channelError) {
        console.warn('[registerForPushNotificationsAsync] Error setting up notification channel:', channelError);
      }
    }

    // projectId obrigatório para Expo Push em build standalone; no build às vezes Constants.expoConfig.extra não está disponível
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? EAS_PROJECT_ID;
    if (!projectId) {
      console.error('[registerForPushNotificationsAsync] projectId is missing. Add extra.eas.projectId in app.json and ensure it is embedded in the build.');
      return null;
    }
    if (projectId === EAS_PROJECT_ID && !Constants.expoConfig?.extra?.eas?.projectId) {
      console.log('[registerForPushNotificationsAsync] Using fallback EAS projectId (standalone build may not expose extra.eas in Constants)');
    }

    token = (await NotificationsModule.getExpoPushTokenAsync({
      projectId,
    })).data;

    if (token) {
      console.log('[registerForPushNotificationsAsync] Expo push token obtained successfully');
    } else {
      console.warn('[registerForPushNotificationsAsync] getExpoPushTokenAsync returned null');
    }
  } catch (error: any) {
    console.error('[registerForPushNotificationsAsync] Error:', error?.message ?? error);
    // Erros comuns: credenciais FCM/APNs não configuradas no EAS, ou projectId incorreto
    if (error?.message?.includes('projectId') || error?.message?.includes('credentials')) {
      console.warn('[registerForPushNotificationsAsync] Dica: no build standalone, configure FCM (Android) e/ou APNs (iOS) no EAS (eas credentials).');
    }
  }

  return token;
}

import { DeviceToken, Notification, NotificationPreferences, PushDeliveryStatus } from '../types';
import { webPushService, WebPushSubscription } from './web-push';

/**
 * Push Notification Payload structure
 */
export interface PushNotificationPayload {
  title: string;
  body: string;
  data: {
    notificationId: string;
    type: string;
    entityId?: string;
    deepLink?: string;
    [key: string]: any;
  };
}

/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push Notification Service
 * Expo manages FCM/APNs internally
 */
export class PushNotificationService {
  private expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  /**
   * Send push notification to a single device token
   * Supports Expo Push (iOS/Android) and Web Push (web)
   */
  async sendToToken(
    token: string,
    platform: DeviceToken['platform'],
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    // Web Push requires different handling
    if (platform === 'web') {
      return this.sendToWebToken(token, payload);
    }

    // iOS and Android use Expo Push Service
    try {
      // Expo Push Notification payload
      const expoPayload: any = {
        to: token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: 'high',
        badge: 1,
      };

      // Android-specific: Set notification channel (required for Android 8.0+)
      // iOS doesn't require channelId - Expo Push Service handles APNs automatically
      if (platform === 'android') {
        expoPayload.channelId = 'default';
      }

      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(expoPayload),
      });

      const result = await response.json();

      // Expo returns an array of results
      if (result.data && result.data[0]) {
        const pushResult = result.data[0];
        
        if (pushResult.status === 'ok') {
          return { success: true };
        } else {
          const error = pushResult.message || 'Unknown error';
          
          // Handle invalid token errors
          if (error.includes('InvalidExpoPushToken') || error.includes('DeviceNotRegistered')) {
            await this.deactivateInvalidToken(token, platform);
          }
          
          return { success: false, error };
        }
      }

      return { success: false, error: 'Invalid response from Expo Push Service' };
    } catch (error: any) {
      console.error('[PushNotificationService] Error sending push notification:', error);
      return { success: false, error: error.message || 'Failed to send push notification' };
    }
  }

  /**
   * Send push notification to web token using Web Push API
   * Requires a backend endpoint that has the VAPID private key
   */
  private async sendToWebToken(
    token: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Parse web push subscription from token
      const subscriptionData = webPushService.tokenToSubscriptionData(token);
      if (!subscriptionData) {
        return { success: false, error: 'Invalid web push subscription token' };
      }

      // Send to backend endpoint that will use Web Push API
      // The backend needs to have the VAPID private key
      const backendUrl = process.env.EXPO_PUBLIC_WEB_PUSH_ENDPOINT || '/api/web-push/send';
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscriptionData,
          payload: {
            title: payload.title,
            body: payload.body,
            icon: '/assets/images/icon.png',
            badge: '/assets/images/icon.png',
            data: payload.data,
            tag: 'crea-glass-notification',
            requireInteraction: false,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Backend error: ${errorText}` };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[PushNotificationService] Error sending web push:', error);
      return { success: false, error: error.message || 'Failed to send web push notification' };
    }
  }

  /**
   * Send push notification to multiple device tokens
   * Expo supports batch sending for better performance
   */
  async sendToTokens(
    tokens: Array<{ token: string; platform: DeviceToken['platform']; deviceTokenId?: string }>,
    payload: PushNotificationPayload
  ): Promise<Array<{ token: string; deviceTokenId?: string; success: boolean; error?: string }>> {
    if (tokens.length === 0) {
      return [];
    }

    try {
      // Separate web tokens from mobile tokens
      const webTokens = tokens.filter(t => t.platform === 'web');
      const mobileTokens = tokens.filter(t => t.platform !== 'web');

      // Send web pushes separately (they require different API)
      const webResults = await Promise.all(
        webTokens.map(async ({ token, deviceTokenId }) => {
          const result = await this.sendToWebToken(token, payload);
          return { token, deviceTokenId, ...result };
        })
      );

      // Send mobile pushes via Expo (batch)
      if (mobileTokens.length === 0) {
        return webResults;
      }

      // Expo supports batch sending - more efficient
      const expoMessages = mobileTokens.map(({ token, platform }) => {
        const message: any = {
          to: token,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data,
          priority: 'high',
          badge: 1,
        };

        // Android-specific: Set notification channel (required for Android 8.0+)
        // iOS doesn't require channelId - Expo Push Service handles APNs automatically
        if (platform === 'android') {
          message.channelId = 'default';
        }

        return message;
      });

      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(expoMessages),
      });

      const result = await response.json();

      // Map results back to mobile tokens
      const mobileResults = mobileTokens.map(({ token, deviceTokenId, platform }, index) => {
        const pushResult = result.data?.[index];
        
        if (pushResult?.status === 'ok') {
          return { token, deviceTokenId, success: true };
        } else {
          const error = pushResult?.message || 'Unknown error';
          
          // Handle invalid token errors
          if (error.includes('InvalidExpoPushToken') || error.includes('DeviceNotRegistered')) {
            this.deactivateInvalidToken(token, platform).catch(err => {
              console.error('[PushNotificationService] Error deactivating token:', err);
            });
          }
          
          return { token, deviceTokenId, success: false, error };
        }
      });

      // Combine web and mobile results
      return [...webResults, ...mobileResults];
    } catch (error: any) {
      console.error('[PushNotificationService] Error sending batch push notifications:', error);
      // Fallback: send individually
      return Promise.all(
        tokens.map(async ({ token, platform, deviceTokenId }) => {
          const result = await this.sendToToken(token, platform, payload);
          return {
            token,
            deviceTokenId,
            ...result,
          };
        })
      );
    }
  }

  /**
   * Deactivate invalid token
   */
  private async deactivateInvalidToken(token: string, platform: DeviceToken['platform']): Promise<void> {
    try {
      // Lazy import to avoid require cycle
      const { repos } = await import('./container');
      await repos.deviceTokensRepo.deactivateDeviceTokenByToken(token, platform);
      console.log(`[PushNotificationService] Deactivated invalid token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('[PushNotificationService] Error deactivating invalid token:', error);
    }
  }

  /**
   * Generate deep link from notification type and payload
   */
  generateDeepLink(notification: Notification): string {
    const { type, payloadJson } = notification;

    // Map notification types to app routes
    if (type === 'inventory.lowStock' && payloadJson.itemId) {
      return `/inventory-group?itemId=${payloadJson.itemId}`;
    }
    
    if (type === 'production.authorized' && payloadJson.productionId) {
      return `/production-detail?productionId=${payloadJson.productionId}`;
    }
    
    if (type === 'production.tempered' && payloadJson.productionId) {
      return `/production-detail?productionId=${payloadJson.productionId}`;
    }
    
    if (type === 'workOrder.created' && payloadJson.workOrderId) {
      return `/work-order-detail?workOrderId=${payloadJson.workOrderId}`;
    }
    
    if (type === 'workOrder.updated' && payloadJson.workOrderId) {
      return `/work-order-detail?workOrderId=${payloadJson.workOrderId}`;
    }
    
    if (type === 'training.assigned' && payloadJson.trainingId) {
      return `/training-detail?trainingId=${payloadJson.trainingId}`;
    }
    
    if (type === 'bloodPriority.new' && payloadJson.messageId) {
      return `/blood-priority?messageId=${payloadJson.messageId}`;
    }
    
    if (type === 'event.created' && payloadJson.eventId) {
      return `/event-detail?eventId=${payloadJson.eventId}`;
    }

    // Default: go to notifications screen
    return '/notifications';
  }

  /**
   * Generate notification title and body from notification
   */
  generateNotificationContent(notification: Notification): { title: string; body: string } {
    const { type, payloadJson } = notification;

    switch (type) {
      case 'inventory.lowStock':
        return {
          title: 'Estoque Baixo',
          body: `${payloadJson.itemName || 'Item'} está com estoque baixo (${payloadJson.stock || 0} unidades)`,
        };
      
      case 'production.authorized':
        {
          const clientName = payloadJson.clientName || 'Cliente';
          const orderType = payloadJson.orderType || '';
          const orderNumber = payloadJson.orderNumber || '';
          return {
            title: 'Ordem Autorizada',
            body: `${clientName} | ${orderType} | ${orderNumber} - Autorizado`,
          };
        }
      
      case 'production.tempered':
        {
          const clientName = payloadJson.clientName || 'Cliente';
          const orderType = payloadJson.orderType || '';
          const orderNumber = payloadJson.orderNumber || '';
          return {
            title: 'Pedido Temperado',
            body: `${clientName} | ${orderType} | ${orderNumber} - Entrou na fase de temperamento`,
          };
        }
      
      case 'workOrder.created': {
        const scheduledDate = payloadJson.scheduledDate || '';
        const scheduledTime = payloadJson.scheduledTime || '';
        
        let dateText = '';
        if (scheduledDate) {
          try {
            // Handle different date formats
            let date: Date;
            if (typeof scheduledDate === 'string') {
              if (scheduledDate.includes('T')) {
                date = new Date(scheduledDate);
              } else {
                date = new Date(scheduledDate + 'T00:00:00');
              }
            } else if (scheduledDate instanceof Date) {
              date = scheduledDate;
            } else {
              date = new Date(scheduledDate);
            }
            
            if (!isNaN(date.getTime())) {
              dateText = date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              });
              
              // Add time if available (format: HH:MM or HH:MM:SS)
              if (scheduledTime) {
                const timeStr = String(scheduledTime).split(':').slice(0, 2).join(':');
                dateText += ` às ${timeStr}`;
              }
            } else {
              dateText = String(scheduledDate);
              if (scheduledTime) {
                const timeStr = String(scheduledTime).split(':').slice(0, 2).join(':');
                dateText += ` às ${timeStr}`;
              }
            }
          } catch (e) {
            dateText = String(scheduledDate);
            if (scheduledTime) {
              dateText += ` às ${scheduledTime}`;
            }
          }
        }
        
        return {
          title: 'Nova Ordem de Serviço',
          body: `Nova ordem de serviço criada${dateText ? ` - ${dateText}` : ''}`,
        };
      }
      
      case 'workOrder.updated':
        return {
          title: 'Ordem de Serviço Atualizada',
          body: `Ordem de serviço atualizada: ${payloadJson.clientName || 'cliente'}`,
        };
      
      case 'training.assigned':
        return {
          title: 'Novo Treinamento',
          body: `Novo treinamento disponível: ${payloadJson.trainingTitle || 'Treinamento'}`,
        };
      
      case 'bloodPriority.new':
        return {
          title: 'Blood Priority',
          body: payloadJson.title || 'Nova mensagem urgente',
        };
      
      case 'event.created': {
        const startDate = payloadJson.startDate || '';
        const startTime = payloadJson.startTime || '';
        
        let dateText = '';
        if (startDate) {
          try {
            // Handle different date formats
            let date: Date;
            if (typeof startDate === 'string') {
              if (startDate.includes('T')) {
                date = new Date(startDate);
              } else {
                date = new Date(startDate + 'T00:00:00');
              }
            } else if (startDate instanceof Date) {
              date = startDate;
            } else {
              date = new Date(startDate);
            }
            
            if (!isNaN(date.getTime())) {
              dateText = date.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
              });
              
              // Add time if available (format: HH:MM or HH:MM:SS)
              if (startTime) {
                const timeStr = String(startTime).split(':').slice(0, 2).join(':');
                dateText += ` às ${timeStr}`;
              }
            } else {
              dateText = String(startDate);
              if (startTime) {
                const timeStr = String(startTime).split(':').slice(0, 2).join(':');
                dateText += ` às ${timeStr}`;
              }
            }
          } catch (e) {
            dateText = String(startDate);
            if (startTime) {
              dateText += ` às ${startTime}`;
            }
          }
        }
        
        return {
          title: 'Novo Evento',
          body: `Novo evento criado${dateText ? ` - ${dateText}` : ''}`,
        };
      }
      
      default:
        return {
          title: 'Nova Notificação',
          body: 'Você recebeu uma nova notificação',
        };
    }
  }

  /**
   * Check if user should receive push for this notification type
   */
  async shouldSendPush(
    userId: string,
    notificationType: string
  ): Promise<boolean> {
    // Lazy import to avoid require cycle
    const { repos } = await import('./container');
    
    // Get user preferences
    const preferences = await repos.notificationPreferencesRepo.getOrCreatePreferences(userId);
    
    if (!preferences.pushEnabled) {
      return false;
    }

    // Check category-specific preferences
    if (notificationType.startsWith('inventory.') && !preferences.inventoryEnabled) {
      return false;
    }
    
    if (notificationType.startsWith('workOrder.') && !preferences.workOrdersEnabled) {
      return false;
    }
    
    if (notificationType.startsWith('training.') && !preferences.trainingEnabled) {
      return false;
    }
    
    if (notificationType.startsWith('bloodPriority.') && !preferences.bloodPriorityEnabled) {
      return false;
    }
    
    if (notificationType.startsWith('production.') && !preferences.productionEnabled) {
      return false;
    }
    
    if (notificationType.startsWith('event.') && !preferences.eventsEnabled) {
      return false;
    }

    return true;
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();

import { DeviceToken, Notification, NotificationPreferences, PushDeliveryStatus } from '../types';

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
   * Send push notification to a single device token (Expo Push Token)
   * Expo Push Tokens are platform-agnostic and Expo handles FCM/APNs internally
   */
  async sendToToken(
    token: string,
    platform: DeviceToken['platform'],
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Expo Push Notification payload
      const expoPayload = {
        to: token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: 'high',
        badge: 1,
      };

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
      // Expo supports batch sending - more efficient
      const expoMessages = tokens.map(({ token }) => ({
        to: token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: 'high',
        badge: 1,
      }));

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

      // Map results back to tokens
      return tokens.map(({ token, deviceTokenId, platform }, index) => {
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
        return {
          title: 'Ordem Autorizada',
          body: `${payloadJson.clientName || 'Cliente'} | ${payloadJson.orderType || ''} | ${payloadJson.orderNumber || ''} - Autorizado`,
        };
      
      case 'workOrder.created':
        return {
          title: 'Nova Ordem de Serviço',
          body: `Ordem de serviço criada para ${payloadJson.clientName || 'cliente'}`,
        };
      
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
      
      case 'event.created':
        return {
          title: 'Novo Evento',
          body: payloadJson.title || 'Novo evento criado',
        };
      
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

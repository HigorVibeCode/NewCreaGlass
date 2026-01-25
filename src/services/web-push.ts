/**
 * Web Push Notification Service
 * Gerencia Web Push API para notificações push na versão web
 */

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface VAPIDKeys {
  publicKey: string;
  privateKey?: string; // Apenas no servidor
}

/**
 * Serviço para gerenciar Web Push Notifications
 */
export class WebPushService {
  private vapidPublicKey: string | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  /**
   * Inicializar o serviço de Web Push
   * Deve ser chamado quando o app carrega na web
   */
  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[WebPushService] Service Workers não são suportados neste navegador');
      return false;
    }

    try {
      // Registrar Service Worker
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });
      
      this.serviceWorkerRegistration = registration;
      console.log('[WebPushService] Service Worker registrado:', registration);

      // Carregar chave VAPID pública
      await this.loadVAPIDPublicKey();

      return true;
    } catch (error) {
      console.error('[WebPushService] Erro ao registrar Service Worker:', error);
      return false;
    }
  }

  /**
   * Carregar chave VAPID pública
   * A chave deve estar configurada em EXPO_PUBLIC_VAPID_PUBLIC_KEY
   * Ou pode ser obtida de um endpoint do servidor
   */
  private async loadVAPIDPublicKey(): Promise<void> {
    // Tentar obter da variável de ambiente
    const envKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    
    if (envKey) {
      this.vapidPublicKey = envKey;
      console.log('[WebPushService] VAPID public key carregada do ambiente');
      return;
    }

    // Se não tiver no ambiente, tentar obter do servidor
    // Isso requer um endpoint no backend que retorne a chave pública
    try {
      const response = await fetch('/api/vapid-public-key');
      if (response.ok) {
        const data = await response.json();
        this.vapidPublicKey = data.publicKey;
        console.log('[WebPushService] VAPID public key carregada do servidor');
      }
    } catch (error) {
      console.warn('[WebPushService] Não foi possível carregar VAPID key do servidor:', error);
      console.warn('[WebPushService] Configure EXPO_PUBLIC_VAPID_PUBLIC_KEY no .env');
    }
  }

  /**
   * Verificar se Web Push é suportado
   */
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Verificar se as notificações estão permitidas
   */
  async getPermissionStatus(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Solicitar permissão para notificações
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notificações não são suportadas neste navegador');
    }

    const permission = await Notification.requestPermission();
    console.log('[WebPushService] Permissão de notificação:', permission);
    return permission;
  }

  /**
   * Obter subscription atual
   */
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      await this.initialize();
    }

    if (!this.serviceWorkerRegistration) {
      return null;
    }

    try {
      const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
      return subscription;
    } catch (error) {
      console.error('[WebPushService] Erro ao obter subscription:', error);
      return null;
    }
  }

  /**
   * Criar nova subscription
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      throw new Error('Web Push não é suportado neste navegador');
    }

    // Verificar permissão
    const permission = await this.getPermissionStatus();
    if (permission !== 'granted') {
      const newPermission = await this.requestPermission();
      if (newPermission !== 'granted') {
        throw new Error('Permissão de notificação negada');
      }
    }

    // Garantir que Service Worker está registrado
    if (!this.serviceWorkerRegistration) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Falha ao inicializar Service Worker');
      }
    }

    if (!this.serviceWorkerRegistration) {
      throw new Error('Service Worker não está registrado');
    }

    // Verificar se já existe subscription
    let subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('[WebPushService] Subscription já existe');
      return subscription;
    }

    // Criar nova subscription
    if (!this.vapidPublicKey) {
      throw new Error('VAPID public key não configurada. Configure EXPO_PUBLIC_VAPID_PUBLIC_KEY');
    }

    try {
      subscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      console.log('[WebPushService] Nova subscription criada:', subscription);
      return subscription;
    } catch (error) {
      console.error('[WebPushService] Erro ao criar subscription:', error);
      throw error;
    }
  }

  /**
   * Cancelar subscription
   */
  async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription();
    if (!subscription) {
      return true; // Já não está inscrito
    }

    try {
      const result = await subscription.unsubscribe();
      console.log('[WebPushService] Subscription cancelada');
      return result;
    } catch (error) {
      console.error('[WebPushService] Erro ao cancelar subscription:', error);
      return false;
    }
  }

  /**
   * Converter subscription para formato que pode ser salvo no banco
   */
  subscriptionToToken(subscription: PushSubscription): string {
    const subscriptionData: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      },
    };

    // Retornar como JSON string para salvar no banco
    return JSON.stringify(subscriptionData);
  }

  /**
   * Converter token do banco para PushSubscription (para reenvio)
   * Nota: Não podemos recriar uma PushSubscription, mas podemos usar os dados para enviar push
   */
  tokenToSubscriptionData(token: string): WebPushSubscription | null {
    try {
      return JSON.parse(token) as WebPushSubscription;
    } catch (error) {
      console.error('[WebPushService] Erro ao parsear token:', error);
      return null;
    }
  }

  /**
   * Converter chave VAPID de base64 URL para Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Converter ArrayBuffer para base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// Singleton instance
export const webPushService = new WebPushService();

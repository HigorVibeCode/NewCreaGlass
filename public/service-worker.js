// Service Worker: Web Push Notifications + app instalável (PWA)
// Este arquivo é servido estaticamente e registrado pelo app

const CACHE_NAME = 'crea-glass-v4';
const APP_SHELL_URL = '/';

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting(); // Ativa imediatamente
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Assume controle imediato
});

// PWA: cache só do que é seguro guardar
// - Páginas (navegação): sempre da rede primeiro, para cada deploy novo aparecer na hora;
//   sem internet, abre a última versão salva do app.
// - /_expo/static, /assets e /pdfjs: nomes com hash ou versão fixa -> cache primeiro.
// - Supabase e outros domínios: não passam pelo cache (dados sempre atuais).
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/pdfjs/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});

// Receber push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);

  let notificationData = {
    title: 'Nova Notificação',
    body: 'Você recebeu uma nova notificação',
    icon: '/assets/images/icon.png',
    badge: '/assets/images/icon.png',
    data: {},
  };

  // Tentar parsear dados do push
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || {},
        tag: data.tag || 'crea-glass-notification',
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
      };
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      // Se não conseguir parsear, usar texto simples
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Abrir',
      },
      {
        action: 'close',
        title: 'Fechar',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
  );
});

// Lidar com cliques na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'close') {
    return;
  }

  // Abrir ou focar na janela do app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já existe uma janela aberta, focar nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navegar para o deep link se fornecido
          if (data?.deepLink) {
            const url = new URL(data.deepLink, self.location.origin);
            return client.navigate(url.href).then(() => client.focus());
          }
          return client.focus();
        }
      }

      // Se não existe janela aberta, abrir nova
      if (clients.openWindow) {
        let url = self.location.origin;
        if (data?.deepLink) {
          url = new URL(data.deepLink, self.location.origin).href;
        }
        return clients.openWindow(url);
      }
    })
  );
});

// Lidar com mensagens do app
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

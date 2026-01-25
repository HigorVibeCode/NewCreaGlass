# 🔔 Configuração de Web Push Notifications

Este documento descreve como configurar e usar push notifications na versão web do Crea Glass usando Web Push API.

## 📋 Visão Geral

Web Push Notifications permitem que o app envie notificações para navegadores web, mesmo quando o app está fechado. Isso requer:

1. **Service Worker** - Para receber push notifications em background
2. **VAPID Keys** - Chaves públicas/privadas para autenticação
3. **Backend Endpoint** - Servidor que envia push usando a chave VAPID privada

## 🏗️ Arquitetura

```
Sistema de Notificações
    ↓
PushNotificationService.sendToTokens()
    ↓
[Web tokens] → Backend Endpoint → Web Push API → Navegador
[Mobile tokens] → Expo Push Service → FCM/APNs → Dispositivo
```

## ⚙️ Configuração

### 1. Gerar Chaves VAPID

Você precisa gerar um par de chaves VAPID (Voluntary Application Server Identification). Existem várias formas:

#### Opção A: Usando Node.js (web-push library)

```bash
npm install -g web-push
web-push generate-vapid-keys
```

Isso gerará:
- **Public Key**: Use em `EXPO_PUBLIC_VAPID_PUBLIC_KEY`
- **Private Key**: Use no backend (NUNCA exponha no frontend)

#### Opção B: Online Generator

Use um gerador online como: https://web-push-codelab.glitch.me/

### 2. Configurar Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# Chave pública VAPID (pode ser exposta no frontend)
EXPO_PUBLIC_VAPID_PUBLIC_KEY=SUA_CHAVE_PUBLICA_AQUI

# Endpoint do backend para enviar push (opcional, padrão: /api/web-push/send)
EXPO_PUBLIC_WEB_PUSH_ENDPOINT=/api/web-push/send
```

### 3. Configurar Backend Endpoint

Você precisa criar um endpoint no backend que:

1. Recebe a subscription e payload
2. Usa a chave VAPID privada para assinar
3. Envia via Web Push API

#### Exemplo: Supabase Edge Function

Crie uma Edge Function em `supabase/functions/web-push-send/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as webPush from 'https://deno.land/x/webpush@0.5.0/mod.ts';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_EMAIL = 'mailto:seu-email@exemplo.com'; // Seu email

serve(async (req) => {
  try {
    const { subscription, payload } = await req.json();

    const result = await webPush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: VAPID_EMAIL,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
        },
      }
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
```

Configure as variáveis no Supabase:
```bash
supabase secrets set VAPID_PUBLIC_KEY=sua_chave_publica
supabase secrets set VAPID_PRIVATE_KEY=sua_chave_privada
```

#### Exemplo: Node.js/Express

```javascript
const webpush = require('web-push');

// Configurar VAPID
webpush.setVapidDetails(
  'mailto:seu-email@exemplo.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.post('/api/web-push/send', async (req, res) => {
  const { subscription, payload } = req.body;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 🧪 Testando

### 1. Verificar Service Worker

1. Abra o app no navegador
2. Abra DevTools → Application → Service Workers
3. Verifique se o Service Worker está registrado e ativo

### 2. Verificar Permissões

1. Abra DevTools → Console
2. Verifique se há logs de `[WebPushService]`
3. Verifique se a permissão foi solicitada e concedida

### 3. Testar Push

1. Faça login no app
2. O token será registrado automaticamente
3. Crie uma notificação no sistema
4. A notificação deve aparecer no navegador

## 📝 Estrutura de Dados

### Web Push Subscription

O token salvo no banco é um JSON stringificado:

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "base64_encoded_key",
    "auth": "base64_encoded_key"
  }
}
```

### Payload de Notificação

```json
{
  "title": "Título da Notificação",
  "body": "Corpo da notificação",
  "icon": "/assets/images/icon.png",
  "badge": "/assets/images/icon.png",
  "data": {
    "notificationId": "uuid",
    "type": "inventory.lowStock",
    "deepLink": "/inventory-group?itemId=123"
  },
  "tag": "crea-glass-notification"
}
```

## 🔧 Troubleshooting

### Service Worker não registra

- Verifique se o arquivo `public/service-worker.js` existe
- Verifique se está sendo servido em `/service-worker.js`
- Verifique o console do navegador para erros

### Permissão negada

- Navegadores podem bloquear notificações se o usuário negou anteriormente
- Verifique em Configurações do Navegador → Notificações
- Teste em modo anônimo para resetar permissões

### Push não chega

1. Verifique se o token está salvo no banco (`device_tokens`)
2. Verifique se o backend endpoint está funcionando
3. Verifique logs do backend
4. Verifique se a chave VAPID está correta

### Erro: "VAPID key not configured"

- Configure `EXPO_PUBLIC_VAPID_PUBLIC_KEY` no `.env`
- Reinicie o servidor de desenvolvimento

## 📚 Referências

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID](https://tools.ietf.org/html/rfc8292)
- [web-push library](https://github.com/web-push-libs/web-push)

## ⚠️ Notas Importantes

1. **HTTPS obrigatório**: Web Push só funciona em HTTPS (ou localhost)
2. **Chave privada**: NUNCA exponha a chave VAPID privada no frontend
3. **Backend necessário**: Web Push requer um backend para enviar notificações
4. **Suporte do navegador**: Nem todos os navegadores suportam Web Push

## 🚀 Próximos Passos

1. Gerar chaves VAPID
2. Configurar variáveis de ambiente
3. Criar endpoint no backend
4. Testar push notifications
5. Monitorar logs de entrega

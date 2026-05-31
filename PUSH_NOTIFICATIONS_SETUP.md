# 🔔 Configuração de Push Notifications - CREA Glass

Este documento descreve como configurar e usar o sistema de push notifications no app CREA Glass.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Configuração Inicial](#configuração-inicial)
4. [Migrações do Banco de Dados](#migrações-do-banco-de-dados)
5. [Configuração do Expo](#configuração-do-expo)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [Testando Push Notifications](#testando-push-notifications)
8. [Troubleshooting](#troubleshooting)

## 🎯 Visão Geral

O sistema de push notifications permite que notificações criadas na Central de Notificações sejam entregues diretamente nos dispositivos móveis dos usuários, mesmo quando o app está fechado.

### Funcionalidades

- ✅ Registro automático de tokens de dispositivo
- ✅ Envio de push quando notificações são criadas
- ✅ Deep links para abrir telas específicas ao tocar na notificação
- ✅ Preferências por usuário e por categoria
- ✅ Logs de entrega para rastreabilidade
- ✅ Desativação automática de tokens inválidos

## 🏗️ Arquitetura

```
Central de Notificações (createNotification)
    ↓
SupabaseNotificationsRepository.createNotification()
    ↓
dispatchPushNotifications() [async, não bloqueia]
    ↓
PushNotificationService.sendToTokens()
    ↓
Expo Push Notification Service
    ↓
FCM (Android) / APNs (iOS)
    ↓
Dispositivo do Usuário
```

## 📦 Instalação

### 1. Instalar Dependências

```bash
npm install expo-notifications
```

### 2. Executar Migrações no Supabase

Execute a migração `create_push_notifications_system.sql` no SQL Editor do Supabase:

```sql
-- Execute o arquivo: supabase/migrations/create_push_notifications_system.sql
```

Esta migração cria:
- `device_tokens` - Tokens de dispositivos
- `notification_preferences` - Preferências de notificação
- `push_delivery_logs` - Logs de entrega

## ⚙️ Configuração do Expo

### 1. Configurar app.json

O `app.json` já está configurado com o `scheme: "crea-glass"` para deep links.

### 2. Configurar EAS (Expo Application Services)

Para produção, você precisa configurar credenciais no EAS:

```bash
# Instalar EAS CLI (se ainda não tiver)
npm install -g eas-cli

# Login no EAS
eas login

# Configurar credenciais para Android
eas credentials

# Configurar credenciais para iOS
eas credentials
```

### 3. Obter Expo Push Token

O app já registra automaticamente o token quando o usuário faz login. O token é salvo em `device_tokens`.

## 🔐 Variáveis de Ambiente

**Nota:** Com Expo Push Notifications, não é necessário configurar FCM Server Key diretamente. O Expo gerencia isso internamente.

No entanto, se você quiser usar FCM diretamente (não recomendado com Expo), você precisaria:

```env
EXPO_PUBLIC_FCM_SERVER_KEY=your_fcm_server_key_here
```

## 🧪 Testando Push Notifications

### 1. Teste Manual via Expo

Você pode testar enviando uma push notification diretamente via Expo:

```bash
# Instalar Expo CLI
npm install -g expo-cli

# Enviar push de teste
expo send-notification --to=ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] --title="Teste" --body="Mensagem de teste"
```

### 2. Teste via App

1. Faça login no app
2. O token será registrado automaticamente
3. Crie uma notificação no sistema (ex: estoque baixo)
4. A push notification deve ser recebida no dispositivo

### 3. Verificar Logs

Verifique os logs de entrega na tabela `push_delivery_logs`:

```sql
SELECT * FROM push_delivery_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## 📱 Deep Links

O sistema gera automaticamente deep links baseados no tipo de notificação:

| Tipo de Notificação | Deep Link |
|---------------------|-----------|
| `inventory.lowStock` | `/inventory-group?itemId={itemId}` |
| `production.authorized` | `/production-detail?productionId={productionId}` |
| `workOrder.created` | `/work-order-detail?workOrderId={workOrderId}` |
| `workOrder.updated` | `/work-order-detail?workOrderId={workOrderId}` |
| `training.assigned` | `/training-detail?trainingId={trainingId}` |
| `bloodPriority.new` | `/blood-priority?messageId={messageId}` |
| `event.created` | `/event-detail?eventId={eventId}` |
| Outros | `/notifications` |

## 🔧 Troubleshooting

### Push notifications não são recebidas

1. **Verificar permissões:**
   - iOS: Verificar se permissão foi concedida nas configurações
   - Android: Verificar se notificações estão habilitadas

2. **Verificar token:**
   ```sql
   SELECT * FROM device_tokens WHERE user_id = 'user-id' AND is_active = true;
   ```

3. **Verificar preferências:**
   ```sql
   SELECT * FROM notification_preferences WHERE user_id = 'user-id';
   ```

4. **Verificar logs:**
   ```sql
   SELECT * FROM push_delivery_logs 
   WHERE user_id = 'user-id' 
   ORDER BY created_at DESC;
   ```

### Token inválido

Se um token for inválido, ele será automaticamente desativado. Você pode reativar fazendo login novamente.

### Notificações não abrem a tela correta

Verifique se o deep link está correto e se a rota existe no app. Os deep links são processados em `usePushNotifications.ts`.

## 📝 Estrutura de Dados

### DeviceToken

```typescript
{
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  token: string;
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### NotificationPreferences

```typescript
{
  id: string;
  userId: string;
  pushEnabled: boolean;
  workOrdersEnabled: boolean;
  inventoryEnabled: boolean;
  trainingEnabled: boolean;
  bloodPriorityEnabled: boolean;
  productionEnabled: boolean;
  eventsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### PushDeliveryLog

```typescript
{
  id: string;
  notificationId: string;
  userId: string;
  deviceTokenId?: string;
  token: string;
  status: 'queued' | 'sent' | 'failed' | 'delivered';
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}
```

## 🚀 Próximos Passos

1. **Tela de Preferências:** Criar uma tela para usuários gerenciarem suas preferências de push
2. **Notificações Locais:** Implementar notificações locais para lembretes
3. **Badge Count:** Atualizar badge do app com contagem de não lidas
4. **Rich Notifications:** Adicionar imagens e ações customizadas nas notificações

## 📚 Referências

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Service](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Deep Linking in Expo](https://docs.expo.dev/guides/linking/)

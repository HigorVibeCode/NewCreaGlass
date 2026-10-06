# 📋 Logs de Push Notifications - Explicação

## Log: "No active device tokens for user"

### O que significa?

Este log aparece quando o sistema tenta enviar uma push notification para um usuário, mas não encontra tokens de dispositivo ativos registrados para esse usuário.

### Quando isso acontece?

Isso é **comportamento esperado** e pode ocorrer quando:

1. **Usuário não fez login no app ainda**
   - O token só é registrado quando o usuário faz login e concede permissão de notificações
   - Se o usuário nunca abriu o app ou não fez login, não haverá token

2. **Usuário não concedeu permissão de notificações**
   - O app solicita permissão ao fazer login
   - Se o usuário negar, o token não será registrado

3. **Usuário está usando Expo Go**
   - Push notifications não funcionam no Expo Go (limitação do SDK 53+)
   - O token não será registrado

4. **Token foi desativado**
   - Tokens inválidos são automaticamente desativados
   - O usuário precisa fazer login novamente para registrar novo token

5. **Usuário está na versão web sem Web Push configurado**
   - Web Push requer configuração adicional (VAPID keys e backend)
   - Se não configurado, tokens web não serão registrados

### É um erro?

**Não!** Este é um comportamento normal e esperado. O sistema:

- ✅ Cria a notificação normalmente (ela aparece na central de notificações do app)
- ✅ Tenta enviar push para usuários com tokens registrados
- ✅ Ignora silenciosamente usuários sem tokens (sem quebrar o fluxo)
- ✅ Continua processando outros usuários normalmente

### Como verificar se está funcionando?

1. **Verificar tokens registrados:**
   ```sql
   SELECT * FROM device_tokens 
   WHERE user_id = 'user-id' 
   AND is_active = true;
   ```

2. **Verificar se usuário concedeu permissão:**
   - No app, verificar se notificações estão habilitadas
   - Verificar logs do app: `[usePushNotifications] Device token registered successfully`

3. **Verificar logs de entrega:**
   ```sql
   SELECT * FROM push_delivery_logs 
   WHERE user_id = 'user-id' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Como garantir que usuários recebam push?

1. **Usuário deve fazer login no app**
2. **Usuário deve conceder permissão de notificações** quando solicitado
3. **App deve estar em build standalone** (não Expo Go)
4. **Para web:** Configurar Web Push (VAPID keys e backend)

### Logs em Produção

Os logs foram ajustados para serem menos verbosos em produção:
- Em desenvolvimento (`__DEV__`): Logs detalhados são exibidos
- Em produção: Apenas erros são logados

### Resumo

| Situação | Comportamento | É Erro? |
|----------|---------------|---------|
| Usuário sem token | Notificação criada, push não enviado | ❌ Não |
| Usuário com token | Notificação criada, push enviado | ✅ OK |
| Token inválido | Token desativado automaticamente | ⚠️ Esperado |
| Permissão negada | Token não registrado | ⚠️ Esperado |

### Push parou de funcionar após o build (standalone)

Se as notificações funcionavam no desenvolvimento e pararam após gerar um **build standalone** (EAS Build ou similar):

1. **projectId no build**: No build standalone, `Constants.expoConfig?.extra?.eas?.projectId` às vezes não está disponível. O app agora usa um **fallback** com o EAS Project ID do `app.json`, para que o token Expo seja obtido corretamente.
2. **Retry ao voltar ao app**: Se o token não for obtido na primeira vez (ex.: permissão concedida depois), o app tenta **registrar de novo** quando o usuário volta ao app (App State = active).
3. **Credenciais FCM/APNs**: No build standalone, é necessário configurar no EAS:
   - **Android**: credenciais FCM (Google Services). Execute `eas credentials` e configure o FCM.
   - **iOS**: certificado/keys APNs. Execute `eas credentials` e configure o Apple Push Notification.
4. **Verificar logs**: No dispositivo, procure por:
   - `[registerForPushNotificationsAsync] Using fallback EAS projectId` → fallback em uso (normal no standalone).
   - `[registerForPushNotificationsAsync] Expo push token obtained successfully` → token obtido.
   - `[usePushNotifications] Device token registered successfully` → token enviado ao backend.
   - Se aparecer erro com "projectId" ou "credentials", configure as credenciais no EAS.

### Próximos Passos

Se você quiser garantir que mais usuários recebam push notifications:

1. **Verificar se usuários estão fazendo login**
2. **Verificar se permissões estão sendo solicitadas**
3. **Verificar se tokens estão sendo registrados** (ver logs do app)
4. **Para web:** Configurar Web Push API (ver `WEB_PUSH_SETUP.md`)

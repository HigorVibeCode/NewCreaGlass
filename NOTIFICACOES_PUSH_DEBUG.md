# Notificações push não funcionam – guia de verificação

Use este guia quando as notificações **na lista do app** aparecem, mas o **popup no celular** (push) não chega.

## 1. Você está no Expo Go?

**Push não funciona no Expo Go** (SDK 53+). O app detecta Expo Go e desativa o registro de push.

- **Solução:** Use uma **build nativa** (preview ou production), por exemplo:
  ```bash
  npx eas build --platform android --profile preview
  ```
  Instale o APK no aparelho e teste de novo.

## 2. O push só é enviado quando a notificação é criada pelo app

O envio de push acontece **no dispositivo que disparou a ação** (criar ordem de serviço, evento, produção etc.). Ou seja:

- Alguém abre o app (build nativa), cria uma ordem de serviço/evento/etc.
- O app grava a notificação no Supabase e **nesse mesmo momento** chama o serviço de push e envia para os tokens cadastrados.

Se a notificação foi criada por outro meio (Supabase direto, outro sistema, migração), **nenhum push é enviado**, porque o código de envio só roda dentro do app.

## 3. Token do dispositivo está registrado?

Para receber push, o **mesmo usuário** precisa ter:

1. Aberto o app em **build nativa** (não Expo Go).
2. Concedido **permissão de notificações** quando o app pediu.
3. O token ter sido gravado na tabela `device_tokens` no Supabase.

**Como conferir no Supabase:**

1. Abra o Supabase do projeto → **Table Editor**.
2. Tabela **`device_tokens`**.
3. Filtre por `user_id` do usuário que deveria receber o push.
4. Veja se existe linha com `is_active = true` e um `token` preenchido (Expo push token começa com `ExponentPushToken[...]`).

Se não houver linha para esse usuário (ou estiver inativo), o push não será enviado para ele. Nesse caso:

- Reabra o app (build nativa), faça login com esse usuário e aceite notificações.
- Confira no console do app se aparece algo como: `[usePushNotifications] Device token registered successfully`.

## 4. Logs no console ao criar uma notificação

Ao criar uma notificação a partir do app (ex.: nova ordem de serviço), o console deve mostrar mensagens como:

- `[dispatchPushNotifications] Enviando push para X usuário(s), tipo: workOrder.created`
- `[dispatchPushNotifications] Usuário <id> : N dispositivo(s), enviando push...`
- `[dispatchPushNotifications] Push enviado com sucesso para N dispositivo(s).`

Se aparecer:

- **`Nenhum token de dispositivo ativo para o usuário`**  
  Esse usuário não tem token ativo em `device_tokens`. Ele precisa abrir o app (build nativa), permitir notificações e ter o token registrado (ver item 3).

- **`Usuário X tem push desativado para Y`**  
  As preferências de notificação desse usuário estão desativadas para esse tipo. Verifique em **Perfil / Configurações / Notificações** (ou equivalente no app).

- **`Resultado: 0 enviado(s), N falha(s). Erros: [...]`**  
  O envio para o Expo/FCM falhou. O texto do erro (ex.: `InvalidExpoPushToken`, `DeviceNotRegistered`) indica o problema; em muitos casos é token antigo ou inválido.

## 5. Resumo rápido

| Situação | O que fazer |
|----------|-------------|
| App rodando no **Expo Go** | Fazer build nativa (preview/production) e testar nela. |
| Nenhuma linha em **`device_tokens`** para o usuário | Abrir o app em build nativa, logar com esse usuário, aceitar notificações e conferir se o token foi registrado. |
| Push desativado nas preferências | Ativar no app (Perfil / Notificações). |
| Log mostra "Push enviado" mas não chega no celular | Ver canal de notificação Android, não perturbar, e se o app está em segundo plano; conferir FCM/EAS (credenciais, projeto). |

Depois de mudar algo (build nativa, permissões, preferências), **crie de novo uma ordem de serviço/evento/etc. pelo app** e observe os logs e a tabela `device_tokens` de novo.

# Por que as notificações push não aparecem no sistema (celular/computador)

## Causa raiz: RLS em `device_tokens`

O envio de push hoje acontece **no app** (no dispositivo de quem está usando o app no momento em que a notificação é criada). Para enviar push a um usuário, o código precisa **ler os tokens** desse usuário na tabela `device_tokens`.

No Supabase, a tabela `device_tokens` tem **Row Level Security (RLS)**:

- Cada usuário só pode **ver e editar os próprios** tokens (`auth.uid() = user_id`).
- Apenas usuários **Master** podem ver/gerir tokens de todos.

Consequência:

- Quando um usuário **não Master** (ex.: um Viewer ou Admin) cria uma notificação (nova ordem de serviço, evento, estoque baixo, etc.), o app dele chama `dispatchPushNotifications` e tenta buscar os `device_tokens` dos **destinatários**.
- Para qualquer destinatário que **não seja ele mesmo**, o SELECT é bloqueado pelo RLS → retorna 0 linhas → **nenhum push é enviado** para os outros.
- Só o **próprio usuário** (quem criou a notificação) pode receber push nesse fluxo, e só se tiver token registrado.
- Se quem criar a notificação for **Master**, aí o app consegue ler todos os tokens e o push pode chegar para todos.

Por isso as notificações **aparecem na central do app** (Realtime + lista), mas **não são “reproduzidas” pelo sistema** (não aparecem na bandeja do celular/computador) na maior parte dos casos.

## Solução: envio de push no backend (Edge Function + Webhook)

Para o push funcionar para **todos** os destinatários, independentemente de quem criou a notificação, o envio precisa ser feito no **backend**, com uma conta que possa ler todos os `device_tokens` (service role).

Foi criada uma **Edge Function** que:

1. É chamada automaticamente sempre que uma nova notificação é **inserida** na tabela `notifications` (via Database Webhook).
2. Usa a **service role** do Supabase e lê `device_tokens` e `notification_preferences` sem ser bloqueada pelo RLS.
3. Envia os pushes para a API do Expo (FCM/APNs) para cada destinatário que tenha token e preferências habilitadas.

Assim, **qualquer** inserção em `notifications` (pelo app ou por outro meio) dispara o envio de push para o sistema (celular/computador).

## O que você precisa fazer

### 1. Fazer deploy da Edge Function

```bash
supabase functions deploy send-push-on-notification
```

### 2. Configurar o Database Webhook no Supabase

1. Abra o **Supabase Dashboard** do projeto.
2. Vá em **Database** → **Webhooks**.
3. Clique em **Create a new webhook**.
4. Preencha:
   - **Name:** `Send push on new notification`
   - **Table:** `public.notifications`
   - **Events:** marque **Insert**
   - **Type:** **Supabase Edge Functions**
   - **Function:** `send-push-on-notification`
5. Salve.

Depois disso, todo INSERT em `notifications` passará a disparar a Edge Function e o push será enviado pelo backend para os dispositivos.

### 3. Conferir o resto (já documentado)

- Build **nativa** (não Expo Go) para receber push no celular.
- Usuários com **permissão de notificação** concedida e **token** registrado em `device_tokens`.
- Preferências de notificação habilitadas no app (push por categoria).
- Credenciais FCM/APNs configuradas no EAS para build standalone.

O arquivo [NOTIFICACOES_PUSH_DEBUG.md](./NOTIFICACOES_PUSH_DEBUG.md) continua válido para esses pontos e para logs no app.

## Resumo

| Problema | Causa | Solução |
|----------|--------|---------|
| Push não aparece no sistema (bandeja do celular/PC) | RLS em `device_tokens`: quem cria a notificação (não Master) não consegue ler os tokens dos outros → nenhum push é enviado para eles | Enviar push no backend via Edge Function + Database Webhook (INSERT em `notifications`) |

Com o webhook e a Edge Function configurados, as notificações criadas na central do app passam a ser enviadas pelo backend e **reproduzidas pelo sistema** (celular/computador) para todos os destinatários que tiverem token e preferências ativas.

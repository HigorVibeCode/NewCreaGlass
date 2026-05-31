# ✅ Checklist Pré-Build - Push Notifications

Este documento verifica se o app está pronto para build e se as notificações push funcionarão corretamente no celular.

## 🔍 Verificações Necessárias

### 1. ✅ Configuração do app.json

**Status:** ✅ **CONFIGURADO**

O `app.json` está configurado corretamente com:
- ✅ Plugin `expo-notifications` configurado
- ✅ Android: `icon`, `color`, `androidMode: "default"`
- ✅ iOS: `iosDisplayInForeground: true`
- ✅ `mode: "production"` para builds de produção

```json
{
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/images/android-icon-foreground.png",
        "color": "#E6F4FE",
        "sounds": [],
        "mode": "production",
        "iosDisplayInForeground": true,
        "androidMode": "default"
      }
    ]
  ]
}
```

### 2. ⚠️ Migrações do Banco de Dados

**Status:** ⚠️ **VERIFICAR SE FOI APLICADA**

Execute as seguintes migrações no Supabase SQL Editor:

#### 2.1. Migração Principal (já deve estar aplicada)
- ✅ `create_push_notifications_system.sql` - Cria tabelas e políticas básicas

#### 2.2. Migração de Política INSERT (NOVA - IMPORTANTE)
- ⚠️ **`add_push_delivery_logs_insert_policy.sql`** - **DEVE SER APLICADA**

Esta migração adiciona a política RLS que permite inserir logs de entrega. Sem ela, você verá o erro:
```
Error: Failed to create push delivery log
new row violates row-level security policy for table "push_delivery_logs"
```

**Como aplicar:**
1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute o conteúdo do arquivo `supabase/migrations/add_push_delivery_logs_insert_policy.sql`

### 3. ✅ Configuração do EAS Build

**Status:** ✅ **CONFIGURADO**

O `eas.json` está configurado com:
- ✅ Variáveis de ambiente do Supabase
- ✅ Perfis de build (development, preview, production)
- ✅ Configuração Android

### 4. ✅ Dependências

**Status:** ✅ **INSTALADAS**

Verificado no `package.json`:
- ✅ `expo-notifications: ^0.32.16`
- ✅ `expo-constants: ~18.0.13`
- ✅ `@react-native-async-storage/async-storage` (para armazenamento de tokens)

### 5. ✅ Código de Push Notifications

**Status:** ✅ **IMPLEMENTADO**

- ✅ Hook `usePushNotifications` configurado
- ✅ Canal de notificação Android configurado
- ✅ Registro automático de tokens
- ✅ Deep linking implementado
- ✅ Tratamento de erros de refresh token
- ✅ Formatação de mensagens de notificação

### 6. ⚠️ Configuração iOS (se for build iOS)

**Status:** ⚠️ **VERIFICAR CREDENCIAIS**

Para builds iOS, você precisa:

1. **Apple Developer Account:**
   - Conta gratuita para TestFlight/desenvolvimento
   - Conta paga ($99/ano) para App Store

2. **Configurar Credenciais no EAS:**
   ```bash
   npx eas credentials
   ```
   - Selecione iOS
   - Configure certificados e provisioning profiles

3. **Push Notifications no Apple Developer:**
   - Certifique-se de que Push Notifications está habilitado no App ID
   - O EAS geralmente gerencia isso automaticamente

### 7. ✅ Android - Pronto para Build

**Status:** ✅ **PRONTO**

Para Android, tudo está configurado:
- ✅ Plugin expo-notifications configurado
- ✅ Canal de notificação configurado no código
- ✅ Ícone de notificação definido
- ✅ Permissões configuradas

**Comandos para build:**
```bash
# Build Preview (APK para testes)
npm run build:android:preview

# Build Production (APK para distribuição)
npm run build:android:production
```

### 8. ⚠️ Web Push (se aplicável)

**Status:** ⚠️ **OPCIONAL - VERIFICAR SE NECESSÁRIO**

Para Web Push, você precisa configurar:
- ⚠️ Variáveis de ambiente `EXPO_PUBLIC_VAPID_PUBLIC_KEY` e `EXPO_PUBLIC_WEB_PUSH_ENDPOINT`
- ⚠️ Backend endpoint para enviar web push (veja `WEB_PUSH_SETUP.md`)

**Nota:** Web Push é opcional. Se você não vai usar notificações push na versão web, pode ignorar esta seção.

## 🚨 Ações Necessárias ANTES do Build

### ⚠️ CRÍTICO: Aplicar Migração do Banco de Dados

**ANTES de fazer o build, execute esta migração no Supabase:**

1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
2. Copie e cole o conteúdo de: `supabase/migrations/add_push_delivery_logs_insert_policy.sql`
3. Execute a query
4. Verifique se a política foi criada:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'push_delivery_logs';
   ```

### ✅ Verificar Assets

Certifique-se de que os arquivos de ícone existem:
- ✅ `assets/images/android-icon-foreground.png`
- ✅ `assets/images/icon.png`
- ✅ `assets/images/favicon.png`

## 📱 Testando Após o Build

### 1. Instalar o APK no Dispositivo

1. Baixe o APK do link fornecido pelo EAS
2. Transfira para o dispositivo Android
3. Permita instalação de fontes desconhecidas
4. Instale o APK

### 2. Verificar Permissões

1. Abra o app
2. Faça login
3. O app deve solicitar permissão de notificações
4. **IMPORTANTE:** Aceite a permissão

### 3. Verificar Registro de Token

1. Após fazer login, verifique no Supabase:
   ```sql
   SELECT * FROM device_tokens 
   WHERE user_id = '[seu-user-id]' 
   AND is_active = true;
   ```
2. Deve haver pelo menos um registro com `platform = 'android'`

### 4. Testar Notificação

1. Crie uma notificação no sistema (ex: mudar status de produção para "authorized" ou "tempered")
2. A notificação push deve aparecer no dispositivo
3. Verifique os logs:
   ```sql
   SELECT * FROM push_delivery_logs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## ✅ Resumo Final

| Item | Status | Ação Necessária |
|------|--------|----------------|
| app.json configurado | ✅ | Nenhuma |
| Migração principal aplicada | ⚠️ | Verificar se foi aplicada |
| **Migração INSERT policy** | ⚠️ | **APLICAR ANTES DO BUILD** |
| EAS configurado | ✅ | Nenhuma |
| Dependências instaladas | ✅ | Nenhuma |
| Código implementado | ✅ | Nenhuma |
| iOS credenciais | ⚠️ | Configurar se for build iOS |
| Web Push | ⚠️ | Opcional |

## 🎯 Próximos Passos

1. **IMPORTANTE:** Aplicar a migração `add_push_delivery_logs_insert_policy.sql` no Supabase
2. Verificar se todas as migrações anteriores foram aplicadas
3. Fazer o build:
   ```bash
   npm run build:android:preview
   ```
4. Testar no dispositivo físico
5. Verificar se as notificações push funcionam

## 🔧 Troubleshooting

### Erro: "Failed to create push delivery log"
**Causa:** Migração `add_push_delivery_logs_insert_policy.sql` não foi aplicada
**Solução:** Aplicar a migração no Supabase

### Notificações não aparecem no dispositivo
1. Verificar se a permissão foi concedida
2. Verificar se o token foi registrado no banco
3. Verificar logs de entrega no Supabase
4. Verificar se o app está em foreground (notificações podem não aparecer se o app estiver aberto)

### Token não é registrado
1. Verificar se o usuário está logado
2. Verificar logs do console para erros
3. Verificar se a tabela `device_tokens` existe e tem as políticas RLS corretas

## 📚 Documentação Relacionada

- `PUSH_NOTIFICATIONS_SETUP.md` - Configuração geral
- `BUILD_ANDROID.md` - Guia de build Android
- `WEB_PUSH_SETUP.md` - Configuração Web Push (opcional)
- `PUSH_NOTIFICATIONS_LOGS.md` - Explicação dos logs

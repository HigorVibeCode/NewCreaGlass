# ✅ Checklist Final - Build e Push Notifications

## 📋 Status Geral

### ✅ Configurações do App

- ✅ **app.json**: Configurado corretamente
  - ✅ `expo-notifications` plugin configurado
  - ✅ EAS Project ID: `b9318a96-8f54-4026-af36-7fe80a52e80a`
  - ✅ Android e iOS configurados
  - ✅ Scheme para deep links: `crea-glass`

- ✅ **eas.json**: Configurado corretamente
  - ✅ Variáveis de ambiente do Supabase
  - ✅ Perfis de build (development, preview, production)
  - ✅ Configuração Android (APK)

- ✅ **package.json**: Dependências instaladas
  - ✅ `expo-notifications: ^0.32.16`
  - ✅ `expo-constants: ~18.0.13`
  - ✅ Todas as dependências necessárias

### ✅ Código de Push Notifications

- ✅ **use-push-notifications.ts**: Implementado com:
  - ✅ Fallback para EAS Project ID (funciona em build standalone)
  - ✅ Retry quando app volta ao foreground
  - ✅ Suporte para Android, iOS e Web
  - ✅ Registro automático de tokens
  - ✅ Deep linking implementado
  - ✅ Tratamento de erros robusto

### ⚠️ Migrações do Banco de Dados

**IMPORTANTE:** Execute estas migrações no Supabase ANTES do build:

#### Migrações Essenciais (já devem estar aplicadas):
1. ✅ `create_push_notifications_system.sql` - Sistema de push notifications
2. ✅ `add_push_delivery_logs_insert_policy.sql` - Política para logs de entrega
3. ✅ `create_trainings_system.sql` - Sistema de treinamentos
4. ✅ `add_training_attachments.sql` - Anexos de treinamento
5. ✅ `create_maintenance_system.sql` - Sistema de manutenção
6. ✅ `create_events_and_work_orders_complete.sql` - Eventos e ordens de serviço
7. ✅ `add_company_to_productions.sql` - Campo company em produções
8. ✅ `set_jorge_higor_as_master.sql` - Usuários Master
9. ✅ `add_onboarding_category.sql` - Categoria onboarding
10. ✅ `fix_signatures_rls_and_create_bucket.sql` - Assinaturas e bucket
11. ✅ `allow_video_mime_types_documents_bucket.sql` - Vídeos no bucket documents

#### ⚠️ NOVA Migração (CRÍTICA):
12. ⚠️ **`create_manuals_and_manual_attachments.sql`** - **DEVE SER APLICADA**

Esta migração cria as tabelas `manuals` e `manual_attachments` para a funcionalidade de Manuais.

**Como aplicar:**
1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
2. Copie e cole o conteúdo de: `supabase/migrations/create_manuals_and_manual_attachments.sql`
3. Execute a query
4. Verifique se as tabelas foram criadas:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('manuals', 'manual_attachments');
   ```

### ✅ Traduções

- ✅ Todas as traduções adicionadas em `pt.json`
- ✅ Textos hardcoded substituídos por traduções
- ✅ Interpolação funcionando (`{{count}}`, `{{title}}`)

## 🚀 Comandos para Build

### Android (APK)

```bash
# Build Preview (para testes)
npm run build:android:preview

# Build Production (para distribuição)
npm run build:android:production
```

### iOS (se necessário)

```bash
# Build Preview
npm run build:ios:preview

# Build Production
npm run build:ios:production
```

**Nota iOS:** Antes do build iOS, configure as credenciais:
```bash
npx eas credentials
```

## 🔔 Push Notifications - Verificações Finais

### ✅ Configuração Técnica

- ✅ **EAS Project ID**: Configurado no código e app.json
- ✅ **Fallback**: Implementado para builds standalone
- ✅ **Retry**: Implementado quando app volta ao foreground
- ✅ **Android Channel**: Configurado no código
- ✅ **iOS Permissions**: Configurado no código

### ⚠️ Credenciais (Obrigatório para Build Standalone)

**Android:**
- ⚠️ Configure credenciais FCM no EAS:
  ```bash
  npx eas credentials
  ```
  - Selecione Android
  - Configure Google Services / FCM

**iOS:**
- ⚠️ Configure credenciais APNs no EAS:
  ```bash
  npx eas credentials
  ```
  - Selecione iOS
  - Configure Apple Push Notification certificates/keys

**Nota:** Sem essas credenciais, as notificações push **NÃO funcionarão** em builds standalone. O Expo gerencia isso automaticamente, mas você precisa configurar no EAS.

### ✅ Funcionalidades Implementadas

- ✅ Registro automático de tokens ao fazer login
- ✅ Envio de push quando notificações são criadas
- ✅ Deep links funcionando
- ✅ Logs de entrega
- ✅ Desativação automática de tokens inválidos
- ✅ Preferências por usuário

## 📝 Checklist Pré-Build

Antes de fazer o build, verifique:

- [ ] ✅ Todas as migrações aplicadas no Supabase (incluindo `create_manuals_and_manual_attachments.sql`)
- [ ] ✅ Credenciais FCM/APNs configuradas no EAS (se for build standalone)
- [ ] ✅ Variáveis de ambiente corretas no `eas.json`
- [ ] ✅ Assets de ícone existem (`assets/images/icon.png`, etc.)
- [ ] ✅ Testado localmente (pelo menos login e navegação básica)

## 🧪 Testando Após o Build

### 1. Instalar o APK/IPA

1. Baixe o arquivo do link fornecido pelo EAS
2. Instale no dispositivo
3. Abra o app

### 2. Verificar Push Notifications

1. **Fazer login** no app
2. **Aceitar permissão** de notificações quando solicitado
3. **Verificar token registrado**:
   ```sql
   SELECT * FROM device_tokens 
   WHERE user_id = '[seu-user-id]' 
   AND is_active = true 
   AND platform = 'android'; -- ou 'ios'
   ```
4. **Criar uma notificação** (ex: mudar status de produção)
5. **Verificar push recebida** no dispositivo
6. **Verificar logs**:
   ```sql
   SELECT * FROM push_delivery_logs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### 3. Verificar Funcionalidades

- [ ] Login funciona
- [ ] Navegação funciona
- [ ] Manuais funcionam (criar, editar, excluir)
- [ ] Treinamentos funcionam
- [ ] Traduções funcionam (trocar idioma)
- [ ] Push notifications funcionam

## 🔧 Troubleshooting

### Push Notifications não funcionam após build

1. **Verificar credenciais FCM/APNs:**
   ```bash
   npx eas credentials
   ```
   - Android: Verificar se FCM está configurado
   - iOS: Verificar se APNs está configurado

2. **Verificar logs do dispositivo:**
   - Procurar por: `[registerForPushNotificationsAsync] Expo push token obtained successfully`
   - Se aparecer erro com "credentials" ou "projectId", configure no EAS

3. **Verificar token no banco:**
   ```sql
   SELECT * FROM device_tokens WHERE is_active = true;
   ```

4. **Verificar permissões:**
   - Android: Configurações > Apps > Crea Glass > Notificações
   - iOS: Configurações > Notificações > Crea Glass

### Erro: "Failed to create push delivery log"

**Causa:** Migração `add_push_delivery_logs_insert_policy.sql` não foi aplicada

**Solução:** Aplicar a migração no Supabase

### App não inicia após build

1. Verificar logs do dispositivo (usar `adb logcat` para Android)
2. Verificar se todas as migrações foram aplicadas
3. Verificar variáveis de ambiente no `eas.json`

## ✅ Resumo Final

| Item | Status | Observação |
|------|--------|------------|
| app.json | ✅ | Configurado |
| eas.json | ✅ | Configurado |
| Código Push | ✅ | Implementado com fallback |
| Migrações antigas | ⚠️ | Verificar se foram aplicadas |
| **Migração manuals** | ⚠️ | **APLICAR ANTES DO BUILD** |
| Credenciais FCM/APNs | ⚠️ | Configurar no EAS para standalone |
| Traduções | ✅ | Completas |
| Assets | ✅ | Verificar se existem |

## 🎯 Ações Imediatas

1. **CRÍTICO:** Aplicar migração `create_manuals_and_manual_attachments.sql` no Supabase
2. **IMPORTANTE:** Configurar credenciais FCM/APNs no EAS (se ainda não fez)
3. Verificar se todas as outras migrações foram aplicadas
4. Fazer build de teste:
   ```bash
   npm run build:android:preview
   ```
5. Testar no dispositivo físico
6. Verificar se push notifications funcionam

## 📚 Documentação Relacionada

- `PUSH_NOTIFICATIONS_SETUP.md` - Configuração geral
- `PUSH_NOTIFICATIONS_LOGS.md` - Explicação dos logs
- `PRE_BUILD_CHECKLIST.md` - Checklist anterior
- `BUILD_ANDROID.md` - Guia de build Android

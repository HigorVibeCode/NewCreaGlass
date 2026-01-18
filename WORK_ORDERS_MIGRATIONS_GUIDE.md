# Guia de Execução de Migrations - Events e Work Orders

## 📍 Localização dos Arquivos

Todos os arquivos de migration estão na pasta:
```
supabase/migrations/
```

## 🗂️ Arquivos de Migration

### Migrations para Events (Sistema de Eventos)

1. **`create_events_table_initial.sql`** - Cria tabela base `events`
   - Execute primeiro se a tabela `events` ainda não existir
   - Cria estrutura básica: id, title, description, created_by, created_at

2. **`update_events_table_add_fields.sql`** - Adiciona campos extras na tabela `events`
   - Execute após criar a tabela base
   - Adiciona: type, start_date, end_date, start_time, end_time, location, people
   - Cria índices para otimização

3. **`create_event_attachments_table.sql`** - Cria tabela `event_attachments`
   - Execute para permitir anexos em eventos
   - Cria tabela relacionada com RLS policies

### Migrations para Work Orders (Sistema de Reports)

**⚠️ IMPORTANTE: Execute na ordem abaixo!**

1. **`create_work_orders_table.sql`** - Tabela principal `work_orders`
   - ⭐ Execute primeiro - tabela principal que outras dependem
   - Cria estrutura completa de Work Orders com RLS

2. **`create_work_order_checkins_table.sql`** - Tabela `work_order_checkins`
   - ⭐ Execute segundo - depende de `work_orders`
   - Armazena check-ins no local com geolocalização

3. **`create_work_order_time_statuses_table.sql`** - Tabela `work_order_time_statuses`
   - ⭐ Execute terceiro - depende de `work_orders`
   - Controla tempo: EM_ATENDIMENTO, PAUSADO, DESLOCAMENTO

4. **`create_work_order_service_logs_table.sql`** - Tabela `work_order_service_logs`
   - ⭐ Execute quarto - depende de `work_orders`
   - Diário de serviço (ajustes, problemas, materiais, recomendações)

5. **`create_work_order_evidences_table.sql`** - Tabela `work_order_evidences`
   - ⭐ Execute quinto - depende de `work_orders`
   - Evidências fotográficas (antes/durante/depois)

6. **`create_work_order_checklist_items_table.sql`** - Tabela `work_order_checklist_items`
   - ⭐ Execute sexto - depende de `work_orders`
   - Itens de checklist (planejado e execução/cliente)

7. **`create_work_order_signatures_table.sql`** - Tabela `work_order_signatures`
   - ⭐ Execute por último - depende de `work_orders`
   - Assinaturas digitais de aceite do cliente

## 📋 Como Executar as Migrations

### Opção 1: SQL Editor do Supabase (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor:**
   - No menu lateral, clique em **"SQL Editor"**
   - Clique em **"New query"**

3. **Execute cada migration na ordem:**

#### Para Events:
```sql
-- 1. Criar tabela base (se não existir)
-- Copie e cole o conteúdo de: supabase/migrations/create_events_table_initial.sql

-- 2. Adicionar campos extras
-- Copie e cole o conteúdo de: supabase/migrations/update_events_table_add_fields.sql

-- 3. Criar tabela de anexos
-- Copie e cole o conteúdo de: supabase/migrations/create_event_attachments_table.sql
```

#### Para Work Orders:
```sql
-- 1. Tabela principal
-- Copie e cole o conteúdo de: supabase/migrations/create_work_orders_table.sql

-- 2. Check-ins
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_checkins_table.sql

-- 3. Time Statuses
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_time_statuses_table.sql

-- 4. Service Logs
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_service_logs_table.sql

-- 5. Evidences
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_evidences_table.sql

-- 6. Checklist Items
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_checklist_items_table.sql

-- 7. Signatures
-- Copie e cole o conteúdo de: supabase/migrations/create_work_order_signatures_table.sql
```

4. **Execute cada query:**
   - Clique em **"Run"** ou pressione `Ctrl+Enter` (Windows/Linux) ou `Cmd+Enter` (Mac)
   - Verifique se a mensagem mostra sucesso: `Success. No rows returned`

5. **Verifique as tabelas criadas:**
   - No menu lateral, vá para **"Table Editor"**
   - Você deve ver as novas tabelas:
     - `events`
     - `event_attachments`
     - `work_orders`
     - `work_order_checkins`
     - `work_order_time_statuses`
     - `work_order_service_logs`
     - `work_order_evidences`
     - `work_order_checklist_items`
     - `work_order_signatures`

### Opção 2: Via Supabase CLI (Avançado)

Se você tem o Supabase CLI instalado:

```bash
# Navegar para a pasta do projeto
cd /Users/higor/Documents/Crea\ Glass/Crea_Glass

# Conectar ao projeto Supabase
supabase link --project-ref seu-project-ref

# Aplicar migrations
supabase db push
```

## ✅ Ordem de Execução Completa

Execute nesta ordem exata:

### Fase 1: Events
1. `create_events_table_initial.sql`
2. `update_events_table_add_fields.sql`
3. `create_event_attachments_table.sql`

### Fase 2: Work Orders
1. `create_work_orders_table.sql` ⚠️ **PRIMEIRO!**
2. `create_work_order_checkins_table.sql`
3. `create_work_order_time_statuses_table.sql`
4. `create_work_order_service_logs_table.sql`
5. `create_work_order_evidences_table.sql`
6. `create_work_order_checklist_items_table.sql`
7. `create_work_order_signatures_table.sql` ⚠️ **ÚLTIMO!**

## 🔍 Verificação Após Execução

### Verificar tabelas criadas:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%event%' OR table_name LIKE '%work_order%'
ORDER BY table_name;
```

### Verificar RLS habilitado:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE '%event%' OR tablename LIKE '%work_order%');
```

### Verificar políticas RLS:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND (tablename LIKE '%event%' OR tablename LIKE '%work_order%')
ORDER BY tablename, policyname;
```

## ⚠️ Erros Comuns

### Erro: "relation already exists"
- A tabela já existe - pule essa migration ou use `DROP TABLE IF EXISTS` antes (cuidado!)

### Erro: "column already exists"
- A coluna já existe - verifique se a migration foi executada antes

### Erro: "foreign key constraint"
- Execute as migrations na ordem correta
- A tabela pai (`work_orders`) deve existir antes das filhas

### Erro: "permission denied"
- Verifique se está logado como administrador no Supabase
- Use o SQL Editor do Dashboard (não o client)

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup antes de executar migrations em produção
2. **Ordem**: Respeite a ordem de execução - tabelas dependentes devem vir depois
3. **RLS**: Todas as tabelas têm RLS habilitado - políticas são criadas automaticamente
4. **Índices**: As migrations criam índices automaticamente para performance
5. **Constraints**: Validações (CHECK constraints) são criadas para garantir integridade

## 🎯 Após Executar as Migrations

1. ✅ Todas as tabelas criadas
2. ✅ RLS habilitado e políticas configuradas
3. ✅ Índices criados para performance
4. ✅ Foreign keys configuradas corretamente
5. ⏳ Criar permissões necessárias (workOrders.*) via Controles de Acesso no app

## 📚 Referências

- [Supabase SQL Editor Docs](https://supabase.com/docs/guides/database/tables)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- Arquivo de arquitetura: `WORK_ORDERS_ARCHITECTURE.md`

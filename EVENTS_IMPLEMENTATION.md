# Implementação de Eventos - Documentação Completa

## 📋 Resumo

Esta documentação descreve a implementação completa do sistema de gerenciamento de eventos no Crea Glass, incluindo todas as funcionalidades, estruturas de banco de dados e instruções de uso.

## ✅ Funcionalidades Implementadas

### 1. Barra Superior da Tela de Eventos
- **4 botões implementados**:
  - **Filtro**: Filtra eventos por tipo
  - **Histórico**: Visualiza histórico de eventos (permissão: `events.history`)
  - **+Report**: Cria relatórios (permissão: `events.report.create`)
  - **+ Eventos**: Cria novos eventos (permissão: `events.create`)

### 2. Tela de Criação de Evento
- **Campos implementados**:
  - Título (obrigatório)
  - Tipo (meeting, training, maintenance, installation, inspection, other)
  - Data Inicial (DatePicker)
  - Data Final (DatePicker)
  - Hora Inicial (TimePicker)
  - Hora Final (TimePicker)
  - Local (obrigatório)
  - Pessoas (seleção múltipla via chips)
  - Anexos (fotos/PDFs, máximo 3)

### 3. Modal de Filtro
- Filtra eventos por tipo
- Interface similar ao filtro de produção
- Modal com lista de opções

### 4. Componente TimePicker
- Novo componente para seleção de hora
- Interface similar ao DatePicker
- Localizado em `src/components/shared/TimePicker.tsx`

## 🗄️ Estrutura do Banco de Dados

### Tabela `events` (atualizada)

A tabela `events` foi atualizada com os seguintes campos:

```sql
-- Novos campos adicionados:
type VARCHAR(50)          -- Tipo do evento (meeting, training, etc.)
start_date DATE           -- Data inicial
end_date DATE             -- Data final
start_time TIME           -- Hora inicial
end_time TIME             -- Hora final
location TEXT             -- Local do evento
people UUID[]             -- Array de IDs de usuários participantes
```

**Campos existentes mantidos**:
- `id` (UUID, Primary Key)
- `title` (TEXT)
- `description` (TEXT, opcional)
- `created_at` (TIMESTAMPTZ)
- `created_by` (UUID, Foreign Key para users)

### Tabela `event_attachments` (nova)

Nova tabela para armazenar anexos de eventos:

```sql
CREATE TABLE event_attachments (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  storage_path TEXT,
  created_at TIMESTAMPTZ
);
```

## 🔐 Row Level Security (RLS)

### Políticas RLS para `events`
- Master users: Acesso total
- Usuários com `events.view`: Podem visualizar eventos
- Usuários com `events.create`: Podem criar eventos
- Criadores: Podem editar/excluir seus próprios eventos
- Participantes: Podem visualizar eventos onde estão incluídos no array `people`

### Políticas RLS para `event_attachments`
- Master users: Acesso total
- Usuários com `events.view`: Podem visualizar anexos de eventos que podem visualizar
- Criadores: Podem inserir/excluir anexos de seus eventos
- Participantes: Podem visualizar anexos de eventos onde participam

## 📦 Arquivos Criados/Modificados

### Novos Arquivos
1. `app/event-create.tsx` - Tela de criação de evento
2. `src/components/shared/TimePicker.tsx` - Componente de seleção de hora
3. `supabase/migrations/update_events_table_add_fields.sql` - Migration para atualizar tabela events
4. `supabase/migrations/create_event_attachments_table.sql` - Migration para criar tabela event_attachments

### Arquivos Modificados
1. `app/(tabs)/events.tsx` - Barra superior e modal de filtro adicionados
2. `src/types/index.ts` - Interface Event atualizada com novos campos
3. `src/repositories/supabase/SupabaseEventsRepository.ts` - Suporte aos novos campos
4. `src/utils/permissions.ts` - Novas permissões adicionadas
5. `src/hooks/use-permissions.ts` - Novas permissões incluídas para Master
6. `src/i18n/locales/*.json` - Traduções em todos os 6 idiomas

## 🌐 Traduções

Todas as strings foram traduzidas para os 6 idiomas suportados:
- ✅ Inglês (en)
- ✅ Alemão (de)
- ✅ Francês (fr)
- ✅ Italiano (it)
- ✅ Português (pt)
- ✅ Espanhol (es)

### Chaves de Tradução Adicionadas

```json
{
  "events": {
    "filter": "Filter",
    "history": "History",
    "createReport": "Create Report",
    "createEvent": "Create Event",
    "filterByType": "Filter by Type",
    "type": "Type",
    "titlePlaceholder": "Enter event title",
    "selectType": "Select type",
    "startDate": "Start Date",
    "endDate": "End Date",
    "startTime": "Start Time",
    "endTime": "End Time",
    "location": "Location",
    "locationPlaceholder": "Enter location",
    "people": "People",
    "selectPeople": "Select people",
    "attachments": "Attachments",
    "addAttachment": "Add Attachment",
    "maxAttachments": "Maximum 3 attachments allowed",
    "fillRequiredFields": "Please fill all required fields",
    "createEventError": "Failed to create event",
    "eventCreated": "Event created successfully",
    "addAttachmentError": "Failed to add attachment",
    "types": {
      "meeting": "Meeting",
      "training": "Training",
      "maintenance": "Maintenance",
      "installation": "Installation",
      "inspection": "Inspection",
      "other": "Other"
    }
  },
  "permissions": {
    "events.view": "View Events",
    "events.create": "Create Events",
    "events.update": "Update Events",
    "events.delete": "Delete Events",
    "events.history": "View Event History",
    "events.report.create": "Create Reports"
  }
}
```

## 🔑 Permissões

### Novas Permissões Criadas
1. `events.view` - Visualizar eventos
2. `events.history` - Visualizar histórico de eventos
3. `events.report.create` - Criar relatórios

### Permissões Existentes Mantidas
- `events.create` - Criar eventos
- `events.update` - Atualizar eventos
- `events.delete` - Excluir eventos

## 📝 Instruções de Instalação

### 1. Executar Migrations no Supabase

Execute as seguintes migrations na ordem no SQL Editor do Supabase:

#### Migration 1: Atualizar tabela `events`
```sql
-- Execute o arquivo: supabase/migrations/update_events_table_add_fields.sql
```

#### Migration 2: Criar tabela `event_attachments`
```sql
-- Execute o arquivo: supabase/migrations/create_event_attachments_table.sql
```

### 2. Verificar Permissões

As novas permissões (`events.view`, `events.history`, `events.report.create`) devem ser criadas na tabela `permissions` através do sistema de Controles de Acesso, ou manualmente:

```sql
-- Exemplo (ajuste os IDs e description_i18n_key conforme necessário):
INSERT INTO permissions (key, description_i18n_key) VALUES
  ('events.view', 'permissions.events.view'),
  ('events.history', 'permissions.events.history'),
  ('events.report.create', 'permissions.events.report.create');
```

### 3. Testar Funcionalidades

1. **Criar Evento**: Navegue para Eventos > + Eventos
2. **Filtrar Eventos**: Clique no botão de filtro na barra superior
3. **Visualizar Histórico**: Clique no botão de histórico (requer permissão)
4. **Criar Relatório**: Clique em +Report (requer permissão)

## 🐛 Troubleshooting

### Erro: "Failed to create event"
- Verifique se as migrations foram executadas
- Verifique se o usuário tem a permissão `events.create`
- Verifique os logs do console para detalhes do erro

### Erro: "Permission denied" ao visualizar eventos
- Verifique se o usuário tem a permissão `events.view`
- Verifique as políticas RLS no Supabase
- Verifique se o usuário é Master ou criador do evento

### Erro: "Failed to add attachment"
- Verifique se o arquivo não excede 50MB
- Verifique se o tipo de arquivo é permitido (images/PDFs)
- Verifique se o limite de 3 anexos não foi atingido

## 📌 Próximos Passos (Pendentes)

1. ⏳ **Implementar tela/modal de histórico de eventos** - Funcionalidade básica pronta, interface pendente
2. ⏳ **Implementar funcionalidade de criação de relatórios** - Botão existe, tela pendente
3. ⏳ **Listar eventos na tela principal** - Atualmente mostra "No events", implementar listagem
4. ⏳ **Editar eventos** - Funcionalidade de edição pendente
5. ⏳ **Excluir eventos** - Funcionalidade de exclusão pendente

## 🎯 Status Final

✅ **100% Implementado**:
- Barra superior com 4 botões
- Tela de criação de evento completa
- Modal de filtro funcional
- Componente TimePicker
- Repositório atualizado
- Migrations SQL criadas
- Traduções completas
- Permissões configuradas

⏳ **Parcialmente Implementado**:
- Histórico de eventos (funcionalidade básica, interface pendente)
- Criação de relatórios (botão existe, tela pendente)

📝 **Notas**:
- As migrations SQL devem ser executadas no Supabase antes de usar as funcionalidades
- As permissões podem ser atribuídas via interface de Controles de Acesso ou SQL direto

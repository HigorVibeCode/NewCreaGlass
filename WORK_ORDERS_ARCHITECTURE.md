# Arquitetura - Sistema de Controle de Tempo e Execução de Serviços

## Visão Geral

Sistema completo de controle de tempo e execução de serviços para empresas de serviços técnicos, com foco em rastreabilidade operacional, controle de tempo em tempo real e aceite formal do cliente.

## Modelo de Dados

### Entidades Principais

#### 1. WorkOrder (Ordem de Serviço)
- **ID**: UUID
- **Cliente**: Nome, endereço, contato
- **Tipo de serviço**: manutenção, montagem, interno, externo
- **Data/hora prevista**: DATETIME
- **Status**: planned, in_progress, paused, completed, cancelled
- **Checklist planejado**: JSON array de itens
- **Materiais previstos**: JSON array de materiais
- **Observações internas**: TEXT (não visível ao cliente)
- **Equipe atribuída**: Array de user IDs
- **Responsável**: User ID
- **Criado por**: User ID
- **Criado em**: TIMESTAMP
- **Bloqueado para edição**: BOOLEAN (após finalização)

#### 2. CheckIn (Check-in no local)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Data/hora**: TIMESTAMP
- **Latitude**: DECIMAL
- **Longitude**: DECIMAL
- **Raio de tolerância**: INTEGER (metros)
- **Foto do local**: TEXT (storage path, opcional)
- **Realizado por**: User ID
- **Criado em**: TIMESTAMP

#### 3. TimeStatus (Status de Tempo)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Status**: EM_ATENDIMENTO, PAUSADO, DESLOCAMENTO
- **Motivo da pausa**: TEXT (obrigatório se PAUSADO)
- **Início**: TIMESTAMP
- **Fim**: TIMESTAMP (nullable)
- **Duração total**: INTEGER (segundos)
- **Criado por**: User ID
- **Criado em**: TIMESTAMP

#### 4. ServiceLog (Diário de Serviço)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Tipo**: ajuste, problema, material, recomendacao
- **Texto**: TEXT
- **Autor**: User ID
- **Data/hora**: TIMESTAMP
- **Foto/vídeo**: TEXT (storage path, opcional)

#### 5. Evidence (Evidências)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Tipo**: antes, durante, depois
- **Foto/vídeo**: TEXT (storage path)
- **Observações internas**: TEXT
- **Observações cliente**: TEXT
- **Criado por**: User ID
- **Criado em**: TIMESTAMP

#### 6. ChecklistItem (Item de Checklist)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Tipo**: planned (planejado) | execution (cliente)
- **Título**: TEXT
- **Descrição**: TEXT (opcional)
- **Concluído**: BOOLEAN
- **Concluído em**: TIMESTAMP (nullable)
- **Concluído por**: User ID (nullable)
- **Criado em**: TIMESTAMP

#### 7. Signature (Assinatura Digital)
- **ID**: UUID
- **WorkOrder ID**: UUID (FK)
- **Assinatura (imagem)**: TEXT (storage path)
- **Nome completo**: TEXT
- **Data/hora**: TIMESTAMP
- **Latitude**: DECIMAL
- **Longitude**: DECIMAL
- **PIN de confirmação**: TEXT (nullable, hashed)
- **Criado por**: User ID
- **Criado em**: TIMESTAMP

## Fluxo de Fases

### Fase 1: Planejamento (Backoffice/Gestor)
1. Criar WorkOrder
2. Preencher dados do cliente
3. Selecionar tipo de serviço
4. Definir data/hora prevista
5. Criar checklist planejado
6. Definir materiais previstos
7. Adicionar observações internas
8. Atribuir equipe e responsável

### Fase 2: Execução (Mobile - Equipe no local)
1. **Check-in**
   - Botão "Cheguei no local"
   - Registrar geolocalização automática
   - Foto opcional
   - Liberar botão "Iniciar atendimento"

2. **Controle de Tempo**
   - Iniciar status EM_ATENDIMENTO
   - Alternar entre status (PAUSADO com motivo)
   - Registrar DESLOCAMENTO (opcional)
   - Histórico completo auditável

3. **Diário de Serviço**
   - Adicionar logs durante atendimento
   - Tipo: ajustes, problemas, materiais, recomendações
   - Foto/vídeo opcional

4. **Evidências**
   - Fotos antes/durante/depois
   - Separar observações internas/cliente

### Fase 3: Finalização e Aceite do Cliente
1. **Resumo Automático**
   - Planejado vs executado
   - Tempo total por status
   - Logs registrados
   - Fotos

2. **Checklist do Cliente**
   - Itens dinâmicos conforme tipo de serviço
   - Confirmação do serviço
   - Termos de concordância

3. **Assinatura Digital**
   - Campo de assinatura touch
   - Nome completo digitado
   - Data/hora e geolocalização automáticos
   - PIN opcional

4. **Confirmação Final**
   - Slide to confirm
   - Bloquear OS para edição
   - Encerrar timer

## Regras de Negócio Críticas

1. **Check-in obrigatório**: Não é possível iniciar atendimento sem check-in
2. **Motivo obrigatório em pausa**: Status PAUSADO requer motivo
3. **Bloqueio após finalização**: OS bloqueada após confirmação final
4. **Permissões por papel**: Técnico, Líder, Gestor, Cliente
5. **Audit trail**: Histórico completo de alterações
6. **Offline first**: Funciona sem internet, sincroniza depois

## Permissões Necessárias

- `workOrders.view` - Visualizar ordens de serviço
- `workOrders.create` - Criar ordem de serviço
- `workOrders.update` - Atualizar ordem de serviço
- `workOrders.delete` - Excluir ordem de serviço
- `workOrders.checkin` - Realizar check-in
- `workOrders.timestatus` - Controlar status de tempo
- `workOrders.log` - Adicionar logs ao diário
- `workOrders.evidence` - Adicionar evidências
- `workOrders.signature` - Coletar assinatura digital
- `workOrders.complete` - Finalizar ordem de serviço

## Próximos Passos

1. ✅ Criar tipos TypeScript
2. ⏳ Criar migrations Supabase
3. ⏳ Criar repositórios
4. ⏳ Criar tela de report com fluxo completo
5. ⏳ Implementar geolocalização
6. ⏳ Implementar assinatura digital
7. ⏳ Implementar modo offline

# Troubleshooting - Migração de Colunas

## Problema: Colunas não estão sendo criadas

### Solução 1: Executar comandos individualmente

Execute cada comando separadamente no SQL Editor do Supabase:

```sql
-- Comando 1
ALTER TABLE inventory_items ADD COLUMN supplier VARCHAR(50);
```

Se der erro dizendo que a coluna já existe, ignore e continue.

```sql
-- Comando 2
ALTER TABLE inventory_items ADD COLUMN reference_number VARCHAR(255);
```

```sql
-- Comando 3: Verificar se funcionou
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
AND column_name IN ('supplier', 'reference_number');
```

### Solução 2: Verificar se a tabela existe

```sql
-- Verificar se a tabela inventory_items existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'inventory_items';
```

### Solução 3: Verificar permissões

Se você receber erro de permissão, certifique-se de estar usando:
- O SQL Editor do Supabase Dashboard (não precisa de permissões especiais)
- Ou uma conexão com role que tenha permissão ALTER TABLE

### Solução 4: Verificar schema

Se a tabela estiver em outro schema:

```sql
-- Listar todos os schemas
SELECT schema_name FROM information_schema.schemata;

-- Verificar em qual schema está a tabela
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'inventory_items';
```

### Solução 5: Verificar se as colunas já existem com outro nome

```sql
-- Listar todas as colunas da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items'
ORDER BY column_name;
```

### Solução 6: Criar manualmente via Table Editor

1. Vá para **Table Editor** no Supabase Dashboard
2. Selecione a tabela `inventory_items`
3. Clique em **Add Column**
4. Adicione:
   - Nome: `supplier`
   - Tipo: `varchar`
   - Tamanho: `50`
   - Nullable: Sim
5. Repita para `reference_number` (tamanho 255)

### Verificação Final

Após executar a migração, execute:

```sql
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'inventory_items' 
  AND column_name IN ('supplier', 'reference_number');
```

Você deve ver 2 linhas retornadas com as informações das colunas.

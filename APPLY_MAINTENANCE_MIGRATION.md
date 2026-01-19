# Como Aplicar a Migração do Sistema de Manutenção

## ⚠️ IMPORTANTE

Para que o sistema de manutenção funcione completamente, você precisa executar a migração SQL primeiro.

## Passo a Passo

### 1. Acesse o Supabase Dashboard

1. Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**

### 2. Execute a Migração

1. Clique em **New Query** (Nova Consulta)
2. Abra o arquivo `supabase/migrations/create_maintenance_system.sql`
3. **Copie TODO o conteúdo** do arquivo
4. **Cole no SQL Editor** do Supabase
5. Clique em **Run** (ou pressione Ctrl+Enter / Cmd+Enter)

### 3. Verificar se Funcionou

Após executar, você deve ver uma mensagem de sucesso. As seguintes tabelas serão criadas:
- `maintenance_records` - Registros de manutenção
- `maintenance_infos` - Caixas de informação (info boxes)
- `maintenance_info_images` - Imagens das info boxes
- `maintenance_history` - Histórico de alterações

Para confirmar, execute esta query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'maintenance%'
ORDER BY table_name;
```

Você deve ver as 4 tabelas listadas.

## Como Funciona

1. **Criar Registro**: Preencha título, equipamento e tipo
2. **Adicionar Info Boxes**: Após criar o registro, você pode adicionar múltiplas "info boxes"
3. **Cada Info Box**: Pode ter uma descrição e até 3 imagens
4. **Botão de Adicionar Próxima Info**: Só aparece após salvar a info anterior
5. **Editar**: Clique no registro na lista para ver detalhes, depois clique em "Editar Registro"

## Após Executar a Migração

1. **Recarregue o app**
2. Vá em Documents > Equipment & Tools > Manutenção
3. Clique em "Criar Registro"
4. Preencha os dados e adicione info boxes com imagens
5. Seu registro com 2 info boxes deve aparecer! ✅

## Arquivo da Migração

O arquivo completo está em:
```
supabase/migrations/create_maintenance_system.sql
```

Este arquivo:
- Cria todas as tabelas necessárias
- Configura RLS (Row Level Security) com permissões baseadas em `documents.*`
- Cria triggers para atualizar timestamps automaticamente
- Limita a 3 imagens por info box via trigger
- Cria índices para melhor performance

## Nota sobre Avisos

Se você receber um aviso "Potential issue detected with your query" devido aos comandos `DROP POLICY IF EXISTS`, isso é **normal e seguro**. Esses comandos são necessários para atualizar políticas RLS e não causam perda de dados.

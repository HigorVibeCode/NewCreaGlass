-- Tornar os usuários Jorge e Higor em Master
-- Execute no SQL Editor do Supabase ou aplique via migração

UPDATE users
SET user_type = 'Master'
WHERE username ILIKE 'Jorge'
   OR username ILIKE 'Higor';

-- Verificar quantas linhas foram atualizadas (opcional)
-- SELECT username, user_type FROM users WHERE username ILIKE 'Jorge' OR username ILIKE 'Higor';

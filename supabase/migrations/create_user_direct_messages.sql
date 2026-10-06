-- Mensagens diretas entre utilizadores (apenas destinatários ativos no INSERT — ver RLS).

CREATE TABLE IF NOT EXISTS public.user_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 5000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sender_not_recipient CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_user_direct_messages_recipient_created
  ON public.user_direct_messages(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_direct_messages_sender_created
  ON public.user_direct_messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_direct_messages_pair
  ON public.user_direct_messages(sender_id, recipient_id, created_at DESC);

ALTER TABLE public.user_direct_messages ENABLE ROW LEVEL SECURITY;

-- Leitura: remetente ou destinatário (ou Master pode ver tudo para suporte)
DROP POLICY IF EXISTS "user_direct_messages_select" ON public.user_direct_messages;
CREATE POLICY "user_direct_messages_select"
  ON public.user_direct_messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.user_type = 'Master' AND u.is_active = true
    )
  );

-- Envio: apenas como remetente autenticado, destinatário ativo e diferente de si
DROP POLICY IF EXISTS "user_direct_messages_insert" ON public.user_direct_messages;
CREATE POLICY "user_direct_messages_insert"
  ON public.user_direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> recipient_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = recipient_id AND u.is_active = true
    )
  );

-- Marcar como lidas: apenas o destinatário
DROP POLICY IF EXISTS "user_direct_messages_update" ON public.user_direct_messages;
CREATE POLICY "user_direct_messages_update"
  ON public.user_direct_messages FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Opcional: Dashboard Supabase → Database → Publications → incluir user_direct_messages em supabase_realtime.

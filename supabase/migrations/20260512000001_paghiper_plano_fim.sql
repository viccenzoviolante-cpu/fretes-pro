ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plano_fim TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paghiper_transaction_id TEXT;

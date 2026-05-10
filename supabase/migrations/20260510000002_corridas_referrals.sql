-- Corridas (usos gratuitos) + Referrals
-- FretesPro — 2026-05-10

-- 1. Contador de buscas gratuitas de Corridas
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS corridas_usos INT NOT NULL DEFAULT 0;

-- 2. Tabela de referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | qualified | rewarded
  qualified_at TIMESTAMPTZ,              -- quando o convidado completou 7 dias de uso
  rewarded_at TIMESTAMPTZ,              -- quando o mês grátis foi creditado
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_id)                    -- cada usuário só pode ser indicado uma vez
);

-- 3. RLS para referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- referrer vê suas próprias indicações
CREATE POLICY "referrals_referrer" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);

-- sistema pode inserir/atualizar (via service role no cron)
CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- 4. Índice para o cron job (busca por referred_id e status)
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

-- 5. Adicionar referred_by no cadastro (já existe mas garantir)
-- (referred_by já existe na tabela users)

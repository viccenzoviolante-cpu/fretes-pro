-- Redesign do sistema de referral
-- FretesPro — 2026-05-10
-- Regra nova: 1 amigo paga → indicador ganha 1 mês Starter grátis
-- Indicado ganha 10% de desconto na primeira cobrança

-- 1. Adicionar desconto_referral na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS desconto_referral SMALLINT NOT NULL DEFAULT 0;
  -- 0 = sem desconto | 10 = 10% off na primeira cobrança (via link de indicação)

-- 2. Atualizar tabela referrals — novo ciclo de status
-- status: pending → pago → recompensado
-- (dropar constraints antigas se existirem e recriar com nova lógica)
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS pagou_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS desconto_aplicado SMALLINT NOT NULL DEFAULT 0;
  -- desconto_aplicado: % de desconto que o indicado recebeu no pagamento

-- 3. Atualizar o comentário de status no código (documentação da coluna)
COMMENT ON COLUMN public.referrals.status IS
  'pending = inscrito mas não pagou | pago = pagamento confirmado | recompensado = indicador já recebeu 1 mês grátis';

-- 4. Índice para buscar por referrer_id + status rapidamente
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
  ON public.referrals(referrer_id, status);

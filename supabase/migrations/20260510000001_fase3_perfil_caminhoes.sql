-- Fase 3: Perfil, Onboarding e Tabela de Caminhões
-- FretesPro — 2026-05-10

-- 1. Adicionar colunas na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS foto_perfil TEXT,
  ADD COLUMN IF NOT EXISTS meta_financeira DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Atualizar trial padrão para 14 dias (era 7 dias)
ALTER TABLE public.users
  ALTER COLUMN trial_fim SET DEFAULT NOW() + INTERVAL '14 days';

-- 3. Criar tabela caminhoes
CREATE TABLE IF NOT EXISTS public.caminhoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  apelido TEXT,
  modelo TEXT NOT NULL,
  placa TEXT NOT NULL,
  carroceria TEXT,
  kml_medio DECIMAL(5,2),
  capacidade_kg DECIMAL(10,2),
  tipos_carga TEXT[],
  is_principal BOOLEAN NOT NULL DEFAULT FALSE,
  plano_ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RLS na tabela caminhoes
ALTER TABLE public.caminhoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caminhoes_own" ON public.caminhoes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Migrar dados existentes: copiar modelo/placa/carroceria/kml da users para caminhoes
--    (só para usuários que já têm caminhão cadastrado e ainda não têm linha em caminhoes)
INSERT INTO public.caminhoes (user_id, modelo, placa, carroceria, kml_medio, is_principal)
SELECT
  id,
  COALESCE(modelo_caminhao, 'Não informado'),
  COALESCE(placa, 'Não informada'),
  carroceria,
  kml_medio,
  TRUE
FROM public.users
WHERE (modelo_caminhao IS NOT NULL OR placa IS NOT NULL)
  AND id NOT IN (SELECT user_id FROM public.caminhoes WHERE is_principal = TRUE);

-- 6. Marcar onboarding_completo = true para usuários que já têm caminhão migrado
UPDATE public.users u
SET onboarding_completo = TRUE
WHERE EXISTS (
  SELECT 1 FROM public.caminhoes c
  WHERE c.user_id = u.id AND c.is_principal = TRUE
);

-- 7. Atualizar trigger handle_new_user para setar trial_fim = 14 dias
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, nome, trial_fim)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'nome',
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

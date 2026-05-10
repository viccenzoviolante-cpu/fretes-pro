-- Fretes salvos + limites de busca por plano
-- FretesPro — 2026-05-10

-- 1. Colunas de controle de limite na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fretes_mes_contagem INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fretes_mes_inicio   DATE,
  ADD COLUMN IF NOT EXISTS fretes_dia_contagem INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fretes_dia_data     DATE,
  ADD COLUMN IF NOT EXISTS raio_km_max         INT NOT NULL DEFAULT 200;

-- 2. Tabela de fretes salvos pelo usuário
CREATE TABLE IF NOT EXISTS public.fretes_salvos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plataforma  TEXT NOT NULL DEFAULT 'fretebras',
  frete_id    TEXT NOT NULL,            -- ID na plataforma de origem
  origem      TEXT NOT NULL,
  destino     TEXT NOT NULL,
  km          DECIMAL(10,2),
  valor_frete DECIMAL(12,2) NOT NULL,
  tipo_carga  TEXT,
  peso_kg     DECIMAL(10,2),
  custo_diesel_est  DECIMAL(12,2),
  custo_pedagio_est DECIMAL(12,2),
  ganho_est         DECIMAL(12,2),
  dados_raw   JSONB,                    -- payload completo da plataforma
  salvo_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plataforma, frete_id) -- evita duplicata de salvo
);

ALTER TABLE public.fretes_salvos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fretes_salvos_own" ON public.fretes_salvos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fretes_salvos_user ON public.fretes_salvos(user_id, salvo_em DESC);

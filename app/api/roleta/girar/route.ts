import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Prêmios calibrados para 60% de margem líquida a 50% de cache hit (R$0,195/busca)
// Jackpot +12 (era +30 — inviável financeiramente)
// Nunca dá "nada" — sempre entrega algo
export const PRIZES = [
  { id: 'jackpot', label: '+12 buscas', short: '+12', emoji: '🔥', tipo: 'busca',  valor: 12 },
  { id: 'grande',  label: '+6 buscas',  short: '+6',  emoji: '⭐', tipo: 'busca',  valor: 6  },
  { id: 'bom',     label: '+4 buscas',  short: '+4',  emoji: '🚀', tipo: 'busca',  valor: 4  },
  { id: 'normal',  label: '+2 buscas',  short: '+2',  emoji: '🔍', tipo: 'busca',  valor: 2  },
  { id: 'pequeno', label: '+1 busca',   short: '+1',  emoji: '👆', tipo: 'busca',  valor: 1  },
  { id: 'roleta1', label: '+1 giro',    short: '+1🎡', emoji: '🎡', tipo: 'roleta', valor: 1  },
  { id: 'mini',    label: '+2 giros',   short: '+2🎲', emoji: '🎲', tipo: 'roleta', valor: 2  },
]

// Starter: EV 2,44 buscas/giro → custo R$0,476 → líquido 61,4% (R$37/30 giros, 50% cache)
// Pro: EV 2,82 buscas/giro → custo R$0,55 → líquido ~55% (Pro já paga mais no plano)
export const PROBS_STARTER = [1,  5, 10, 25, 39, 10, 10]
export const PROBS_PRO     = [2,  8, 15, 28, 32,  8,  7]

function sortear(probs: number[]) {
  const total = probs.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i]
    if (r <= 0) return i
  }
  return probs.length - 1
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('plano, roleta_saldo, fretes_bonus')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  if ((profile.roleta_saldo || 0) <= 0) return NextResponse.json({ error: 'Sem roletas disponíveis' }, { status: 400 })

  const isPro = profile.plano === 'active'
  const idx = sortear(isPro ? PROBS_PRO : PROBS_STARTER)
  const prize = PRIZES[idx]
  const novoSaldo = (profile.roleta_saldo || 0) - 1

  type UserUpdate = { roleta_saldo: number; fretes_bonus?: number }
  const updates: UserUpdate = { roleta_saldo: novoSaldo }

  if (prize.tipo === 'busca') {
    updates.fretes_bonus = (profile.fretes_bonus || 0) + prize.valor
  } else if (prize.tipo === 'roleta') {
    updates.roleta_saldo = novoSaldo + prize.valor
  }

  await supabase.from('users').update(updates).eq('id', user.id)

  return NextResponse.json({ prize, prizeIndex: idx, novoSaldo: updates.roleta_saldo, isPro })
}

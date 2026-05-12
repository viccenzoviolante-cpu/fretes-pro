import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const PRIZES = [
  { id: 'nada',     label: 'Tente novamente', emoji: '🎲', tipo: 'nada',   valor: 0  },
  { id: 'busca1',   label: '+1 busca',        emoji: '🔍', tipo: 'busca',  valor: 1  },
  { id: 'roleta2',  label: '+2 roletas',      emoji: '🔄', tipo: 'roleta', valor: 2  },
  { id: 'busca3',   label: '+3 buscas',       emoji: '🔍🔍',tipo: 'busca', valor: 3  },
  { id: 'busca5',   label: '+5 buscas',       emoji: '🚀', tipo: 'busca',  valor: 5  },
  { id: 'busca10',  label: '+10 buscas',      emoji: '⭐', tipo: 'busca',  valor: 10 },
]

const PROBS_STARTER = [35, 30, 15, 13, 6, 1]
const PROBS_PRO     = [20, 30, 15, 23, 10, 2]

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

  if ((profile.roleta_saldo || 0) <= 0) {
    return NextResponse.json({ error: 'Sem roletas disponíveis' }, { status: 400 })
  }

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

  return NextResponse.json({ prize, prizeIndex: idx, novoSaldo: updates.roleta_saldo })
}

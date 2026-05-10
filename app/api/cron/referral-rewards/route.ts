import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron diário: verifica indicações cujo indicado JÁ PAGOU e credita 1 mês Starter ao indicador
// Vercel Cron: roda todo dia às 03:00 BRT (06:00 UTC)
// Regra: 1 amigo paga → indicador ganha 1 mês de Starter grátis (trial_fim + 30 dias)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Buscar todos os referrals com status 'pago' (indicado pagou, indicador ainda não foi recompensado)
  const { data: pagos } = await supabase
    .from('referrals')
    .select('id, referrer_id')
    .eq('status', 'pago')

  if (!pagos || pagos.length === 0) {
    return NextResponse.json({ ok: true, recompensados: 0 })
  }

  let recompensados = 0

  for (const ref of pagos) {
    // 2. Estender trial_fim do indicador em 30 dias (1 mês Starter grátis)
    const { data: referrer } = await supabase
      .from('users')
      .select('trial_fim, plano')
      .eq('id', ref.referrer_id)
      .single()

    if (referrer) {
      // Base para calcular: se ainda em trial, usa trial_fim atual; se já expirou, usa hoje
      const base = referrer.plano === 'trial' && new Date(referrer.trial_fim) > new Date()
        ? new Date(referrer.trial_fim)
        : new Date()
      base.setDate(base.getDate() + 30)

      await supabase
        .from('users')
        .update({ trial_fim: base.toISOString() })
        .eq('id', ref.referrer_id)

      // 3. Marcar referral como recompensado
      await supabase
        .from('referrals')
        .update({ status: 'recompensado', rewarded_at: new Date().toISOString() })
        .eq('id', ref.id)

      recompensados++
    }
  }

  return NextResponse.json({ ok: true, recompensados })
}

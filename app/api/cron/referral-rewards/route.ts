import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron diário: verifica indicações qualificadas e credita 1 mês grátis
// Vercel Cron: roda todo dia às 03:00 BRT (06:00 UTC)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const DIAS_PARA_QUALIFICAR = 7
  const AMIGOS_PARA_GANHAR = 5

  // 1. Marcar indicações que atingiram 7 dias de uso como 'qualified'
  const seteAnosAtras = new Date()
  seteAnosAtras.setDate(seteAnosAtras.getDate() - DIAS_PARA_QUALIFICAR)

  const { data: pendentes } = await supabase
    .from('referrals')
    .select('id, referred_id')
    .eq('status', 'pending')

  if (pendentes && pendentes.length > 0) {
    for (const ref of pendentes) {
      const { data: referred } = await supabase
        .from('users')
        .select('created_at')
        .eq('id', ref.referred_id)
        .single()

      if (referred && new Date(referred.created_at) <= seteAnosAtras) {
        await supabase
          .from('referrals')
          .update({ status: 'qualified', qualified_at: new Date().toISOString() })
          .eq('id', ref.id)
      }
    }
  }

  // 2. Verificar referrers que têm 5+ qualificados e ainda não foram recompensados
  const { data: qualificados } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('status', 'qualified')

  if (!qualificados || qualificados.length === 0) {
    return NextResponse.json({ ok: true, recompensados: 0 })
  }

  // Agrupar por referrer
  const contagem: Record<string, number> = {}
  for (const q of qualificados) {
    contagem[q.referrer_id] = (contagem[q.referrer_id] || 0) + 1
  }

  let recompensados = 0

  for (const [referrerId, count] of Object.entries(contagem)) {
    if (count >= AMIGOS_PARA_GANHAR) {
      // Extender trial_fim em 30 dias
      const { data: user } = await supabase
        .from('users')
        .select('trial_fim')
        .eq('id', referrerId)
        .single()

      if (user) {
        const novaData = new Date(user.trial_fim)
        novaData.setDate(novaData.getDate() + 30)

        await supabase
          .from('users')
          .update({ trial_fim: novaData.toISOString() })
          .eq('id', referrerId)

        // Marcar as qualificadas como 'rewarded'
        await supabase
          .from('referrals')
          .update({ status: 'rewarded', rewarded_at: new Date().toISOString() })
          .eq('referrer_id', referrerId)
          .eq('status', 'qualified')

        recompensados++
      }
    }
  }

  return NextResponse.json({ ok: true, recompensados })
}

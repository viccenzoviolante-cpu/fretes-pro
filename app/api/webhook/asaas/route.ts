import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

const admin = createAdmin<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('asaas-access-token')
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { event, payment } = body as {
    event: string
    payment?: {
      id: string
      customer: string
      subscription?: string
      value: number
      status: string
      externalReference?: string
    }
  }

  if (!payment) return NextResponse.json({ ok: true })

  // Buscar usuário pelo subscription ID ou customer ID
  let userRow = null

  if (payment.subscription) {
    const { data } = await admin
      .from('users')
      .select('id, plano, plano_fim')
      .eq('asaas_subscription_id', payment.subscription)
      .single()
    userRow = data
  }

  if (!userRow) {
    const { data } = await admin
      .from('users')
      .select('id, plano, plano_fim')
      .eq('asaas_customer_id', payment.customer)
      .single()
    userRow = data
  }

  if (!userRow) return NextResponse.json({ ok: true })

  // Extrair periodo do externalReference: "{userId}|{plano}|{periodo}"
  const parts = (payment.externalReference || '').split('|')
  const periodo = parts[2] as string
  const meses = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    const base = userRow.plano === 'active' && userRow.plano_fim
      ? new Date(userRow.plano_fim)
      : new Date()

    await admin.from('users').update({
      plano: 'active',
      plano_fim: addMonths(base, meses).toISOString(),
    }).eq('id', userRow.id)

    await admin.from('referrals')
      .update({ status: 'pago', pagou_em: new Date().toISOString() })
      .eq('referred_id', userRow.id)
      .eq('status', 'pendente')

  } else if (event === 'PAYMENT_OVERDUE') {
    // Grace period: não expirar ainda, só log

  } else if (event === 'SUBSCRIPTION_DELETED' || event === 'PAYMENT_DELETED') {
    await admin.from('users')
      .update({ plano: 'expired', asaas_subscription_id: null })
      .eq('id', userRow.id)
  }

  return NextResponse.json({ ok: true })
}

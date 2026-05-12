import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

const admin = createSupabaseAdmin<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function addMonths(date: Date, n: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  const params = new URLSearchParams(text)
  const notificationId = params.get('notification_id')
  const transactionId  = params.get('transaction_id') ?? undefined

  if (!notificationId) return NextResponse.json({ ok: false }, { status: 400 })

  const notifResp = await fetch('https://pix.paghiper.com/transaction/notification/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      apiKey:          process.env.PAGHIPER_API_KEY,
      token:           process.env.PAGHIPER_TOKEN,
      notification_id: notificationId,
      transaction_id:  transactionId,
    }),
  })

  const notifData = await notifResp.json()
  const tx = notifData?.status_request
  if (!tx || tx.result !== 'success') return NextResponse.json({ ok: true })

  const status:  string = tx.status
  const orderId: string = tx.order_id      // FP-{uid8}-{plano}-{periodo}-{ts}
  const txId:    string = tx.transaction_id

  // Extrair periodo do order_id
  const parts  = orderId.split('-')          // ['FP', uid8, plano, periodo, ts]
  const periodo = parts[3] as string
  const meses  = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1

  // Buscar usuário pelo transaction_id salvo
  const { data: userRow } = await admin
    .from('users')
    .select('id, plano, plano_fim')
    .eq('paghiper_transaction_id', txId)
    .single()

  if (!userRow) return NextResponse.json({ ok: true })

  if (status === 'paid' || status === 'reserved') {
    const base = userRow.plano === 'active' && userRow.plano_fim
      ? new Date(userRow.plano_fim)
      : new Date()

    await admin.from('users').update({
      plano:                   'active',
      plano_fim:               addMonths(base, meses).toISOString(),
      paghiper_transaction_id: null,
    }).eq('id', userRow.id)

    // Marcar referral como pago para o cron de recompensas processar
    await admin.from('referrals')
      .update({ status: 'pago', pagou_em: new Date().toISOString() })
      .eq('referred_id', userRow.id)
      .eq('status', 'pendente')

  } else if (status === 'cancelled') {
    await admin.from('users')
      .update({ plano: 'expired', paghiper_transaction_id: null })
      .eq('id', userRow.id)
  }

  return NextResponse.json({ ok: true })
}

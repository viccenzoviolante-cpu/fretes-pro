import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PRICES = {
  starter: {
    mensal:     { primeira: 6790,  renovacao: 9700  },
    trimestral: { primeira: 22700, renovacao: 24700 },
    anual:      { primeira: 77000, renovacao: 97000 },
  },
  pro: {
    mensal:     { primeira: 9790,  renovacao: 12700  },
    trimestral: { primeira: 28700, renovacao: 32400  },
    anual:      { primeira: 97000, renovacao: 127000 },
  },
} as const

type Plano   = keyof typeof PRICES
type Periodo = keyof (typeof PRICES)['starter']

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const plano   = body.plano   as Plano
  const periodo = body.periodo as Periodo
  const cpf     = (body.cpf as string)?.replace(/\D/g, '')

  if (!plano || !periodo || !cpf || cpf.length < 11) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('nome, email, plano, desconto_referral')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const isPrimeira = profile.plano === 'trial' || profile.plano === 'expired'
  const tabela = PRICES[plano][periodo]
  const base = isPrimeira ? tabela.primeira : tabela.renovacao

  const desc = profile.desconto_referral || 0
  const price_cents = (desc > 0 && periodo === 'mensal')
    ? Math.round(base * (1 - desc / 100))
    : base

  const orderId = `FP-${user.id.slice(0, 8)}-${plano}-${periodo}-${Date.now()}`

  const resp = await fetch('https://pix.paghiper.com/invoice/create/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      apiKey: process.env.PAGHIPER_API_KEY,
      order_id: orderId,
      payer_email: profile.email,
      payer_name: profile.nome || 'Usuário FretesPro',
      payer_cpf_cnpj: cpf,
      days_due_date: 2,
      items: [{
        description: `FretesPro ${plano.charAt(0).toUpperCase() + plano.slice(1)} — ${periodo}`,
        price_cents,
        quantity: 1,
        item_id: `fretespro-${plano}-${periodo}`,
      }],
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/paghiper`,
      fixed_description: true,
    }),
  })

  const data = await resp.json()
  const result = data?.create_request

  if (!result || result.result !== 'success') {
    console.error('PagHiper error:', data)
    return NextResponse.json({ error: 'Erro ao gerar PIX', detail: result?.response_message }, { status: 500 })
  }

  await supabase
    .from('users')
    .update({ paghiper_transaction_id: result.transaction_id })
    .eq('id', user.id)

  return NextResponse.json({
    transaction_id:   result.transaction_id,
    pix_copia_e_cola: result.pix_code?.pix_copia_e_cola,
    qrcode_image_url: result.pix_code?.qrcode_image_url,
    due_date:         result.due_date,
    value_cents:      price_cents,
  })
}

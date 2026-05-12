import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BASE = 'https://api.asaas.com/v3'

const VALORES = {
  starter: { mensal: 67.90, trimestral: 227.00, anual: 770.00 },
  pro:     { mensal: 97.90, trimestral: 287.00, anual: 970.00 },
} as const

const CICLOS = { mensal: 'MONTHLY', trimestral: 'QUARTERLY', anual: 'YEARLY' } as const

type Plano   = keyof typeof VALORES
type Periodo = keyof typeof CICLOS
type Metodo  = 'PIX' | 'CREDIT_CARD'

function asaasHeaders() {
  return { 'Content-Type': 'application/json', access_token: process.env.ASAAS_API_KEY! }
}

async function asaasPost(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify(body),
  })
  return r.json()
}

async function asaasGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: asaasHeaders() })
  return r.json()
}

async function findOrCreateCustomer(nome: string, email: string, cpf: string, userId: string) {
  const created = await asaasPost('/customers', {
    name: nome || 'Usuário FretesPro',
    email,
    cpfCnpj: cpf,
    externalReference: userId,
    notificationDisabled: true,
  })

  if (created.id) return created.id

  // CPF já cadastrado — buscar pelo CPF
  const search = await asaasGet(`/customers?cpfCnpj=${cpf}`)
  const existing = search.data?.[0]
  if (existing?.id) return existing.id

  return null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { plano, periodo, metodo, cpf, card } = body as {
    plano: Plano
    periodo: Periodo
    metodo: Metodo
    cpf: string
    card?: {
      holderName: string
      number: string
      expiryMonth: string
      expiryYear: string
      ccv: string
      postalCode: string
      addressNumber: string
      phone: string
    }
  }

  if (!plano || !periodo || !metodo || !cpf) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }
  if (metodo === 'CREDIT_CARD' && !card) {
    return NextResponse.json({ error: 'Dados do cartão ausentes' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('nome, email, plano, desconto_referral, asaas_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const cpfLimpo = cpf.replace(/\D/g, '')
  let valor = VALORES[plano][periodo]
  const desc = profile.desconto_referral || 0
  if (desc > 0 && periodo === 'mensal') valor = Math.round(valor * (1 - desc / 100) * 100) / 100

  // 1. Customer
  let customerId = profile.asaas_customer_id
  if (!customerId) {
    customerId = await findOrCreateCustomer(profile.nome || '', profile.email, cpfLimpo, user.id)
    if (!customerId) return NextResponse.json({ error: 'Não foi possível criar cliente no Asaas' }, { status: 500 })
    await supabase.from('users').update({ asaas_customer_id: customerId }).eq('id', user.id)
  }

  // 2. Subscription
  const nextDueDate = new Date().toISOString().split('T')[0]

  const subBody: Record<string, unknown> = {
    customer: customerId,
    billingType: metodo,
    value: valor,
    nextDueDate,
    cycle: CICLOS[periodo],
    description: `FretesPro ${plano.charAt(0).toUpperCase() + plano.slice(1)} — ${periodo}`,
    externalReference: `${user.id}|${plano}|${periodo}`,
  }

  if (metodo === 'CREDIT_CARD' && card) {
    subBody.creditCard = {
      holderName: card.holderName,
      number: card.number.replace(/\s/g, ''),
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      ccv: card.ccv,
    }
    subBody.creditCardHolderInfo = {
      name: profile.nome || card.holderName,
      email: profile.email,
      cpfCnpj: cpfLimpo,
      postalCode: card.postalCode.replace(/\D/g, ''),
      addressNumber: card.addressNumber,
      phone: card.phone.replace(/\D/g, ''),
    }
  }

  const sub = await asaasPost('/subscriptions', subBody)

  if (sub.errors?.length) {
    return NextResponse.json({ error: 'Erro ao criar assinatura', detail: sub.errors[0]?.description }, { status: 400 })
  }

  await supabase.from('users').update({ asaas_subscription_id: sub.id }).eq('id', user.id)

  // 3. Cartão: ativar imediatamente (Asaas cobra na hora)
  if (metodo === 'CREDIT_CARD') {
    const meses = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1
    const plano_fim = new Date()
    plano_fim.setMonth(plano_fim.getMonth() + meses)
    await supabase.from('users').update({ plano: 'active', plano_fim: plano_fim.toISOString() }).eq('id', user.id)
    return NextResponse.json({ metodo: 'CREDIT_CARD', ok: true, value: valor })
  }

  // 4. PIX: buscar QR code da primeira cobrança
  const payments = await asaasGet(`/subscriptions/${sub.id}/payments`)
  const firstPayment = payments.data?.[0]
  if (!firstPayment) return NextResponse.json({ error: 'Pagamento PIX não gerado' }, { status: 500 })

  const pix = await asaasGet(`/payments/${firstPayment.id}/pixQrCode`)

  return NextResponse.json({
    metodo: 'PIX',
    pix_copia_e_cola: pix.payload,
    qrcode_base64: pix.encodedImage,
    due_date: firstPayment.dueDate,
    value: valor,
  })
}

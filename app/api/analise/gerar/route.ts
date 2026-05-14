import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const COOLDOWN_PRIMEIRO = 7   // dias após primeira análise
const COOLDOWN_MENSAL   = 30  // dias para as seguintes

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('plano, analise_count, ultima_analise_at')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const count = profile.analise_count || 0
  const isPro = profile.plano === 'active'

  // Conta viagens finalizadas
  const { count: vCount } = await supabase
    .from('viagens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'FINALIZADA')

  const viagens_finalizadas = vCount || 0

  // Primeira análise: livre após 10 viagens
  if (count === 0) {
    return NextResponse.json({
      disponivel: viagens_finalizadas >= 10,
      gratis: true,
      viagens_finalizadas,
      viagens_necessarias: 10,
      count,
    })
  }

  // Pro — sempre disponível após cooldown (grátis)
  const cooldown = count === 1 ? COOLDOWN_PRIMEIRO : COOLDOWN_MENSAL
  const ultima = profile.ultima_analise_at ? new Date(profile.ultima_analise_at) : null
  const diasPassados = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86400000) : cooldown + 1
  const diasRestantes = Math.max(0, cooldown - diasPassados)
  const disponivel = diasRestantes === 0

  return NextResponse.json({
    disponivel,
    gratis: isPro,
    orderbump: !isPro && disponivel,
    dias_restantes: diasRestantes,
    cooldown,
    pct_barra: Math.min(100, Math.round((diasPassados / cooldown) * 100)),
    count,
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('plano, analise_count, ultima_analise_at, kml_medio')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Busca todas as viagens finalizadas + despesas
  const [{ data: viagens }, { data: despesas }] = await Promise.all([
    supabase.from('viagens').select('*').eq('user_id', user.id).eq('status', 'FINALIZADA'),
    supabase.from('despesas').select('*').eq('user_id', user.id),
  ])

  if (!viagens || viagens.length < 10) {
    return NextResponse.json({ error: 'Mínimo de 10 viagens finalizadas necessário' }, { status: 400 })
  }

  // Mapeia despesas por viagem
  const despPorViagem = new Map<string, number>()
  for (const d of despesas || []) {
    if (d.viagem_id) despPorViagem.set(d.viagem_id, (despPorViagem.get(d.viagem_id) || 0) + d.valor)
  }

  function lucro(v: { id: string; valor_frete: number; descontos_nota: number }) {
    return v.valor_frete - (v.descontos_nota || 0) - (despPorViagem.get(v.id) || 0)
  }
  function margem(v: { id: string; valor_frete: number; descontos_nota: number }) {
    return v.valor_frete > 0 ? (lucro(v) / v.valor_frete) * 100 : 0
  }

  // 1. Rota campeã + rota que sangra
  const rotas = new Map<string, { lucros: number[]; margens: number[] }>()
  for (const v of viagens) {
    const key = `${v.origem}→${v.destino}`
    if (!rotas.has(key)) rotas.set(key, { lucros: [], margens: [] })
    rotas.get(key)!.lucros.push(lucro(v))
    rotas.get(key)!.margens.push(margem(v))
  }

  const rotasArr = Array.from(rotas.entries())
    .filter(([, d]) => d.lucros.length >= 1)
    .map(([rota, d]) => ({
      rota,
      lucro_medio: d.lucros.reduce((a, b) => a + b, 0) / d.lucros.length,
      margem_media: d.margens.reduce((a, b) => a + b, 0) / d.margens.length,
      qtd: d.lucros.length,
    }))
    .sort((a, b) => b.lucro_medio - a.lucro_medio)

  const rotaCampeã = rotasArr[0] || null
  const rotaSangra = rotasArr.length > 1 ? rotasArr[rotasArr.length - 1] : null

  // 2. Custo por km
  const totalKm = viagens.reduce((s, v) => s + (v.km || 0), 0)
  const totalDesp = (despesas || []).reduce((s, d) => s + d.valor, 0)
  const custoPorKm = totalKm > 0 ? totalDesp / totalKm : 0

  // 3. Melhor semana do mês
  const semanas: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const v of viagens) {
    const dia = new Date(v.data + 'T12:00:00').getDate()
    const sem = Math.min(4, Math.ceil(dia / 7)) as 1 | 2 | 3 | 4
    semanas[sem].push(v.valor_frete)
  }
  const mediaSemanas = Object.entries(semanas).map(([s, vals]) => ({
    semana: Number(s),
    media: vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    qtd: vals.length,
  })).filter(s => s.qtd > 0).sort((a, b) => b.media - a.media)
  const melhorSemana = mediaSemanas[0] || null

  // 4. Corrida surpresa (alto frete, baixa margem)
  const avgFrete = viagens.reduce((s, v) => s + v.valor_frete, 0) / viagens.length
  const surpresa = viagens
    .filter(v => v.valor_frete > avgFrete)
    .sort((a, b) => margem(a) - margem(b))[0] || null

  const analise = {
    gerada_em: new Date().toISOString(),
    total_viagens: viagens.length,
    rota_campeã: rotaCampeã,
    rota_sangra: rotaSangra,
    custo_por_km: Math.round(custoPorKm * 100) / 100,
    melhor_semana: melhorSemana,
    corrida_surpresa: surpresa ? {
      rota: `${surpresa.origem} → ${surpresa.destino}`,
      valor_frete: surpresa.valor_frete,
      lucro: Math.round(lucro(surpresa)),
      margem: Math.round(margem(surpresa)),
    } : null,
  }

  // Atualiza timestamps
  const novoCount = (profile.analise_count || 0) + 1
  await supabase.from('users').update({
    analise_count: novoCount,
    ultima_analise_at: new Date().toISOString(),
  }).eq('id', user.id)

  return NextResponse.json({ analise, count: novoCount })
}

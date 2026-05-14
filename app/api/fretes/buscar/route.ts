import { NextResponse } from 'next/server'

export type FreteNorm = {
  id: string
  plataforma: 'fretebras' | 'fretecarga' | 'fretebarato'
  origem: string
  destino: string
  km: number
  valor_frete: number
  tipo_carga: string
  peso_kg: number
  custo_diesel_est: number
  custo_pedagio_est: number
  ganho_est: number
}

const DIESEL_PRICE = 6.50
const KM_PER_LITER = 3.0

function estimateDiesel(km: number) {
  return km > 0 ? Math.round((km / KM_PER_LITER) * DIESEL_PRICE) : 0
}

const MOCK: FreteNorm[] = [
  { id: 'fb-1', plataforma: 'fretebras', origem: 'São Paulo, SP', destino: 'Curitiba, PR', km: 408, valor_frete: 3200, tipo_carga: 'Granel', peso_kg: 22000, custo_diesel_est: 156, custo_pedagio_est: 89, ganho_est: 2955 },
  { id: 'fb-2', plataforma: 'fretebras', origem: 'Campinas, SP', destino: 'Belo Horizonte, MG', km: 590, valor_frete: 4800, tipo_carga: 'Frigorífico', peso_kg: 18000, custo_diesel_est: 226, custo_pedagio_est: 124, ganho_est: 4450 },
  { id: 'fb-3', plataforma: 'fretebras', origem: 'São Paulo, SP', destino: 'Rio de Janeiro, RJ', km: 440, valor_frete: 3600, tipo_carga: 'Baú', peso_kg: 20000, custo_diesel_est: 168, custo_pedagio_est: 102, ganho_est: 3330 },
]

async function fetchFreteCarga(): Promise<FreteNorm[]> {
  const email = process.env.FRETECARGA_EMAIL
  const senha = process.env.FRETECARGA_SENHA
  if (!email || !senha) return []

  try {
    const res = await fetch(
      `https://www.fretecarga.com.br/api/fretesativos/${encodeURIComponent(email)}/${encodeURIComponent(senha)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : (data.fretes ?? data.data ?? [])

    return list
      .map((f, i) => {
        const km = Number(f.km ?? f.distancia ?? 0)
        const valor = Number(f.preco ?? f.valor ?? 0)
        const peso = Number(f.peso ?? f.peso_kg ?? 0)
        const diesel = estimateDiesel(km)
        return {
          id: String(f.id ?? f._id ?? `fc-${i}`),
          plataforma: 'fretecarga' as const,
          origem: String(f.inicio ?? f.origem ?? ''),
          destino: String(f.destino ?? ''),
          km,
          valor_frete: valor,
          tipo_carga: String(f.tipo_carga ?? f.carga ?? 'Geral'),
          peso_kg: peso,
          custo_diesel_est: diesel,
          custo_pedagio_est: 0,
          ganho_est: valor - diesel,
        }
      })
      .filter(f => f.origem && f.destino && f.valor_frete > 0)
  } catch {
    return []
  }
}

async function fetchFreteBarato(): Promise<FreteNorm[]> {
  const token = process.env.FRETEBARATO_TOKEN
  if (!token) return []

  try {
    // Endpoint a confirmar após acesso à conta — ajustar se necessário
    const res = await fetch('https://api.fretebarato.com/v1/fretes/disponiveis', {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : (data.fretes ?? data.data ?? [])

    return list
      .map((f, i) => {
        const km = Number(f.km ?? f.distancia ?? f.distance ?? 0)
        const valor = Number(f.preco ?? f.valor ?? f.price ?? 0)
        const peso = Number(f.peso ?? f.peso_kg ?? f.weight ?? 0)
        const diesel = estimateDiesel(km)
        return {
          id: String(f.id ?? f._id ?? `fbar-${i}`),
          plataforma: 'fretebarato' as const,
          origem: String(f.origem ?? f.origin ?? f.pickup ?? ''),
          destino: String(f.destino ?? f.destination ?? f.delivery ?? ''),
          km,
          valor_frete: valor,
          tipo_carga: String(f.tipo_carga ?? f.carga ?? f.cargo_type ?? 'Geral'),
          peso_kg: peso,
          custo_diesel_est: diesel,
          custo_pedagio_est: 0,
          ganho_est: valor - diesel,
        }
      })
      .filter(f => f.origem && f.destino && f.valor_frete > 0)
  } catch {
    return []
  }
}

export async function GET() {
  const [fretecarga, fretebarato] = await Promise.all([
    fetchFreteCarga(),
    fetchFreteBarato(),
  ])

  const real = [...fretecarga, ...fretebarato]
  const isMock = real.length === 0
  const fretes = isMock ? MOCK : real.sort((a, b) => b.ganho_est - a.ganho_est)

  return NextResponse.json({
    fretes,
    sources: {
      fretecarga: fretecarga.length,
      fretebarato: fretebarato.length,
      fretebras: isMock ? MOCK.length : 0,
      mock: isMock,
    },
  })
}

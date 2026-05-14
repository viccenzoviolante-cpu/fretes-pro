import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CACHE_DAYS = 21

export async function POST(req: NextRequest) {
  const { origem, destino, eixos = '6' } = await req.json()

  if (!origem || !destino) {
    return NextResponse.json({ error: 'origem e destino obrigatórios' }, { status: 400 })
  }

  const apiKey = process.env.QUALP_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'QUALP_API_KEY não configurada' }, { status: 500 })
  }

  const origemNorm = origem.trim().toLowerCase()
  const destinoNorm = destino.trim().toLowerCase()

  // Verifica cache
  const { data: cached } = await supabase
    .from('qualp_cache')
    .select('pedagio_total, distancia_km, total_pracas, updated_at')
    .eq('origem', origemNorm)
    .eq('destino', destinoNorm)
    .eq('eixos', eixos)
    .single()

  if (cached) {
    const age = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    if (age < CACHE_DAYS) {
      return NextResponse.json({
        pedagio_total: cached.pedagio_total,
        distancia_km: cached.distancia_km,
        total_pracas: cached.total_pracas,
        cache: true,
      })
    }
  }

  // Cache miss — chama QualP
  try {
    const body = JSON.stringify({
      locations: [origem, destino],
      config: {
        route: {
          type_route: 'efficient',
          calculate_return: false,
          alternative_routes: '0',
          optimized_route: false,
          optimized_route_destination: 'last',
          avoid_locations: false,
          avoid_locations_key: '',
        },
        vehicle: { type: 'truck', axis: 'all', top_speed: '' },
        tolls: { retroactive_date: '' },
        fuel_consumption: { km_fuel: '', fuel_price: '' },
      },
      show: {
        freight_table: false,
        tolls: true,
        fuel_consumption: false,
        maneuvers: false,
        truck_scales: false,
        ufs: false,
        segments_information: false,
        private_places: false,
        static_image: false,
        link_to_qualp: false,
        link_to_qualp_report: false,
        polyline: false,
        simplified_polyline: false,
      },
      exception_key: '',
    })

    const res = await fetch('https://api.qualp.com.br/rotas/v4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
        'Access-Token': apiKey,
      },
      body,
    })

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json({ error: 'QualP retornou erro', status: res.status, body: text }, { status: 502 })
    }

    const data = JSON.parse(text)

    const eixoKey = String(eixos)
    const pedagio_total = (data.pedagios ?? []).reduce((acc: number, p: Record<string, Record<string, number>>) => {
      const tarifa = p.tarifa?.[eixoKey] ?? p.tarifa?.['6'] ?? 0
      return acc + tarifa
    }, 0)

    const result = {
      pedagio_total: Math.round(pedagio_total * 100) / 100,
      distancia_km: data.distancia?.valor ?? 0,
      total_pracas: data.pedagios?.length ?? 0,
    }

    // Salva no cache (upsert)
    await supabase.from('qualp_cache').upsert({
      origem: origemNorm,
      destino: destinoNorm,
      eixos,
      ...result,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'origem,destino,eixos' })

    return NextResponse.json({ ...result, cache: false })
  } catch (err) {
    return NextResponse.json({ error: 'Falha ao chamar QualP', details: String(err) }, { status: 500 })
  }
}

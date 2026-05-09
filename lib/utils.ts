export function fmtBRL(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? parseMoney(n) : (n ?? 0)
  return 'R$ ' + Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function parseMoney(s: string | number | null | undefined): number {
  if (typeof s === 'number') return s
  const c = String(s ?? '').replace(/[^0-9,]/g, '').replace(',', '.')
  return parseFloat(c) || 0
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('pt-BR')
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function mesAtual(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function maskMoney(value: string): string {
  const nums = value.replace(/\D/g, '')
  return nums ? fmtBRL(parseInt(nums, 10) / 100) : ''
}

export function margemPct(valorFrete: number, lucro: number): number {
  return valorFrete > 0 ? Math.round((lucro / valorFrete) * 100) : 0
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export async function geocodar(local: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(local + ', Brasil')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {}
  return null
}

export async function calcularDistanciaOSRM(partida: string, chegada: string): Promise<number | null> {
  const [c1, c2] = await Promise.all([geocodar(partida), geocodar(chegada)])
  if (!c1 || !c2) return null
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`
    )
    const data = await res.json()
    if (data.routes?.[0]) return Math.round(data.routes[0].distance / 1000)
  } catch {}
  return null
}

export const CATS_PADRAO = ['Diesel', 'Pedágio', 'Alimentação']
export const CAT_ICONS: Record<string, string> = { Diesel: '⛽', Pedágio: '🛣️', Alimentação: '🍽️' }
export const DEFAULT_ICON = '📦'

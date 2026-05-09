'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ViagemRow, DespesaRow, UserRow } from '@/types/database'
import { fmtBRL, fmtDate, margemPct, haversineKm } from '@/lib/utils'
import Toast from '@/components/Toast'

export default function DashboardPage() {
  const router = useRouter()
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [gpsStatus, setGpsStatus] = useState('📡 Aguardando GPS...')
  const [gpsPct, setGpsPct] = useState(0)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: v }, { data: d }, { data: p }] = await Promise.all([
      supabase.from('viagens').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('despesas').select('*').eq('user_id', user.id),
      supabase.from('users').select('*').eq('id', user.id).single(),
    ])
    setViagens(v || [])
    setDespesas(d || [])
    setProfile(p)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function custoViagem(v: ViagemRow) {
    return v.descontos_nota + despesas.filter(d => d.viagem_id === v.id).reduce((s, d) => s + d.valor, 0)
  }
  function lucroViagem(v: ViagemRow) { return v.valor_frete - custoViagem(v) }

  const viagemAtiva = viagens.find(v => v.status === 'EM_ANDAMENTO') || null
  const now = new Date()
  const mesViagens = viagens.filter(v => {
    const d = new Date(v.data + 'T12:00:00')
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const fat = mesViagens.reduce((s, v) => s + v.valor_frete, 0)
  const custo = mesViagens.reduce((s, v) => s + custoViagem(v), 0)
  const lucro = fat - custo
  const km = mesViagens.reduce((s, v) => s + (v.km || 0), 0)
  const kml = profile?.kml_medio || 0
  const ultimas3 = viagens.filter(v => v.status === 'FINALIZADA').slice(0, 3)

  async function encerrarViagem(id: string) {
    if (!confirm('Confirma o encerramento desta viagem?')) return
    const supabase = createClient()
    await supabase.from('viagens').update({ status: 'FINALIZADA' }).eq('id', id)
    setToast({ msg: 'Viagem encerrada!', type: 'success' })
    fetchData()
  }

  function compartilharResumo() {
    const mes = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const mv = mesViagens.filter(v => v.status === 'FINALIZADA')
    const fat2 = mv.reduce((s, v) => s + v.valor_frete, 0)
    const custo2 = mv.reduce((s, v) => s + custoViagem(v), 0)
    const lucro2 = fat2 - custo2
    const mg = fat2 > 0 ? Math.round((lucro2 / fat2) * 100) : 0
    const melhor = [...mv].sort((a, b) => lucroViagem(b) - lucroViagem(a))[0]
    const texto = [
      `🚛 FretesPro — ${mes.charAt(0).toUpperCase() + mes.slice(1)}`,
      '',
      `Corridas finalizadas: ${mv.length}`,
      `Faturamento: ${fmtBRL(fat2)}`,
      `Custo total: ${fmtBRL(custo2)}`,
      `Lucro líquido: ${fmtBRL(lucro2)}`,
      `Margem: ${mg}%`,
      melhor ? `Melhor corrida: ${melhor.origem} → ${melhor.destino} (${fmtBRL(lucroViagem(melhor))})` : '',
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(texto)
      .then(() => setToast({ msg: 'Resumo copiado! Cole no WhatsApp 📋', type: 'success' }))
      .catch(() => prompt('Copie o texto abaixo:', texto))
  }

  useEffect(() => {
    if (!viagemAtiva || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        if (!viagemAtiva.gps_origem_lat || !viagemAtiva.gps_origem_lon || !viagemAtiva.km) {
          setGpsStatus('📡 GPS ativo'); return
        }
        const pct = Math.min(
          Math.round((haversineKm(viagemAtiva.gps_origem_lat, viagemAtiva.gps_origem_lon, pos.coords.latitude, pos.coords.longitude) / viagemAtiva.km) * 100),
          100
        )
        setGpsPct(pct); setGpsStatus('📡 GPS ativo')
      },
      () => setGpsStatus('📡 GPS indisponível'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [viagemAtiva])

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header flex-between">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">{now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="flex gap8">
          <button className="btn btn-ghost btn-sm" onClick={compartilharResumo}>📤 Compartilhar</button>
          {viagemAtiva
            ? <button className="btn btn-danger" onClick={() => encerrarViagem(viagemAtiva.id)}>🔴 Encerrar Viagem</button>
            : <button className="btn btn-primary" onClick={() => router.push('/viagens')}>+ Iniciar Nova Viagem</button>
          }
        </div>
      </div>

      {viagemAtiva && (() => {
        const c = custoViagem(viagemAtiva), l = lucroViagem(viagemAtiva)
        return (
          <div className="card card-green mb16">
            <div className="card-header">
              <div style={{ fontSize: '14px', fontWeight: 700 }}>🚛 Viagem em andamento</div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push('/despesas')}>+ Despesa desta viagem</button>
            </div>
            <div className="stat-row mt16">
              <div className="stat-item"><div className="stat-label">Rota</div><div className="stat-value">{viagemAtiva.origem} → {viagemAtiva.destino}</div></div>
              <div className="stat-item"><div className="stat-label">Contratante</div><div className="stat-value">{viagemAtiva.contratante || '—'}</div></div>
              <div className="stat-item"><div className="stat-label">Frete</div><div className="stat-value green">{fmtBRL(viagemAtiva.valor_frete)}</div></div>
              <div className="stat-item"><div className="stat-label">Custo atual</div><div className="stat-value red">{fmtBRL(c)}</div></div>
              <div className="stat-item"><div className="stat-label">Lucro atual</div><div className={`stat-value ${l >= 0 ? 'green' : 'red'}`}>{fmtBRL(l)}</div></div>
            </div>
            <div className="progress-wrap">
              <div className="progress-labels">
                <span>{gpsPct}% percorrido</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{gpsStatus}</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${gpsPct}%` }} /></div>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-4 mb16">
        <div className="card"><div className="card-title">Faturamento</div><div className="card-value green">{fmtBRL(fat)}</div></div>
        <div className="card"><div className="card-title">Custo total</div><div className="card-value red">{fmtBRL(custo)}</div></div>
        <div className="card"><div className="card-title">Lucro líquido</div><div className={`card-value ${lucro >= 0 ? 'green' : 'red'}`}>{fmtBRL(lucro)}</div></div>
        <div className="card"><div className="card-title">KM rodados</div><div className="card-value">{km.toLocaleString('pt-BR')} km</div></div>
        {kml > 0
          ? <div className="card"><div className="card-title">⛽ Consumo médio</div><div className="card-value">{kml.toFixed(1)} km/L</div><div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>~R${(6.2 / kml).toFixed(2)}/km</div></div>
          : <div className="card card-dashed" onClick={() => router.push('/configuracoes')}><div className="card-title">⛽ Consumo médio</div><div className="card-value muted" style={{ fontSize: '16px' }}>Configurar →</div></div>
        }
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Últimas 3 viagens</div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/viagens')}>Ver todas →</button>
        </div>
        {!ultimas3.length ? <div className="empty">Nenhuma viagem finalizada ainda.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Rota</th><th>Faturamento</th><th>Custo</th><th>Lucro</th><th>Margem</th><th>Status</th></tr></thead>
              <tbody>
                {ultimas3.map(v => {
                  const c = custoViagem(v), l = lucroViagem(v), mg = margemPct(v.valor_frete, l)
                  return (
                    <tr key={v.id}>
                      <td>{fmtDate(v.data)}</td>
                      <td><strong>{v.origem}</strong> → {v.destino}</td>
                      <td className="green">{fmtBRL(v.valor_frete)}</td>
                      <td className="red">{fmtBRL(c)}</td>
                      <td className={`${l >= 0 ? 'green' : 'red'} fw600`}>{fmtBRL(l)}</td>
                      <td><span className={`badge ${l < 0 ? 'badge-red' : mg >= 20 ? 'badge-green' : 'badge-yellow'}`}>{mg}%</span></td>
                      <td><span className="badge badge-green">Finalizada</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

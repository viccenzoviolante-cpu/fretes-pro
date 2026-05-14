'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtBRL, fmtDate } from '@/lib/utils'
import type { UserRow, FreteSalvoRow } from '@/types/database'

// Limites por plano
const LIMITE_PRO_DIA = 10
const LIMITE_FREE_MES = 5

// Mock de fretes enquanto FreteBras API não está disponível
const MOCK_FRETES = [
  { id: 'f1', plataforma: 'fretebras', origem: 'São Paulo, SP', destino: 'Curitiba, PR', km: 408, valor_frete: 3200, tipo_carga: 'Granel', peso_kg: 22000, custo_diesel_est: 156, custo_pedagio_est: 89, ganho_est: 2955 },
  { id: 'f2', plataforma: 'fretebras', origem: 'Campinas, SP', destino: 'Belo Horizonte, MG', km: 590, valor_frete: 4800, tipo_carga: 'Frigorífico', peso_kg: 18000, custo_diesel_est: 226, custo_pedagio_est: 124, ganho_est: 4450 },
  { id: 'f3', plataforma: 'fretebras', origem: 'São Paulo, SP', destino: 'Rio de Janeiro, RJ', km: 440, valor_frete: 3600, tipo_carga: 'Baú', peso_kg: 20000, custo_diesel_est: 168, custo_pedagio_est: 102, ganho_est: 3330 },
]

type Frete = typeof MOCK_FRETES[0]

export default function MelhoresFretesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [fretes, setFretes] = useState<Frete[]>([])
  const [salvos, setSalvos] = useState<FreteSalvoRow[]>([])
  const [aba, setAba] = useState<'buscar' | 'salvos'>('buscar')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [buscouAgora, setBuscouAgora] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('fretes_salvos').select('*').eq('user_id', user.id).order('salvo_em', { ascending: false }),
    ])
    if (p) setProfile(p as UserRow)
    setSalvos((s || []) as FreteSalvoRow[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Verificar limite de uso
  function verificarLimite(): { pode: boolean; motivo?: string; restantes: number; usandoBonus: boolean } {
    if (!profile) return { pode: false, motivo: 'Carregando...', restantes: 0, usandoBonus: false }
    const isPro = profile.plano === 'active'
    const bonus = profile.fretes_bonus || 0

    if (isPro) {
      const hoje = new Date().toISOString().slice(0, 10)
      const mesmodia = profile.fretes_dia_data === hoje
      const usados = mesmodia ? (profile.fretes_dia_contagem || 0) : 0
      const restantes = LIMITE_PRO_DIA - usados
      if (restantes > 0) return { pode: true, restantes, usandoBonus: false }
      if (bonus > 0) return { pode: true, restantes: bonus, usandoBonus: true }
      return { pode: false, motivo: `Limite diário atingido. Gire a roleta para ganhar buscas extras!`, restantes: 0, usandoBonus: false }
    } else {
      const mesAtual = new Date().toISOString().slice(0, 7)
      const mesmoMes = profile.fretes_mes_inicio?.slice(0, 7) === mesAtual
      const usados = mesmoMes ? (profile.fretes_mes_contagem || 0) : 0
      const restantes = LIMITE_FREE_MES - usados
      if (restantes > 0) return { pode: true, restantes, usandoBonus: false }
      if (bonus > 0) return { pode: true, restantes: bonus, usandoBonus: true }
      return { pode: false, motivo: `Limite mensal atingido. Gire a roleta para ganhar buscas extras!`, restantes: 0, usandoBonus: false }
    }
  }

  async function buscarFretes() {
    const { pode, motivo } = verificarLimite()
    if (!pode) { alert(motivo); return }

    setBuscando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    const limite = verificarLimite()
    const isPro = profile.plano === 'active'
    const hoje = new Date().toISOString().slice(0, 10)
    const mesAtual = hoje

    if (limite.usandoBonus) {
      // Consome do bonus da roleta
      await supabase.from('users').update({
        fretes_bonus: Math.max(0, (profile.fretes_bonus || 0) - 1),
      }).eq('id', user.id)
    } else if (isPro) {
      const mesmodia = profile.fretes_dia_data === hoje
      await supabase.from('users').update({
        fretes_dia_contagem: mesmodia ? (profile.fretes_dia_contagem || 0) + 1 : 1,
        fretes_dia_data: hoje,
      }).eq('id', user.id)
    } else {
      const mesmoMes = profile.fretes_mes_inicio?.slice(0, 7) === hoje.slice(0, 7)
      await supabase.from('users').update({
        fretes_mes_contagem: mesmoMes ? (profile.fretes_mes_contagem || 0) + 1 : 1,
        fretes_mes_inicio: mesAtual,
      }).eq('id', user.id)
    }

    // Simula carregamento (quando FreteBras chegar, faz fetch real aqui)
    await new Promise(r => setTimeout(r, 1200))
    setFretes(MOCK_FRETES)
    setBuscouAgora(true)

    // Atualizar profile local
    setProfile(prev => {
      if (!prev) return prev
      if (isPro) return { ...prev, fretes_dia_contagem: (prev.fretes_dia_contagem || 0) + 1, fretes_dia_data: hoje }
      return { ...prev, fretes_mes_contagem: (prev.fretes_mes_contagem || 0) + 1, fretes_mes_inicio: mesAtual }
    })
    setBuscando(false)
  }

  async function salvarFrete(f: Frete) {
    setSalvando(f.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('fretes_salvos').upsert({
      user_id: user.id,
      plataforma: f.plataforma,
      frete_id: f.id,
      origem: f.origem,
      destino: f.destino,
      km: f.km,
      valor_frete: f.valor_frete,
      tipo_carga: f.tipo_carga,
      peso_kg: f.peso_kg,
      custo_diesel_est: f.custo_diesel_est,
      custo_pedagio_est: f.custo_pedagio_est,
      ganho_est: f.ganho_est,
      dados_raw: f as Record<string, unknown>,
    }, { onConflict: 'user_id,plataforma,frete_id' })

    if (!error) {
      await fetchData()
    }
    setSalvando(null)
  }

  async function removerSalvo(id: string) {
    const supabase = createClient()
    await supabase.from('fretes_salvos').delete().eq('id', id)
    setSalvos(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <div className="empty">Carregando...</div>

  const limite = verificarLimite()
  const isPro = profile?.plano === 'active'
  const idsSalvos = new Set(salvos.map(s => `${s.plataforma}:${s.frete_id}`))

  return (
    <>
      {/* Header + abas */}
      <div className="page-header flex-between">
        <div>
          <div className="page-title">🔍 Melhores Fretes</div>
          <div className="page-sub">FreteBras · filtrado pelo seu caminhão</div>
        </div>
        {limite.pode && (
          <span style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
            {isPro ? `${LIMITE_PRO_DIA - (profile?.fretes_dia_contagem || 0)} buscas hoje` : `${limite.restantes} este mês`}
          </span>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
        {(['buscar', 'salvos'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: aba === a ? 'var(--primary)' : 'transparent', color: aba === a ? '#fff' : 'var(--muted)', transition: 'all .15s' }}>
            {a === 'buscar' ? '🔍 Buscar fretes' : `🔖 Salvos (${salvos.length})`}
          </button>
        ))}
      </div>

      {/* ABA — BUSCAR */}
      {aba === 'buscar' && (
        <>
          {/* Limite atingido */}
          {!limite.pode && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 7%, transparent)', textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Limite atingido</div>
              <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', margin: '0 auto 20px', lineHeight: '1.6' }}>{limite.motivo}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('openRoleta'))}>🎰 Girar a Roleta</button>
                {!isPro && <button className="btn btn-ghost" onClick={() => router.push('/planos')}>Ver plano Pro →</button>}
              </div>
            </div>
          )}

          {/* Estado inicial */}
          {limite.pode && !buscouAgora && !buscando && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Encontre o melhor frete agora</div>
              <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', margin: '0 auto 28px', lineHeight: '1.6' }}>
                Busca filtrada pelo seu caminhão — capacidade, tipo de carga e distância máxima de {profile?.raio_km_max || 200}km.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '28px' }}>
                {['⛽ Diesel calculado', '🛣️ Pedágio estimado', '📦 Filtrado pelo caminhão'].map(t => (
                  <span key={t} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', padding: '6px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}>{t}</span>
                ))}
              </div>
              <button className="btn btn-primary" style={{ fontSize: '15px', padding: '12px 32px' }} onClick={buscarFretes}>
                🔍 Buscar fretes
              </button>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
                {isPro ? `${LIMITE_PRO_DIA} buscas por dia` : `${limite.restantes} de ${LIMITE_FREE_MES} buscas este mês`}
              </div>
            </div>
          )}

          {/* Carregando */}
          {buscando && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</div>
              <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Buscando os melhores fretes perto de você...</div>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Resultados */}
          {buscouAgora && !buscando && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {fretes.map((f, i) => {
                  const jaSalvo = idsSalvos.has(`${f.plataforma}:${f.id}`)
                  return (
                    <div key={f.id} className="corridas-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {i === 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--yellow)', marginBottom: '4px', display: 'block' }}>⭐ MELHOR GANHO</span>}
                          <div className="corridas-rota" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.origem}</div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>→ {f.destino}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{f.km.toLocaleString('pt-BR')} km · {f.tipo_carga} · {((f.peso_kg || 0) / 1000).toFixed(0)}t</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="corridas-ganho">{fmtBRL(f.ganho_est)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>líquido est.</div>
                        </div>
                      </div>

                      <div style={{ height: '1px', background: 'var(--border)' }} />

                      <div className="corridas-detail">
                        <span>💰 Frete: <strong style={{ color: 'var(--text)' }}>{fmtBRL(f.valor_frete)}</strong></span>
                        <span>⛽ Diesel: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(f.custo_diesel_est)}</strong></span>
                        <span>🛣️ Pedágio: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(f.custo_pedagio_est)}</strong></span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className={`btn btn-sm ${jaSalvo ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => !jaSalvo && salvarFrete(f)}
                          disabled={salvando === f.id || jaSalvo}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {salvando === f.id ? '...' : jaSalvo ? '🔖 Salvo' : '🔖 Salvar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => window.open('https://fretebras.com.br', '_blank')} style={{ whiteSpace: 'nowrap' }}>
                          Ver no FreteBras →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  ⚠️ Dados de exemplo — FreteBras em breve
                </div>
                {limite.pode && (
                  <button className="btn btn-ghost btn-sm" onClick={buscarFretes} disabled={buscando}>🔄 Atualizar</button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ABA — SALVOS */}
      {aba === 'salvos' && (
        <>
          {salvos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔖</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Nenhum frete salvo</div>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>Toque em "Salvar" em qualquer frete encontrado para guardar aqui.</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAba('buscar')}>← Buscar fretes</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {salvos.map(s => (
                <div key={s.id} className="corridas-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.origem}</div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>→ {s.destino}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {s.km ? `${s.km.toLocaleString('pt-BR')} km · ` : ''}{s.tipo_carga || 'Carga geral'}
                        {s.peso_kg ? ` · ${(s.peso_kg / 1000).toFixed(0)}t` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="corridas-ganho">{fmtBRL(s.ganho_est || 0)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>líquido est.</div>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)' }} />

                  <div className="corridas-detail">
                    <span>💰 Frete: <strong style={{ color: 'var(--text)' }}>{fmtBRL(s.valor_frete)}</strong></span>
                    {s.custo_diesel_est && <span>⛽ Diesel: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(s.custo_diesel_est)}</strong></span>}
                    {s.custo_pedagio_est && <span>🛣️ Pedágio: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(s.custo_pedagio_est)}</strong></span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Salvo em {fmtDate(s.salvo_em.slice(0, 10))}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => removerSalvo(s.id)} style={{ color: 'var(--red)', whiteSpace: 'nowrap' }}>
                      🗑️ Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

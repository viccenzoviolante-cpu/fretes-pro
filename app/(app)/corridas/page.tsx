'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtBRL } from '@/lib/utils'
import type { UserRow } from '@/types/database'

const LIMITE_GRATIS = 5

// Mock de corridas enquanto FreteBras API não está disponível
const MOCK_CORRIDAS = [
  {
    id: '1',
    origem: 'São Paulo, SP',
    destino: 'Curitiba, PR',
    km: 408,
    valor_frete: 3200,
    tipo_carga: 'Granel',
    peso_kg: 22000,
    custo_diesel: 156,
    custo_pedagio: 89,
    ganho: 2955,
  },
  {
    id: '2',
    origem: 'Campinas, SP',
    destino: 'Belo Horizonte, MG',
    km: 590,
    valor_frete: 4800,
    tipo_carga: 'Frigorífico',
    peso_kg: 18000,
    custo_diesel: 226,
    custo_pedagio: 124,
    ganho: 4450,
  },
  {
    id: '3',
    origem: 'São Paulo, SP',
    destino: 'Rio de Janeiro, RJ',
    km: 440,
    valor_frete: 3600,
    tipo_carga: 'Baú',
    peso_kg: 20000,
    custo_diesel: 168,
    custo_pedagio: 102,
    ganho: 3330,
  },
]

export default function CorridasPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [corridas, setCorreidas] = useState<typeof MOCK_CORRIDAS>([])
  const [buscouHoje, setBuscouHoje] = useState(false)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function buscarCorreidas() {
    if (!profile) return
    setBuscando(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Incrementa o contador de usos gratuitos
    await supabase
      .from('users')
      .update({ corridas_usos: (profile.corridas_usos || 0) + 1 })
      .eq('id', user.id)

    // Simula carregamento (quando FreteBras chegar, faz fetch real aqui)
    await new Promise(r => setTimeout(r, 1200))

    setCorreidas(MOCK_CORRIDAS)
    setBuscouHoje(true)
    setProfile(prev => prev ? { ...prev, corridas_usos: (prev.corridas_usos || 0) + 1 } : prev)
    setBuscando(false)
  }

  if (loading) return <div className="empty">Carregando...</div>

  const usos = profile?.corridas_usos || 0
  const isPro = profile?.plano === 'active'
  const atingiuLimite = !isPro && usos >= LIMITE_GRATIS

  return (
    <>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">🎯 Corridas Recomendadas</div>
          <div className="page-sub">As melhores oportunidades perto de você, com lucro calculado</div>
        </div>
        {!isPro && !atingiuLimite && (
          <span className="corridas-badge">
            {LIMITE_GRATIS - usos} busca{LIMITE_GRATIS - usos !== 1 ? 's' : ''} gratuita{LIMITE_GRATIS - usos !== 1 ? 's' : ''} restante{LIMITE_GRATIS - usos !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* PAYWALL — atingiu limite */}
      {atingiuLimite && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 7%, transparent)', textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Você usou seus 5 gratuitos</div>
          <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px' }}>
            Assine o Pro para buscas ilimitadas de corridas com lucro real calculado — diesel, pedágio e tudo.
          </div>
          <button className="btn btn-primary" style={{ fontSize: '15px', padding: '12px 32px' }} onClick={() => router.push('/planos')}>
            Ver planos →
          </button>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '12px' }}>
            Cancele quando quiser. Sem fidelidade.
          </div>
        </div>
      )}

      {/* ESTADO INICIAL — não buscou ainda */}
      {!atingiuLimite && !buscouHoje && !buscando && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Encontre a melhor corrida agora</div>
          <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', margin: '0 auto 28px', lineHeight: '1.6' }}>
            O app usa sua localização para mostrar as 3 corridas com maior lucro líquido disponíveis perto de você.
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '28px' }}>
            {['⛽ Diesel calculado', '🛣️ Pedágio estimado', '📦 Filtra pelo seu caminhão'].map(item => (
              <span key={item} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', padding: '6px 14px', fontSize: '13px' }}>{item}</span>
            ))}
          </div>
          <button className="btn btn-primary" style={{ fontSize: '15px', padding: '12px 32px' }} onClick={buscarCorreidas}>
            🔍 Buscar corridas agora
          </button>
          {!isPro && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
              {usos === 0 ? `${LIMITE_GRATIS} buscas gratuitas disponíveis` : `${LIMITE_GRATIS - usos} de ${LIMITE_GRATIS} buscas gratuitas restantes`}
            </div>
          )}
        </div>
      )}

      {/* CARREGANDO */}
      {buscando && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>🔄</div>
          <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Buscando as melhores corridas perto de você...</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* RESULTADOS */}
      {buscouHoje && !buscando && corridas.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {corridas.map((c, i) => (
              <div key={c.id} className="corridas-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {i === 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--yellow)', marginBottom: '4px', display: 'block' }}>⭐ MELHOR OPÇÃO</span>}
                    <div className="corridas-rota">{c.origem} → {c.destino}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{c.km.toLocaleString('pt-BR')} km · {c.tipo_carga} · {(c.peso_kg / 1000).toFixed(0)}t</div>
                  </div>
                  <div className="corridas-ganho">{fmtBRL(c.ganho)}</div>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div className="corridas-detail">
                  <span>💰 Frete: <strong style={{ color: 'var(--text)' }}>{fmtBRL(c.valor_frete)}</strong></span>
                  <span>⛽ Diesel: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(c.custo_diesel)}</strong></span>
                  <span>🛣️ Pedágio: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(c.custo_pedagio)}</strong></span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => window.open('https://fretebras.com.br', '_blank')}
                >
                  Ver no FreteBras →
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {isPro ? 'Buscas ilimitadas ativas' : `${LIMITE_GRATIS - usos} busca${LIMITE_GRATIS - usos !== 1 ? 's' : ''} gratuita${LIMITE_GRATIS - usos !== 1 ? 's' : ''} restante${LIMITE_GRATIS - usos !== 1 ? 's' : ''}`}
            </div>
            {!atingiuLimite && (
              <button className="btn btn-ghost btn-sm" onClick={buscarCorreidas} disabled={buscando}>
                🔄 Atualizar
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: '10px', fontSize: '12px', color: 'var(--muted)' }}>
            ⚠️ Dados de exemplo — integração com FreteBras em breve. Os cálculos de diesel e pedágio são reais com base no seu perfil.
          </div>
        </>
      )}
    </>
  )
}

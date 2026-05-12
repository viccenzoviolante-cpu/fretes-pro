'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'

const PRIZES = [
  { label: 'Tente novamente', emoji: '🎲', color: '#64748b' },
  { label: '+1 busca',        emoji: '🔍', color: '#3b82f6' },
  { label: '+2 roletas',      emoji: '🔄', color: '#8b5cf6' },
  { label: '+3 buscas',       emoji: '🔍🔍',color: '#10b981' },
  { label: '+5 buscas',       emoji: '🚀', color: '#f59e0b' },
  { label: '+10 buscas',      emoji: '⭐', color: '#eab308' },
]

const SEG = 360 / PRIZES.length // 60°

export default function RoletaPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<typeof PRIZES[0] | null>(null)
  const [rotation, setRotation] = useState(0)
  const [erro, setErro] = useState('')
  const [showOrderBump, setShowOrderBump] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function girar() {
    if (spinning) return
    if ((profile?.roleta_saldo || 0) <= 0) { setShowOrderBump(true); return }

    setSpinning(true)
    setResult(null)
    setErro('')

    try {
      const res = await fetch('/api/roleta/girar', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) { setErro(data.error || 'Erro ao girar'); setSpinning(false); return }

      const { prizeIndex, novoSaldo } = data
      // Girar 5 voltas completas + aterrissar no segmento premiado
      const offset = Math.random() * 20 - 10 // pequena variação dentro do segmento
      const targetAngle = 1800 + (prizeIndex * SEG + SEG / 2 + offset)
      setRotation(prev => prev + targetAngle)

      setTimeout(() => {
        setResult(PRIZES[prizeIndex])
        setSpinning(false)
        setProfile(prev => prev ? { ...prev, roleta_saldo: novoSaldo } : prev)
        fetchProfile()
      }, 3500)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
      setSpinning(false)
    }
  }

  if (loading) return <div className="empty">Carregando...</div>

  const saldo = profile?.roleta_saldo || 0
  const bonus = profile?.fretes_bonus || 0

  // Gera o conic-gradient da roda
  const conicParts = PRIZES.map((p, i) => {
    const start = i * SEG
    const end = start + SEG
    return `${p.color} ${start}deg ${end}deg`
  }).join(', ')

  return (
    <>
      <div className="page-header" style={{ textAlign: 'center' }}>
        <div className="page-title">🎰 Roleta de Buscas</div>
        <div className="page-sub">Gire para ganhar buscas extras no FreteBras</div>
      </div>

      {/* Saldo */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '28px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '14px 24px', flex: 1, maxWidth: '160px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{saldo}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>roleta{saldo !== 1 ? 's' : ''} disponíve{saldo !== 1 ? 'is' : 'l'}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '14px 24px', flex: 1, maxWidth: '160px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{bonus}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>busca{bonus !== 1 ? 's' : ''} extra{bonus !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Roda */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>

        {/* Ponteiro */}
        <div style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '24px solid var(--text)', zIndex: 10, marginBottom: '-12px' }} />

        {/* Wheel container */}
        <div style={{ position: 'relative', width: '260px', height: '260px' }}>
          <div
            ref={wheelRef}
            style={{
              width: '260px', height: '260px', borderRadius: '50%',
              background: `conic-gradient(${conicParts})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3.4s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none',
              boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
              border: '4px solid var(--border)',
            }}
          />

          {/* Labels nas fatias */}
          {PRIZES.map((p, i) => {
            const angle = i * SEG + SEG / 2
            const rad = (angle - 90) * Math.PI / 180
            const r = 88
            const x = 130 + r * Math.cos(rad)
            const y = 130 + r * Math.sin(rad)
            return (
              <div key={p.label} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', fontSize: '18px', pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                {p.emoji}
              </div>
            )
          })}

          {/* Centro */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg)', border: '4px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', zIndex: 5 }}>
            🚛
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="card" style={{ textAlign: 'center', marginBottom: '20px', borderColor: result.color, background: `color-mix(in srgb, ${result.color} 10%, transparent)`, padding: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>{result.emoji}</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>{result.label}</div>
          {result.label === 'Tente novamente' ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Não foi dessa vez. Gire de novo!</div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Creditado na sua conta agora mesmo.</div>
          )}
        </div>
      )}

      {erro && <div className="alert-error" style={{ marginBottom: '16px' }}>{erro}</div>}

      {/* Botão girar */}
      <button
        className="btn btn-primary btn-full"
        style={{ fontSize: '16px', padding: '14px', marginBottom: '16px' }}
        onClick={girar}
        disabled={spinning}
      >
        {spinning ? '🌀 Girando...' : saldo > 0 ? `🎰 Girar (${saldo} disponíve${saldo !== 1 ? 'is' : 'l'})` : '🔒 Sem roletas — comprar mais'}
      </button>

      {/* Legenda de prêmios */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Prêmios possíveis</div>
        {PRIZES.map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ fontSize: '18px' }}>{p.emoji}</span>
            <span style={{ flex: 1 }}>{p.label}</span>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* Order bump */}
      <div className="card" style={{ textAlign: 'center', borderColor: 'var(--primary)', padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>🛒 Comprar mais roletas</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>Cada roleta pode render buscas extras no FreteBras</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            className="btn btn-ghost"
            style={{ flexDirection: 'column', padding: '14px 10px', height: 'auto' }}
            onClick={() => alert('Integração PagHiper em breve.')}
          >
            <span style={{ fontSize: '20px', fontWeight: 800 }}>10</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>roletas</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>R$19,90</span>
          </button>
          <button
            className="btn btn-primary"
            style={{ flexDirection: 'column', padding: '14px 10px', height: 'auto', position: 'relative' }}
            onClick={() => alert('Integração PagHiper em breve.')}
          >
            <span style={{ position: 'absolute', top: '-8px', right: '8px', background: 'var(--yellow)', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '99px' }}>POPULAR</span>
            <span style={{ fontSize: '20px', fontWeight: 800 }}>20</span>
            <span style={{ fontSize: '11px', opacity: 0.8 }}>roletas</span>
            <span style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>R$29,90</span>
          </button>
        </div>
      </div>

      {/* Modal sem saldo */}
      {showOrderBump && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }} onClick={() => setShowOrderBump(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px', zIndex: 51 }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎰</div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Sem roletas disponíveis</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Compre um pacote para continuar girando e ganhando buscas extras.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <button className="btn btn-ghost" style={{ flexDirection: 'column', padding: '14px', height: 'auto' }} onClick={() => alert('Em breve.')}>
                <span style={{ fontSize: '18px', fontWeight: 800 }}>10 roletas</span>
                <span style={{ fontSize: '15px', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>R$19,90</span>
              </button>
              <button className="btn btn-primary" style={{ flexDirection: 'column', padding: '14px', height: 'auto' }} onClick={() => alert('Em breve.')}>
                <span style={{ fontSize: '18px', fontWeight: 800 }}>20 roletas</span>
                <span style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>R$29,90</span>
              </button>
            </div>
            <button className="btn btn-ghost btn-full" onClick={() => setShowOrderBump(false)}>Agora não</button>
          </div>
        </>
      )}
    </>
  )
}

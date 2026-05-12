'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'

const PRIZES = [
  { label: 'Tente novamente', short: 'Ops!',      tipo: 'nada',   valor: 0,  color: '#475569', text: '#fff' },
  { label: '+1 busca',        short: '+1 Busca',  tipo: 'busca',  valor: 1,  color: '#3b82f6', text: '#fff' },
  { label: '+2 roletas',      short: '+2 Giros',  tipo: 'roleta', valor: 2,  color: '#8b5cf6', text: '#fff' },
  { label: '+3 buscas',       short: '+3 Buscas', tipo: 'busca',  valor: 3,  color: '#10b981', text: '#fff' },
  { label: '+5 buscas',       short: '+5 Buscas', tipo: 'busca',  valor: 5,  color: '#f59e0b', text: '#fff' },
  { label: '+10 buscas',      short: '+10 🔥',    tipo: 'busca',  valor: 10, color: '#ef4444', text: '#fff' },
]

const SEG = 360 / PRIZES.length
const CX = 150, CY = 150, R = 130, R_TEXT = 88

function polar(angleDeg: number, r = R) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function segPath(i: number) {
  const a1 = i * SEG, a2 = a1 + SEG
  const s = polar(a1), e = polar(a2)
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

export default function RoletaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<typeof PRIZES[0] | null>(null)
  const [erro, setErro] = useState('')

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
  }, [])

  useEffect(() => { if (open) { fetchProfile(); setResult(null); setErro('') } }, [open, fetchProfile])

  async function girar() {
    if (spinning || !profile) return
    if ((profile.roleta_saldo || 0) <= 0) return

    setSpinning(true)
    setResult(null)
    setErro('')

    try {
      const res = await fetch('/api/roleta/girar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao girar'); setSpinning(false); return }

      const { prizeIndex, novoSaldo } = data

      // Ângulo atual do wheel (mod 360)
      const currentMod = rotation % 360
      // Ângulo final desejado: centro da fatia premiada deve ficar no topo
      // Quando wheel girou R°, a fatia no topo é a que estava em (360 - R) % 360
      // Para mostrar fatia i no topo: R final = (360 - (i * SEG + SEG/2)) % 360
      const desiredFinal = (360 - (prizeIndex * SEG + SEG / 2) + 3600) % 360
      const adjustment = (desiredFinal - currentMod + 360) % 360
      // Pequena variação dentro da fatia (±20°) para parecer natural
      const offset = (Math.random() - 0.5) * (SEG * 0.6)
      const target = 1800 + adjustment + offset

      setRotation(prev => prev + target)

      setTimeout(() => {
        setResult(PRIZES[prizeIndex])
        setSpinning(false)
        setProfile(prev => prev ? { ...prev, roleta_saldo: novoSaldo } : prev)
        fetchProfile()
      }, 3600)
    } catch {
      setErro('Erro de conexão.')
      setSpinning(false)
    }
  }

  if (!open) return null

  const saldo = profile?.roleta_saldo || 0
  const bonus = profile?.fretes_bonus || 0

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, backdropFilter: 'blur(2px)' }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px', maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '99px', margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>🎰 Roleta de Buscas</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Gire para ganhar buscas extras no FreteBras</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Saldo pills */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{saldo}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>giro{saldo !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{bonus}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>busca{bonus !== 1 ? 's' : ''} extra{bonus !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Roda SVG */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          {/* Ponteiro */}
          <div style={{ width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '22px solid var(--text)', marginBottom: '-11px', zIndex: 5, position: 'relative' }} />

          <div style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.17,0.67,0.08,1)' : 'none',
            borderRadius: '50%',
            boxShadow: '0 6px 32px rgba(0,0,0,0.35)',
            border: '5px solid var(--border)',
          }}>
            <svg width="300" height="300" viewBox="0 0 300 300">
              {PRIZES.map((p, i) => {
                const midAngle = i * SEG + SEG / 2
                const tp = polar(midAngle, R_TEXT)
                const rot = midAngle
                return (
                  <g key={i}>
                    <path d={segPath(i)} fill={p.color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <text
                      x={tp.x} y={tp.y}
                      fill={p.text}
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${rot}, ${tp.x}, ${tp.y})`}
                    >
                      {p.short}
                    </text>
                  </g>
                )
              })}
              {/* Centro */}
              <circle cx={CX} cy={CY} r="24" fill="var(--bg)" stroke="var(--border)" strokeWidth="3" />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="16">🚛</text>
            </svg>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div style={{
            background: `color-mix(in srgb, ${result.color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${result.color} 40%, transparent)`,
            borderRadius: '12px', padding: '14px', textAlign: 'center', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: result.color }}>{result.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              {result.tipo === 'nada' ? 'Não foi dessa vez. Tente de novo!' : 'Creditado agora mesmo ✓'}
            </div>
          </div>
        )}

        {erro && <div className="alert-error" style={{ marginBottom: '12px' }}>{erro}</div>}

        {/* Botão girar */}
        <button
          className="btn btn-primary btn-full"
          style={{ fontSize: '15px', padding: '13px', marginBottom: '14px' }}
          onClick={girar}
          disabled={spinning || saldo <= 0}
        >
          {spinning ? '🌀 Girando...' : saldo > 0 ? `Girar — ${saldo} disponíve${saldo !== 1 ? 'is' : 'l'}` : 'Sem giros — comprar'}
        </button>

        {/* Order bump */}
        <button
          onClick={() => alert('Integração PagHiper em breve.')}
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>🛒 30 giros por R$30,00</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Cada giro pode render buscas extras no FreteBras</div>
          </div>
          <span style={{ fontSize: '20px', color: 'var(--primary)' }}>→</span>
        </button>
      </div>
    </>
  )
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'
import { PROBS_STARTER, PROBS_PRO } from '@/app/api/roleta/girar/route'

const PRIZES = [
  { id: 'jackpot', label: '+30 buscas', short: '+30',  emoji: '🔥', tipo: 'busca',  valor: 30, color: '#F59E0B', glow: '#FCD34D' },
  { id: 'grande',  label: '+10 buscas', short: '+10',  emoji: '⭐', tipo: 'busca',  valor: 10, color: '#8B5CF6', glow: '#C4B5FD' },
  { id: 'bom',     label: '+5 buscas',  short: '+5',   emoji: '🚀', tipo: 'busca',  valor: 5,  color: '#10B981', glow: '#6EE7B7' },
  { id: 'normal',  label: '+3 buscas',  short: '+3',   emoji: '🔍', tipo: 'busca',  valor: 3,  color: '#3B82F6', glow: '#93C5FD' },
  { id: 'roleta3', label: '+3 roletas', short: '+3🎡', emoji: '🎡', tipo: 'roleta', valor: 3,  color: '#EC4899', glow: '#F9A8D4' },
  { id: 'pequeno', label: '+1 busca',   short: '+1',   emoji: '👆', tipo: 'busca',  valor: 1,  color: '#F97316', glow: '#FED7AA' },
  { id: 'mini',    label: '+2 roletas', short: '+2🎲', emoji: '🎲', tipo: 'roleta', valor: 2,  color: '#06B6D4', glow: '#A5F3FC' },
]

const N = PRIZES.length
const SEG = 360 / N
const CX = 150, CY = 150, R = 128, R_TEXT = 82, R_EMOJI = 104

function polar(angleDeg: number, r = R) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function segPath(i: number) {
  const a1 = i * SEG, a2 = a1 + SEG
  const s = polar(a1), e = polar(a2)
  const large = SEG > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

export default function RoletaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<typeof PRIZES[0] | null>(null)
  const [nearMiss, setNearMiss] = useState(false)
  const [erro, setErro] = useState('')

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
  }, [])

  useEffect(() => { if (open) { fetchProfile(); setResult(null); setErro(''); setNearMiss(false) } }, [open, fetchProfile])

  async function girar() {
    if (spinning || !profile || (profile.roleta_saldo || 0) <= 0) return

    setSpinning(true)
    setResult(null)
    setErro('')
    setNearMiss(false)

    try {
      const res = await fetch('/api/roleta/girar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao girar'); setSpinning(false); return }

      const { prizeIndex, novoSaldo } = data
      const currentMod = rotation % 360

      // Near-miss: prêmios comuns às vezes param visualmente perto do jackpot
      const isCommon = prizeIndex >= 5
      const doNearMiss = isCommon && Math.random() < 0.28

      let target: number
      if (doNearMiss) {
        setNearMiss(true)
        // Para justo depois do jackpot (segmento 0) — "quase!"
        const nearAngle = (360 - (0 * SEG + SEG * 0.1) + 3600) % 360
        const adj = (nearAngle - currentMod + 360) % 360
        target = 1800 + adj
      } else {
        const desiredFinal = (360 - (prizeIndex * SEG + SEG / 2) + 3600) % 360
        const adjustment = (desiredFinal - currentMod + 360) % 360
        const offset = (Math.random() - 0.5) * (SEG * 0.55)
        target = 1800 + adjustment + offset
      }

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
  const isPro = profile?.plano === 'active'
  const probs = isPro ? PROBS_PRO : PROBS_STARTER

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 200, backdropFilter: 'blur(3px)' }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px', maxHeight: '94vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '99px', margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>🎰 Roleta de Buscas</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Gire para ganhar buscas e giros extras</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Saldo pills */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <div style={{ flex: 1, background: 'color-mix(in srgb, #8B5CF6 12%, transparent)', border: '1px solid color-mix(in srgb, #8B5CF6 30%, transparent)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#8B5CF6' }}>{saldo}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>giro{saldo !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, background: 'color-mix(in srgb, #3B82F6 12%, transparent)', border: '1px solid color-mix(in srgb, #3B82F6 30%, transparent)', borderRadius: '12px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#3B82F6' }}>{bonus}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>busca{bonus !== 1 ? 's' : ''} extra{bonus !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Roda */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          {/* Ponteiro */}
          <div style={{ width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '22px solid var(--text)', marginBottom: '-11px', zIndex: 5, position: 'relative', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />

          <div style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.17,0.67,0.06,1)' : 'none',
            borderRadius: '50%',
            boxShadow: '0 8px 40px rgba(0,0,0,0.45), 0 0 0 6px var(--surface), 0 0 0 8px var(--border)',
          }}>
            <svg width="300" height="300" viewBox="0 0 300 300">
              <defs>
                {PRIZES.map((p, i) => (
                  <radialGradient key={`g${i}`} id={`grad${i}`} cx="30%" cy="30%" r="80%">
                    <stop offset="0%" stopColor={p.glow} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={p.color} stopOpacity="1" />
                  </radialGradient>
                ))}
              </defs>

              {PRIZES.map((p, i) => {
                const midAngle = i * SEG + SEG / 2
                const tp = polar(midAngle, R_TEXT)
                const te = polar(midAngle, R_EMOJI)
                return (
                  <g key={i}>
                    <path d={segPath(i)} fill={`url(#grad${i})`} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                    {/* Emoji */}
                    <text x={te.x} y={te.y} textAnchor="middle" dominantBaseline="middle" fontSize="14"
                      transform={`rotate(${midAngle}, ${te.x}, ${te.y})`}>{p.emoji}</text>
                    {/* Label */}
                    <text x={tp.x} y={tp.y} fill="#fff" fontSize="10" fontWeight="800"
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${midAngle}, ${tp.x}, ${tp.y})`}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                      {p.short}
                    </text>
                  </g>
                )
              })}

              {/* Aro externo decorativo */}
              <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />

              {/* Bolinhas no aro */}
              {Array.from({ length: N * 2 }).map((_, i) => {
                const a = (i * 360) / (N * 2)
                const p = polar(a, R + 3)
                return <circle key={`dot${i}`} cx={p.x} cy={p.y} r="2.5" fill="rgba(255,255,255,0.5)" />
              })}

              {/* Hub central */}
              <circle cx={CX} cy={CY} r="28" fill="var(--bg)" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
              <circle cx={CX} cy={CY} r="22" fill="var(--surface)" />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="18">🚛</text>
            </svg>
          </div>
        </div>

        {/* Resultado */}
        {result && (
          <div style={{
            background: `color-mix(in srgb, ${result.color} 15%, transparent)`,
            border: `2px solid color-mix(in srgb, ${result.color} 50%, transparent)`,
            borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '14px',
            animation: 'popIn 0.3s ease',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '4px' }}>{result.emoji}</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: result.color }}>{result.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              {result.tipo === 'roleta' ? 'Giros adicionados ao seu saldo ✓' : 'Buscas extras creditadas agora ✓'}
            </div>
          </div>
        )}

        {nearMiss && !result && spinning && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#F59E0B', fontWeight: 700, marginBottom: '8px', animation: 'pulse 0.5s ease' }}>
            🔥 Quase o jackpot!
          </div>
        )}

        {erro && <div className="alert-error" style={{ marginBottom: '12px' }}>{erro}</div>}

        {/* Botão girar */}
        <button
          className="btn btn-primary btn-full"
          style={{ fontSize: '15px', padding: '14px', marginBottom: '14px', fontWeight: 800 }}
          onClick={girar}
          disabled={spinning || saldo <= 0}
        >
          {spinning ? '🌀 Girando...' : saldo > 0 ? `🎰 Girar — ${saldo} disponíve${saldo !== 1 ? 'is' : 'l'}` : 'Sem giros disponíveis'}
        </button>

        {/* Tabela de chances */}
        <div style={{ background: 'var(--surface2)', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Suas chances {isPro ? '(Pro)' : '(Starter)'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PRIZES.map((p, i) => {
              const pct = probs[i]
              const isJackpot = i === 0
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  background: isJackpot ? `color-mix(in srgb, ${p.color} 12%, transparent)` : 'transparent',
                  border: isJackpot ? `1px solid color-mix(in srgb, ${p.color} 35%, transparent)` : '1px solid transparent',
                  borderRadius: '8px', padding: '5px 7px',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', flex: 1, fontWeight: isJackpot ? 700 : 400 }}>{p.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isJackpot ? p.color : 'var(--muted)' }}>{pct}%</span>
                </div>
              )
            })}
          </div>
          {!isPro && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
              No Pro: chances maiores em todos os prêmios →{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}>Ver planos</span>
            </div>
          )}
        </div>

        {/* Order bump */}
        <div style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, #F59E0B 12%, var(--surface2)), color-mix(in srgb, #8B5CF6 12%, var(--surface2)))',
          border: '1px solid color-mix(in srgb, #F59E0B 30%, transparent)',
          borderRadius: '14px', padding: '16px', cursor: 'pointer',
          display: 'flex', gap: '14px', alignItems: 'center',
        }}
          onClick={() => alert('Asaas em breve.')}
        >
          {/* Mini visual da roleta */}
          <div style={{ flexShrink: 0, width: '52px', height: '52px', borderRadius: '50%', background: 'conic-gradient(#F59E0B 0% 14%, #8B5CF6 14% 28%, #10B981 28% 43%, #3B82F6 43% 57%, #EC4899 57% 72%, #F97316 72% 86%, #06B6D4 86% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(0,0,0,0.3)' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>🚛</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 800 }}>🛒 30 giros — <span style={{ color: '#F59E0B' }}>R$30,00</span></div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>R$1 por giro · chance de ganhar +30 buscas 🔥</div>
          </div>
          <span style={{ fontSize: '20px', color: 'var(--primary)', flexShrink: 0 }}>→</span>
        </div>

        <style>{`
          @keyframes popIn { from { transform: scale(0.85); opacity: 0 } to { transform: scale(1); opacity: 1 } }
          @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
        `}</style>
      </div>
    </>
  )
}

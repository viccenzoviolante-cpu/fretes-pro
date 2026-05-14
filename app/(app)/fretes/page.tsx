'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmtBRL, fmtDate } from '@/lib/utils'
import type { UserRow, FreteSalvoRow } from '@/types/database'
import type { FreteNorm } from '@/app/api/fretes/buscar/route'

const LIMITE_PRO_DIA = 10
const LIMITE_FREE_MES = 5

const PLATAFORMA_CONFIG: Record<string, { label: string; url: string; cor: string }> = {
  fretebras:   { label: 'FreteBras',   url: 'https://www.fretebras.com.br',   cor: '#f59e0b' },
  fretecarga:  { label: 'FreteCarga',  url: 'https://www.fretecarga.com.br',  cor: '#3b82f6' },
  fretebarato: { label: 'FreteBarato', url: 'https://www.fretebarato.com.br', cor: '#10b981' },
}

type Frete = FreteNorm & { pedagio_real?: boolean }

export default function FretesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [fretes, setFretes] = useState<Frete[]>([])
  const [salvos, setSalvos] = useState<FreteSalvoRow[]>([])
  const [aba, setAba] = useState<'buscar' | 'salvos'>('buscar')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [buscouAgora, setBuscouAgora] = useState(false)
  const [isMock, setIsMock] = useState(true)

  // Overlay da plataforma
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
  const [overlayLabel, setOverlayLabel] = useState('')
  const snoozeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal "viagem iniciada?"
  const [showViagemModal, setShowViagemModal] = useState(false)

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

  useEffect(() => {
    fetchData()
    const onFocus = () => fetchData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchData])

  function verificarLimite() {
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
      return { pode: false, motivo: 'Limite diário atingido. Gire a roleta para ganhar buscas extras!', restantes: 0, usandoBonus: false }
    } else {
      const mesAtual = new Date().toISOString().slice(0, 7)
      const mesmoMes = profile.fretes_mes_inicio?.slice(0, 7) === mesAtual
      const usados = mesmoMes ? (profile.fretes_mes_contagem || 0) : 0
      const restantes = LIMITE_FREE_MES - usados
      if (restantes > 0) return { pode: true, restantes, usandoBonus: false }
      if (bonus > 0) return { pode: true, restantes: bonus, usandoBonus: true }
      return { pode: false, motivo: 'Limite mensal atingido. Gire a roleta para ganhar buscas extras!', restantes: 0, usandoBonus: false }
    }
  }

  async function buscarFretes() {
    const limite = verificarLimite()
    if (!limite.pode) { alert(limite.motivo); return }

    setBuscando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    const isPro = profile.plano === 'active'
    const hoje = new Date().toISOString().slice(0, 10)

    if (limite.usandoBonus) {
      const novoBonus = Math.max(0, (profile.fretes_bonus || 0) - 1)
      await supabase.from('users').update({ fretes_bonus: novoBonus }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, fretes_bonus: novoBonus } : prev)
    } else if (isPro) {
      const mesmodia = profile.fretes_dia_data === hoje
      const novoCount = mesmodia ? (profile.fretes_dia_contagem || 0) + 1 : 1
      await supabase.from('users').update({ fretes_dia_contagem: novoCount, fretes_dia_data: hoje }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, fretes_dia_contagem: novoCount, fretes_dia_data: hoje } : prev)
    } else {
      const mesmoMes = profile.fretes_mes_inicio?.slice(0, 7) === hoje.slice(0, 7)
      const novoCount = mesmoMes ? (profile.fretes_mes_contagem || 0) + 1 : 1
      await supabase.from('users').update({ fretes_mes_contagem: novoCount, fretes_mes_inicio: hoje }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, fretes_mes_contagem: novoCount, fretes_mes_inicio: hoje } : prev)
    }

    // Busca fretes das plataformas
    const apiRes = await fetch('/api/fretes/buscar')
    const { fretes: rawFretes, sources } = await apiRes.json()
    setIsMock(sources.mock)

    // Enriquece com pedágio real via QualP
    const fretesComPedagio = await Promise.all(
      (rawFretes as Frete[]).map(async (f) => {
        try {
          const res = await fetch('/api/qualp/rota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origem: f.origem, destino: f.destino }),
          })
          if (!res.ok) return { ...f, pedagio_real: false }
          const data = await res.json()
          const pedagio = data.pedagio_total
          if (!pedagio || pedagio === 0) return { ...f, pedagio_real: false }
          return {
            ...f,
            custo_pedagio_est: pedagio,
            ganho_est: f.valor_frete - f.custo_diesel_est - pedagio,
            pedagio_real: true,
          }
        } catch {
          return { ...f, pedagio_real: false }
        }
      })
    )

    setFretes(fretesComPedagio)
    setBuscouAgora(true)
    setBuscando(false)
  }

  async function salvarFrete(f: Frete) {
    setSalvando(f.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('fretes_salvos').upsert({
      user_id: user.id, plataforma: f.plataforma, frete_id: f.id,
      origem: f.origem, destino: f.destino, km: f.km,
      valor_frete: f.valor_frete, tipo_carga: f.tipo_carga, peso_kg: f.peso_kg,
      custo_diesel_est: f.custo_diesel_est, custo_pedagio_est: f.custo_pedagio_est,
      ganho_est: f.ganho_est, dados_raw: f as Record<string, unknown>,
    }, { onConflict: 'user_id,plataforma,frete_id' })
    if (!error) await fetchData()
    setSalvando(null)
  }

  async function removerSalvo(id: string) {
    const supabase = createClient()
    await supabase.from('fretes_salvos').delete().eq('id', id)
    setSalvos(prev => prev.filter(s => s.id !== id))
  }

  function abrirPlataforma(plataforma: string) {
    const cfg = PLATAFORMA_CONFIG[plataforma] ?? PLATAFORMA_CONFIG.fretebras
    setOverlayLabel(cfg.label)
    setOverlayUrl(cfg.url)
  }

  function fecharOverlay() {
    setOverlayUrl(null)
    if (snoozeRef.current) clearTimeout(snoozeRef.current)
    setShowViagemModal(true)
  }

  function snoozeViagem() {
    setShowViagemModal(false)
    snoozeRef.current = setTimeout(() => setShowViagemModal(true), 5 * 60 * 1000)
  }

  if (loading) return <div className="empty">Carregando...</div>

  const limite = verificarLimite()
  const isPro = profile?.plano === 'active'
  const bonus = profile?.fretes_bonus || 0
  const idsSalvos = new Set(salvos.map(s => `${s.plataforma}:${s.frete_id}`))
  const buscasRestantes = isPro
    ? LIMITE_PRO_DIA - (profile?.fretes_dia_data === new Date().toISOString().slice(0, 10) ? (profile?.fretes_dia_contagem || 0) : 0)
    : LIMITE_FREE_MES - (profile?.fretes_mes_inicio?.slice(0, 7) === new Date().toISOString().slice(0, 7) ? (profile?.fretes_mes_contagem || 0) : 0)

  const fontes = [...new Set(fretes.map(f => PLATAFORMA_CONFIG[f.plataforma]?.label ?? f.plataforma))].join(' · ')

  return (
    <>
      {/* Overlay da plataforma */}
      {overlayUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#000' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>🔗 {overlayLabel}</span>
            <button
              onClick={fecharOverlay}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
            >
              ← Retornar ao FretesPro ✕
            </button>
          </div>
          <iframe
            src={overlayUrl}
            style={{ flex: 1, border: 'none', width: '100%' }}
            allow="storage-access"
            title={overlayLabel}
          />
        </div>
      )}

      {/* Modal "viagem iniciada?" */}
      {showViagemModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ maxWidth: '360px', width: '100%', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚛</div>
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '8px' }}>A viagem foi iniciada?</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              Você saiu de {overlayLabel || 'da plataforma'}. Quer registrar uma nova viagem agora?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => { setShowViagemModal(false); router.push('/viagens?nova=1') }}>
                ✅ Sim, iniciar viagem
              </button>
              <button className="btn btn-ghost" onClick={() => setShowViagemModal(false)}>
                Não, ainda não
              </button>
              <button
                onClick={snoozeViagem}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', padding: '4px' }}
              >
                ⏰ Me pergunte em 5 minutos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <div className="page-title">🔍 Melhores Fretes</div>
          <div className="page-sub">{buscouAgora && !isMock ? fontes : 'FreteCarga · FreteBarato · FreteBras'} · filtrado pelo seu caminhão</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
            {isPro ? `${Math.max(0, buscasRestantes)} buscas hoje` : `${Math.max(0, buscasRestantes)} este mês`}
          </span>
          {bonus > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--purple, #8b5cf6)', background: 'color-mix(in srgb, #8b5cf6 12%, transparent)', border: '1px solid color-mix(in srgb, #8b5cf6 30%, transparent)', padding: '3px 8px', borderRadius: '99px', whiteSpace: 'nowrap', fontWeight: 600 }}>
              🎰 +{bonus} da roleta
            </span>
          )}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
        {(['buscar', 'salvos'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, background: aba === a ? 'var(--primary)' : 'transparent', color: aba === a ? '#fff' : 'var(--muted)', transition: 'all .15s' }}>
            {a === 'buscar' ? '🔍 Buscar fretes' : `🔖 Salvos (${salvos.length})`}
          </button>
        ))}
      </div>

      {/* ABA BUSCAR */}
      {aba === 'buscar' && (
        <>
          {!limite.pode && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 7%, transparent)', textAlign: 'center', padding: '40px 24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Limite atingido</div>
              <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', margin: '0 auto 20px', lineHeight: '1.6' }}>{limite.motivo}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => router.push('/roleta')}>🎰 Girar a Roleta</button>
                {!isPro && <button className="btn btn-ghost" onClick={() => router.push('/planos')}>Ver planos →</button>}
              </div>
            </div>
          )}

          {limite.pode && !buscouAgora && !buscando && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Encontre o melhor frete agora</div>
              <div style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '340px', margin: '0 auto 28px', lineHeight: '1.6' }}>
                Busca nas 3 plataformas simultaneamente — filtrada pelo seu caminhão, capacidade e raio de {profile?.raio_km_max || 200}km.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '28px' }}>
                {['⛽ Diesel calculado', '🛣️ Pedágio real (QualP)', '📦 Filtrado pelo caminhão'].map(t => (
                  <span key={t} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '99px', padding: '6px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}>{t}</span>
                ))}
              </div>
              {limite.usandoBonus && (
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 600, marginBottom: '12px' }}>
                  🎰 Usando busca da roleta ({bonus} disponíve{bonus !== 1 ? 'is' : 'l'})
                </div>
              )}
              <button className="btn btn-primary" style={{ fontSize: '15px', padding: '12px 32px' }} onClick={buscarFretes}>
                🔍 Buscar fretes
              </button>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
                {isPro ? `${LIMITE_PRO_DIA} buscas por dia` : `${Math.max(0, buscasRestantes)} de ${LIMITE_FREE_MES} buscas este mês`}
                {bonus > 0 && ` · +${bonus} da 🎰`}
              </div>
            </div>
          )}

          {buscando && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔄</div>
              <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Consultando FreteCarga, FreteBarato e FreteBras...</div>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {buscouAgora && !buscando && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {fretes.map((f, i) => {
                  const jaSalvo = idsSalvos.has(`${f.plataforma}:${f.id}`)
                  const plat = PLATAFORMA_CONFIG[f.plataforma] ?? PLATAFORMA_CONFIG.fretebras
                  return (
                    <div key={f.id} className="corridas-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                            {i === 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--yellow)' }}>⭐ MELHOR GANHO</span>}
                            <span style={{ fontSize: '10px', fontWeight: 700, color: plat.cor, background: `${plat.cor}18`, border: `1px solid ${plat.cor}44`, borderRadius: '99px', padding: '2px 7px' }}>{plat.label}</span>
                          </div>
                          <div className="corridas-rota" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.origem}</div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>→ {f.destino}</div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{f.km > 0 ? `${f.km.toLocaleString('pt-BR')} km · ` : ''}{f.tipo_carga} · {((f.peso_kg || 0) / 1000).toFixed(0)}t</div>
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
                        <span>🛣️ Pedágio{f.pedagio_real ? <span style={{ color: 'var(--green, #22c55e)', fontSize: '10px', fontWeight: 700, marginLeft: '3px' }}>REAL</span> : ''}: <strong style={{ color: 'var(--red)' }}>−{fmtBRL(f.custo_pedagio_est)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className={`btn btn-sm ${jaSalvo ? 'btn-primary' : 'btn-ghost'}`} onClick={() => !jaSalvo && salvarFrete(f)} disabled={salvando === f.id || jaSalvo} style={{ whiteSpace: 'nowrap' }}>
                          {salvando === f.id ? '...' : jaSalvo ? '🔖 Salvo' : '🔖 Salvar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirPlataforma(f.plataforma)} style={{ whiteSpace: 'nowrap' }}>
                          Ver no {plat.label} →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {isMock ? '⚠️ Dados de exemplo — configure as credenciais das plataformas' : `✅ ${fretes.length} fretes encontrados`}
                </div>
                {limite.pode && <button className="btn btn-ghost btn-sm" onClick={buscarFretes} disabled={buscando}>🔄 Atualizar</button>}
              </div>
            </>
          )}
        </>
      )}

      {/* ABA SALVOS */}
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
              {salvos.map(s => {
                const plat = PLATAFORMA_CONFIG[s.plataforma] ?? PLATAFORMA_CONFIG.fretebras
                return (
                  <div key={s.id} className="corridas-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: plat.cor, background: `${plat.cor}18`, border: `1px solid ${plat.cor}44`, borderRadius: '99px', padding: '2px 7px', display: 'inline-block', marginBottom: '4px' }}>{plat.label}</span>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.origem}</div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>→ {s.destino}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          {s.km ? `${s.km.toLocaleString('pt-BR')} km · ` : ''}{s.tipo_carga || 'Carga geral'}{s.peso_kg ? ` · ${(s.peso_kg / 1000).toFixed(0)}t` : ''}
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirPlataforma(s.plataforma)} style={{ whiteSpace: 'nowrap' }}>Ver →</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => removerSalvo(s.id)} style={{ color: 'var(--red)', whiteSpace: 'nowrap' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}

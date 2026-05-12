'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Periodo = 'mensal' | 'trimestral' | 'anual'

const STARTER = {
  mensal:      { primeira: 67.90, renovacao: 97.00, regular: null },
  trimestral:  { primeira: 227.00, renovacao: 247.00, regular: 291.00 },
  anual:       { primeira: 770.00, renovacao: 970.00, regular: 1164.00 },
}

const PRO = {
  mensal:      { primeira: 97.90, renovacao: 127.00, regular: null },
  trimestral:  { primeira: 287.00, renovacao: 324.00, regular: 381.00 },
  anual:       { primeira: 970.00, renovacao: 1270.00, regular: 1524.00 },
}

const STARTER_FEATURES = [
  'Registro de viagens e despesas',
  'Lucro real por corrida (diesel + pedágio)',
  'GPS e barra de progresso da viagem',
  'Relatórios com ranking de lucratividade',
  'Detalhe de despesas por viagem',
  'Meta financeira mensal',
  'Compartilhar resumo no WhatsApp',
  '5 temas visuais',
  'Melhores Fretes — 5 buscas/mês',
  'Salvar fretes favoritos',
]

const PRO_EXTRAS = [
  'Melhores Fretes — 10 buscas/dia',
  'Caminhões adicionais (R$47,90/mês cada)',
  'Suporte via WhatsApp',
  'Roleta diária Pro (em breve)',
]

export default function PlanosPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('mensal')

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  if (loading) return <div className="empty">Carregando...</div>

  const isPrimeira = profile?.plano === 'trial' || profile?.plano === 'expired'
  const isPago = profile?.plano === 'active'
  const temDesconto = (profile?.desconto_referral || 0) > 0
  const pct = profile?.desconto_referral || 0
  const diasTrial = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0

  function precoStarter() {
    const p = STARTER[periodo]
    const base = isPrimeira ? p.primeira : p.renovacao
    return temDesconto && periodo === 'mensal' ? Math.round(base * (1 - pct / 100) * 100) / 100 : base
  }

  function precoPro() {
    const p = PRO[periodo]
    const base = isPrimeira ? p.primeira : p.renovacao
    return temDesconto && periodo === 'mensal' ? Math.round(base * (1 - pct / 100) * 100) / 100 : base
  }

  function porMes(plano: 'starter' | 'pro') {
    const meses = periodo === 'trimestral' ? 3 : periodo === 'anual' ? 12 : 1
    const preco = plano === 'starter' ? precoStarter() : precoPro()
    return meses > 1 ? `${fmtBRL(preco / meses)}/mês` : ''
  }

  function economiaStarter() {
    const r = STARTER[periodo].regular
    if (!r || periodo === 'mensal') return null
    const pago = precoStarter()
    return fmtBRL(r - pago)
  }

  function economiaPro() {
    const r = PRO[periodo].regular
    if (!r || periodo === 'mensal') return null
    const pago = precoPro()
    return fmtBRL(r - pago)
  }

  function labelPeriodo() {
    if (periodo === 'mensal') return isPrimeira ? '1º mês' : '/mês'
    if (periodo === 'trimestral') return 'a cada 3 meses'
    return 'por ano'
  }

  return (
    <>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div className="page-title">Planos</div>
        <div className="page-sub">
          {isPago ? 'Gerencie sua assinatura' : diasTrial > 0 ? `${diasTrial} dias de trial restantes` : 'Escolha seu plano'}
        </div>
      </div>

      {/* Banner indicação */}
      {temDesconto && !isPago && (
        <div style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>{pct}% de desconto na primeira mensalidade</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Aplicado automaticamente por você ter vindo via indicação.</div>
          </div>
        </div>
      )}

      {/* Seletor de período */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
        {(['mensal', 'trimestral', 'anual'] as Periodo[]).map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: periodo === p ? 'var(--primary)' : 'transparent', color: periodo === p ? '#fff' : 'var(--muted)', transition: 'all .15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
            {p === 'trimestral' && <span style={{ fontSize: '10px', opacity: 0.85 }}>15% off</span>}
            {p === 'anual' && <span style={{ fontSize: '10px', opacity: 0.85 }}>2 meses grátis</span>}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '28px' }}>

        {/* STARTER */}
        <div className="card" style={{ opacity: isPago ? 0.6 : 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>Starter</div>

          {STARTER[periodo].regular && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through', marginBottom: '2px' }}>
              {fmtBRL(STARTER[periodo].regular!)}
            </div>
          )}
          <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1, marginBottom: '2px' }}>{fmtBRL(precoStarter())}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{labelPeriodo()}</div>
          {porMes('starter') && <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, marginBottom: '4px' }}>{porMes('starter')}</div>}
          {economiaStarter() && <div style={{ fontSize: '11px', color: 'var(--green)', marginBottom: '12px' }}>Economia de {economiaStarter()}</div>}

          {!isPago && (
            <button className="btn btn-ghost btn-sm btn-full" onClick={() => alert('Integração PagHiper em breve — fale via WhatsApp.')}>
              Assinar Starter
            </button>
          )}
        </div>

        {/* PRO */}
        <div className="card" style={{ border: '2px solid var(--primary)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-1px', right: '14px', background: 'var(--primary)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '0 0 8px 8px', letterSpacing: '.04em' }}>RECOMENDADO</div>

          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>Pro</div>

          {PRO[periodo].regular && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through', marginBottom: '2px' }}>
              {fmtBRL(PRO[periodo].regular!)}
            </div>
          )}
          <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1, marginBottom: '2px' }}>{fmtBRL(precoPro())}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{labelPeriodo()}</div>
          {porMes('pro') && <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, marginBottom: '4px' }}>{porMes('pro')}</div>}
          {economiaPro() && <div style={{ fontSize: '11px', color: 'var(--green)', marginBottom: '12px' }}>Economia de {economiaPro()}</div>}

          {isPago ? (
            <div style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--green)' }}>
              ✅ Plano ativo
            </div>
          ) : (
            <button className="btn btn-primary btn-sm btn-full" onClick={() => alert('Integração PagHiper em breve — fale via WhatsApp.')}>
              {temDesconto ? `Assinar com ${pct}% off` : 'Assinar Pro'}
            </button>
          )}
        </div>
      </div>

      {/* Tabela de features */}
      <div className="card">
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>O que está incluído</div>

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '8px' }}>Starter + Pro</div>
        {STARTER_FEATURES.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--green)', fontSize: '15px', flexShrink: 0 }}>✓</span>{f}
          </div>
        ))}

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 0 8px' }}>Só no Pro</div>
        {PRO_EXTRAS.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--primary)', fontSize: '15px', flexShrink: 0 }}>⭐</span>{f}
          </div>
        ))}

        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '12px', color: 'var(--muted)' }}>
          Dados preservados por 30 dias após o vencimento. Cancele quando quiser.
        </div>
      </div>

      {/* Indicação */}
      <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>💸 Indique e ganhe 1 mês grátis</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Quando seu amigo assinar, você ganha 1 mês grátis. Ele recebe 10% off.</div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }} onClick={() => router.back()}>← Voltar</button>
      </div>
    </>
  )
}

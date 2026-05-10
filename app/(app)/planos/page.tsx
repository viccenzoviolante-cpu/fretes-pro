'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'

const PRECO_BASE = 77
const PRECO_RECORRENTE = 97
const PRECO_CAMINHAO_EXTRA = 47.90

type Feature = { label: string; trial: boolean | string; pago: boolean | string }

const FEATURES: Feature[] = [
  { label: 'Registro de viagens e despesas', trial: true, pago: true },
  { label: 'Lucro real por corrida (diesel + pedágio)', trial: true, pago: true },
  { label: 'GPS e barra de progresso da viagem', trial: true, pago: true },
  { label: 'Relatórios com ranking de lucratividade', trial: true, pago: true },
  { label: 'Detalhe de despesas por viagem', trial: true, pago: true },
  { label: 'Meta financeira mensal (barra de progresso)', trial: true, pago: true },
  { label: 'Compartilhar resumo mensal no WhatsApp', trial: true, pago: true },
  { label: '5 temas visuais', trial: true, pago: true },
  { label: 'Melhores fretes FreteBras', trial: '5 buscas/mês', pago: '10 buscas/dia' },
  { label: 'Salvar fretes favoritos', trial: true, pago: true },
  { label: 'Dados preservados após expirar', trial: '30 dias', pago: '—' },
  { label: 'Suporte por WhatsApp', trial: false, pago: true },
  { label: 'Caminhões adicionais', trial: false, pago: '+R$47,90/mês cada' },
]

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PlanosPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)

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

  const temDesconto = (profile?.desconto_referral || 0) > 0
  const pct = profile?.desconto_referral || 0
  const precoComDesconto = Math.round(PRECO_BASE * (1 - pct / 100) * 100) / 100
  const isPago = profile?.plano === 'active'
  const diasTrial = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0

  function renderVal(v: boolean | string) {
    if (v === true) return <span style={{ color: 'var(--green)', fontSize: '18px' }}>✓</span>
    if (v === false) return <span style={{ color: 'var(--muted)', fontSize: '18px' }}>—</span>
    return <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{v}</span>
  }

  return (
    <>
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div className="page-title">Planos</div>
        <div className="page-sub">Escolha o que funciona para você</div>
      </div>

      {/* Banner de desconto por indicação */}
      {temDesconto && !isPago && (
        <div style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>Você tem {pct}% de desconto na primeira mensalidade</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Desconto aplicado automaticamente porque você veio por um link de indicação.</div>
          </div>
        </div>
      )}

      {/* Status atual */}
      {!isPago && (
        <div style={{ background: 'color-mix(in srgb, var(--yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--yellow) 25%, transparent)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px' }}>
          <strong>Você está no período de teste</strong> — {diasTrial > 0 ? `${diasTrial} dias restantes.` : 'Seu trial expirou.'} Assine para continuar sem interrupção.
        </div>
      )}

      {/* Cards de plano */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>

        {/* TRIAL / GRATUITO */}
        <div className="card" style={{ position: 'relative', opacity: isPago ? 0.6 : 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px' }}>Trial / Gratuito</div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '4px' }}>R$0</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>14 dias grátis</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px', background: 'var(--surface2)', borderRadius: '8px' }}>
            Após o trial, o acesso é pausado até você assinar.
          </div>
        </div>

        {/* PAGO */}
        <div className="card" style={{ border: '2px solid var(--primary)', position: 'relative' }}>
          {/* Badge recomendado */}
          <div style={{ position: 'absolute', top: '-1px', right: '16px', background: 'var(--primary)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.04em' }}>RECOMENDADO</div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px' }}>Plano Pro</div>

          {/* Preço com ou sem desconto */}
          {temDesconto && !isPago ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)' }}>{fmtBRL(precoComDesconto)}</span>
                <span style={{ background: 'var(--green)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '99px' }}>{pct}% OFF</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'line-through', marginBottom: '2px' }}>{fmtBRL(PRECO_BASE)} no 1º mês</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '16px' }}>→ {fmtBRL(PRECO_RECORRENTE)}/mês a partir do 2º</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '2px' }}>{fmtBRL(PRECO_BASE)}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>no 1º mês · {fmtBRL(PRECO_RECORRENTE)}/mês a partir do 2º</div>
            </div>
          )}

          {isPago ? (
            <div style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '8px', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
              ✅ Plano ativo
            </div>
          ) : (
            <button
              className="btn btn-primary btn-full"
              style={{ fontSize: '14px', padding: '12px' }}
              onClick={() => alert('Integração PagHiper em breve — entre em contato via WhatsApp para assinar.')}
            >
              {temDesconto ? `Assinar com ${pct}% de desconto` : 'Assinar agora'}
            </button>
          )}
        </div>
      </div>

      {/* Tabela comparativa */}
      <div className="card">
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>O que está incluído</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', width: '60%' }}>Funcionalidade</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Trial</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.label} style={{ background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--surface2) 40%, transparent)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{f.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderVal(f.trial)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{renderVal(f.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add-on caminhão */}
        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: '10px', fontSize: '13px' }}>
          <strong>Caminhão adicional:</strong> <span style={{ color: 'var(--muted)' }}>R$47,90/mês por unidade (2º ao 5º) · R$37,90/mês (6º em diante)</span>
        </div>
      </div>

      {/* Link de indicação */}
      <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>💸 Indique e ganhe 1 mês grátis</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Quando seu amigo assinar pelo seu link, você ganha 1 mês de Pro grátis. Ele ainda recebe 10% off.</div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }} onClick={() => router.back()}>← Voltar</button>
      </div>
    </>
  )
}

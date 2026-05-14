'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fmtBRL } from '@/lib/utils'

type Status = {
  disponivel: boolean
  gratis: boolean
  orderbump?: boolean
  dias_restantes?: number
  pct_barra?: number
  cooldown?: number
  count: number
  viagens_finalizadas?: number
  viagens_necessarias?: number
}

type Analise = {
  gerada_em: string
  total_viagens: number
  rota_campeã: { rota: string; lucro_medio: number; margem_media: number; qtd: number } | null
  rota_sangra: { rota: string; lucro_medio: number; margem_media: number; qtd: number } | null
  custo_por_km: number
  melhor_semana: { semana: number; media: number; qtd: number } | null
  corrida_surpresa: { rota: string; valor_frete: number; lucro: number; margem: number } | null
}

const SEMANA_LABEL = ['', '1ª semana', '2ª semana', '3ª semana', '4ª semana']

export default function AnalisePage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/analise/gerar')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function gerarAnalise() {
    setGerando(true)
    setErro('')
    const res = await fetch('/api/analise/gerar', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setErro(data.error || 'Erro ao gerar análise'); setGerando(false); return }
    setAnalise(data.analise)
    setStatus(prev => prev ? { ...prev, disponivel: false, count: data.count } : prev)
    setGerando(false)
  }

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🧠 Raio-X do Mês</div>
          <div className="page-sub">Análise inteligente das suas rotas e custos</div>
        </div>
      </div>

      {/* Estado: aguardando viagens */}
      {status && status.count === 0 && !status.disponivel && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚛</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Quase lá!</div>
          <div style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
            Complete <strong>{10 - (status.viagens_finalizadas || 0)} viagem{10 - (status.viagens_finalizadas || 0) !== 1 ? 's' : ''} mais</strong> para desbloquear seu primeiro Raio-X gratuito.
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: '99px', height: '8px', overflow: 'hidden', maxWidth: '280px', margin: '0 auto 12px' }}>
            <div style={{ height: '100%', borderRadius: '99px', background: 'var(--primary)', width: `${Math.round(((status.viagens_finalizadas || 0) / 10) * 100)}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{status.viagens_finalizadas || 0} de 10 viagens</div>
          <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => router.push('/viagens')}>+ Registrar viagem</button>
        </div>
      )}

      {/* Estado: primeira análise disponível (grátis) */}
      {status && status.count === 0 && status.disponivel && !analise && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 5%, transparent)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧠</div>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Seu Raio-X está pronto!</div>
          <div style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto 28px' }}>
            Com base nas suas {status.viagens_finalizadas} viagens, preparamos uma análise completa de rotas, custos e padrões. Gratuito.
          </div>
          <button className="btn btn-primary" style={{ fontSize: '15px', padding: '13px 32px' }} onClick={gerarAnalise} disabled={gerando}>
            {gerando ? '🔄 Gerando análise...' : '🧠 Ver meu Raio-X'}
          </button>
          {erro && <div className="alert-error" style={{ marginTop: '12px' }}>{erro}</div>}
        </div>
      )}

      {/* Estado: barra de progresso (cooldown ativo) */}
      {status && status.count > 0 && !status.disponivel && !analise && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '32px' }}>🧠</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Próximo Raio-X</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                Disponível em <strong>{status.dias_restantes} dia{status.dias_restantes !== 1 ? 's' : ''}</strong>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: '99px', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', borderRadius: '99px', background: 'linear-gradient(90deg, var(--primary), #8B5CF6)', width: `${status.pct_barra || 0}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
            <span>Hoje</span>
            <span>Em {status.cooldown} dias</span>
          </div>
        </div>
      )}

      {/* Order bump — próxima análise paga */}
      {status && status.orderbump && !analise && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px', borderColor: 'color-mix(in srgb, #F59E0B 40%, transparent)', background: 'color-mix(in srgb, #F59E0B 5%, transparent)', marginTop: '16px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧠</div>
          <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Novo Raio-X disponível</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
            Análise completa de rotas, custos e padrões do último mês.<br />
            No Pro, está sempre incluso.
          </div>
          <button className="btn btn-primary" style={{ marginBottom: '12px', width: '100%', padding: '13px' }} onClick={() => alert('Order bump Asaas em breve')}>
            📊 Ver análise — R$X,XX
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => router.push('/planos')}>
            Ou assine o Pro e ganhe todo mês →
          </button>
        </div>
      )}

      {/* Análise gerada */}
      {analise && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Rota campeã */}
          {analise.rota_campeã && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, #10B981 35%, transparent)', background: 'color-mix(in srgb, #10B981 5%, transparent)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>🏆</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Rota campeã</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{analise.rota_campeã.rota}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Lucro médio: <strong style={{ color: '#10B981' }}>{fmtBRL(analise.rota_campeã.lucro_medio)}</strong> · Margem: {Math.round(analise.rota_campeã.margem_media)}% · {analise.rota_campeã.qtd} viagem{analise.rota_campeã.qtd > 1 ? 's' : ''}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    Priorize essa rota quando disponível — é onde seu dinheiro trabalha mais.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rota que sangra */}
          {analise.rota_sangra && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, #EF4444 35%, transparent)', background: 'color-mix(in srgb, #EF4444 5%, transparent)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>🩸</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Rota que sangra</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{analise.rota_sangra.rota}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Lucro médio: <strong style={{ color: '#EF4444' }}>{fmtBRL(analise.rota_sangra.lucro_medio)}</strong> · Margem: {Math.round(analise.rota_sangra.margem_media)}%
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    {analise.rota_sangra.lucro_medio < 0 ? 'Você está rodando no prejuízo nessa rota. Renegocie ou evite.' : 'Margem baixa — negocie um frete melhor ou corte custos antes de aceitar.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custo por km */}
          <div className="card">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '32px', flexShrink: 0 }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Custo por km</div>
                <div style={{ fontWeight: 800, fontSize: '22px', marginBottom: '4px' }}>{fmtBRL(analise.custo_por_km)}<span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 400 }}>/km</span></div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Baseado em {analise.total_viagens} viagens · diesel + pedágio + todas as despesas
                </div>
              </div>
            </div>
          </div>

          {/* Melhor semana */}
          {analise.melhor_semana && (
            <div className="card">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>📅</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Semana que você roda melhor</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{SEMANA_LABEL[analise.melhor_semana.semana]} do mês</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Faturamento médio: <strong>{fmtBRL(analise.melhor_semana.media)}</strong> nessa semana
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    Tente concentrar as melhores rotas nessa janela do mês.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Corrida surpresa */}
          {analise.corrida_surpresa && (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, #F59E0B 35%, transparent)', background: 'color-mix(in srgb, #F59E0B 5%, transparent)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '32px', flexShrink: 0 }}>⚠️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Corrida surpresa</div>
                  <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>{analise.corrida_surpresa.rota}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                    Frete: <strong>{fmtBRL(analise.corrida_surpresa.valor_frete)}</strong> · Lucro real: <strong style={{ color: analise.corrida_surpresa.lucro < 0 ? '#EF4444' : 'var(--text)' }}>{fmtBRL(analise.corrida_surpresa.lucro)}</strong> · Margem: {analise.corrida_surpresa.margem}%
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                    Parecia um bom frete pelo valor — mas os custos comeram a margem. Fique de olho.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Próxima análise — barra pós-geração */}
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
              {status?.count === 1 ? 'Próximo Raio-X disponível em 7 dias' : 'Próximo Raio-X em 30 dias'}
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '99px', background: 'var(--primary)', width: '2%' }} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
              No Pro você recebe automaticamente todo mês →{' '}
              <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => router.push('/planos')}>Ver planos</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

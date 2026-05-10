'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ViagemRow, DespesaRow } from '@/types/database'
import { fmtBRL, fmtDate, margemPct, CATS_PADRAO, CAT_ICONS, DEFAULT_ICON } from '@/lib/utils'

export default function RelatoriosPage() {
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detalhe, setDetalhe] = useState<(ViagemRow & { _custo: number; _lucro: number }) | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: v }, { data: d }] = await Promise.all([
      supabase.from('viagens').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('despesas').select('*').eq('user_id', user.id),
    ])
    setViagens(v || [])
    setDespesas(d || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function custoViagem(v: ViagemRow) {
    return v.descontos_nota + despesas.filter(d => d.viagem_id === v.id).reduce((s, d) => s + d.valor, 0)
  }
  function lucroViagem(v: ViagemRow) { return v.valor_frete - custoViagem(v) }

  const fat = viagens.reduce((s, v) => s + v.valor_frete, 0)
  const custo = viagens.reduce((s, v) => s + custoViagem(v), 0)
  const lucro = fat - custo

  const finalizadas = viagens
    .filter(v => v.status === 'FINALIZADA')
    .map(v => ({ ...v, _custo: custoViagem(v), _lucro: lucroViagem(v) }))
    .sort((a, b) => b._lucro - a._lucro)

  const catsUsadas = [...new Set(despesas.map(d => d.categoria))]
  const todasCats = [...CATS_PADRAO, ...catsUsadas.filter(c => !CATS_PADRAO.includes(c))]
  const despesasViagem = detalhe ? despesas.filter(d => d.viagem_id === detalhe.id).sort((a, b) => b.valor - a.valor) : []

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      <div className="page-header">
        <div className="page-title">Relatórios</div>
        <div className="page-sub">Toque em uma viagem para ver cada despesa</div>
      </div>

      <div className="grid grid-3 mb16">
        <div className="card"><div className="card-title">Faturamento total</div><div className="card-value green">{fmtBRL(fat)}</div></div>
        <div className="card"><div className="card-title">Custo total</div><div className="card-value red">{fmtBRL(custo)}</div></div>
        <div className="card"><div className="card-title">Lucro total</div><div className={`card-value ${lucro >= 0 ? 'green' : 'red'} fw600`}>{fmtBRL(lucro)}</div></div>
      </div>

      {/* Ranking clicável */}
      <div className="card mb16">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Corridas por lucratividade</div>
        </div>
        {!finalizadas.length ? <div className="empty">Nenhuma viagem finalizada ainda.</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Rota</th><th>Frete</th><th>Custo</th><th>Lucro</th><th>Margem</th></tr>
              </thead>
              <tbody>
                {finalizadas.map((v, i) => {
                  const mg = margemPct(v.valor_frete, v._lucro)
                  return (
                    <tr key={v.id} onClick={() => setDetalhe(v)} style={{ cursor: 'pointer' }}>
                      <td className="muted" style={{ fontSize: '12px', width: '28px' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{v.origem}</div>
                        <div className="muted" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>→ {v.destino}</div>
                      </td>
                      <td className="green fw600" style={{ whiteSpace: 'nowrap' }}>{fmtBRL(v.valor_frete)}</td>
                      <td className="red" style={{ whiteSpace: 'nowrap' }}>{fmtBRL(v._custo)}</td>
                      <td className={`${v._lucro >= 0 ? 'green' : 'red'} fw600`} style={{ whiteSpace: 'nowrap' }}>{fmtBRL(v._lucro)}</td>
                      <td><span className={`badge ${v._lucro < 0 ? 'badge-red' : mg >= 20 ? 'badge-green' : 'badge-yellow'}`}>{mg}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Despesas por categoria */}
      <div className="card">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Despesas por categoria</div>
        </div>
        {!despesas.length ? <div className="empty">Nenhuma despesa registrada.</div> : (
          <div style={{ marginTop: '8px' }}>
            {todasCats.map(cat => {
              const total = despesas.filter(d => d.categoria === cat).reduce((s, d) => s + d.valor, 0)
              if (!total) return null
              const pct = custo ? Math.round((total / custo) * 100) : 0
              return (
                <div key={cat} style={{ marginBottom: '14px' }}>
                  <div className="flex-between" style={{ marginBottom: '6px', fontSize: '13px' }}>
                    <span>{CAT_ICONS[cat] || DEFAULT_ICON} {cat}</span>
                    <span className="fw600">{fmtBRL(total)} <span className="muted">({pct}%)</span></span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--yellow)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALHE DA VIAGEM */}
      {detalhe && (
        <div className="modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800 }}>{detalhe.origem}</div>
                <div style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '2px' }}>→ {detalhe.destino}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  {fmtDate(detalhe.data)}{detalhe.km ? ` · ${detalhe.km.toLocaleString('pt-BR')} km` : ''}{detalhe.contratante ? ` · ${detalhe.contratante}` : ''}
                </div>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: 'var(--surface2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', color: 'var(--muted)', flexShrink: 0 }}>✕</button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'Frete bruto', value: fmtBRL(detalhe.valor_frete), color: 'var(--green)' },
                { label: 'Custo total', value: fmtBRL(detalhe._custo), color: 'var(--red)' },
                { label: 'Lucro líquido', value: fmtBRL(detalhe._lucro), color: detalhe._lucro >= 0 ? 'var(--green)' : 'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Lista de despesas */}
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '10px' }}>
              Despesas desta viagem
            </div>

            {!despesasViagem.length
              ? <div className="empty" style={{ padding: '16px' }}>Nenhuma despesa registrada nesta viagem.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {despesasViagem.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{CAT_ICONS[d.categoria] || DEFAULT_ICON}</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.categoria}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {d.litros ? `${d.litros}L · ` : ''}{fmtDate(d.data)}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>−{fmtBRL(d.valor)}</div>
                    </div>
                  ))}
                </div>
              )
            }

            {detalhe.descontos_nota > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>📄</span>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Descontos na nota</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>−{fmtBRL(detalhe.descontos_nota)}</div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Margem da corrida</div>
              <span className={`badge ${detalhe._lucro < 0 ? 'badge-red' : margemPct(detalhe.valor_frete, detalhe._lucro) >= 20 ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '14px', padding: '4px 12px' }}>
                {margemPct(detalhe.valor_frete, detalhe._lucro)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

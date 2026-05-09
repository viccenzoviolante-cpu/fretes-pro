'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ViagemRow, DespesaRow } from '@/types/database'
import { fmtBRL, fmtDate, margemPct, CATS_PADRAO, CAT_ICONS, DEFAULT_ICON } from '@/lib/utils'

export default function RelatoriosPage() {
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      <div className="page-header">
        <div className="page-title">Relatórios</div>
        <div className="page-sub">Análise de desempenho</div>
      </div>

      <div className="grid grid-3 mb16">
        <div className="card"><div className="card-title">Faturamento total</div><div className="card-value green">{fmtBRL(fat)}</div></div>
        <div className="card"><div className="card-title">Custo total</div><div className="card-value red">{fmtBRL(custo)}</div></div>
        <div className="card"><div className="card-title">Lucro total</div><div className={`card-value ${lucro >= 0 ? 'green' : 'red'} fw600`}>{fmtBRL(lucro)}</div></div>
      </div>

      {/* Ranking */}
      <div className="card mb16">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Corridas por lucratividade</div>
        </div>
        {!finalizadas.length ? <div className="empty">Nenhuma viagem finalizada ainda.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Rota</th><th>Contratante</th><th>Frete</th><th>Custo</th><th>Lucro</th><th>Margem</th><th>Data</th></tr></thead>
              <tbody>
                {finalizadas.map((v, i) => {
                  const mg = margemPct(v.valor_frete, v._lucro)
                  return (
                    <tr key={v.id}>
                      <td className="muted" style={{ fontSize: '12px' }}>{i + 1}</td>
                      <td><strong>{v.origem}</strong><br /><span className="muted" style={{ fontSize: '12px' }}>→ {v.destino}</span></td>
                      <td>{v.contratante || '—'}</td>
                      <td className="green fw600">{fmtBRL(v.valor_frete)}</td>
                      <td className="red">{fmtBRL(v._custo)}</td>
                      <td className={`${v._lucro >= 0 ? 'green' : 'red'} fw600`}>{fmtBRL(v._lucro)}</td>
                      <td><span className={`badge ${v._lucro < 0 ? 'badge-red' : mg >= 20 ? 'badge-green' : 'badge-yellow'}`}>{mg}%</span></td>
                      <td className="muted" style={{ fontSize: '12px' }}>{fmtDate(v.data)}</td>
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
    </>
  )
}

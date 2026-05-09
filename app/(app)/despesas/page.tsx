'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DespesaRow, ViagemRow, CategoriaRow } from '@/types/database'
import { fmtBRL, fmtDate, parseMoney, maskMoney, today, CATS_PADRAO, CAT_ICONS, DEFAULT_ICON } from '@/lib/utils'
import Toast from '@/components/Toast'

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [catsCustom, setCatsCustom] = useState<CategoriaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [catSel, setCatSel] = useState('')
  const [valor, setValorStr] = useState('')
  const [litros, setLitros] = useState('')
  const [vinculada, setVinculada] = useState(false)
  const [novaCat, setNovaCat] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: d }, { data: v }, { data: c }] = await Promise.all([
      supabase.from('despesas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('viagens').select('*').eq('user_id', user.id),
      supabase.from('categorias_despesa').select('*').eq('user_id', user.id),
    ])
    setDespesas(d || [])
    setViagens(v || [])
    setCatsCustom(c || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const viagemAtiva = viagens.find(v => v.status === 'EM_ANDAMENTO') || null
  const todasCats = [...CATS_PADRAO, ...catsCustom.map(c => c.nome)]

  function abrirModal() {
    setCatSel(''); setStep(1); setValorStr(''); setLitros(''); setVinculada(!!viagemAtiva); setNovaCat('')
    setModalOpen(true)
  }
  function fecharModal() { setModalOpen(false) }

  async function criarCategoria() {
    const nome = novaCat.trim()
    if (!nome) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('categorias_despesa').insert({ user_id: user.id, nome }).select().single()
    if (data) {
      setCatsCustom(c => [...c, data])
      setNovaCat('')
      setCatSel(nome)
      setStep(2)
    }
  }

  async function salvarDespesa() {
    if (!catSel) { setToast({ msg: 'Selecione uma categoria', type: 'error' }); return }
    const val = parseMoney(valor)
    if (!val) { setToast({ msg: 'Informe o valor', type: 'error' }); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('despesas').insert({
      user_id: user.id,
      categoria: catSel,
      valor: val,
      litros: catSel === 'Diesel' ? (parseFloat(litros) || null) : null,
      viagem_id: vinculada && viagemAtiva ? viagemAtiva.id : null,
      data: today(),
    })
    setToast({ msg: 'Despesa registrada!', type: 'success' })
    fecharModal()
    fetchData()
  }

  async function excluirDespesa(id: string) {
    if (!confirm('Remover esta despesa?')) return
    const supabase = createClient()
    await supabase.from('despesas').delete().eq('id', id)
    setToast({ msg: 'Despesa removida', type: 'info' })
    fetchData()
  }

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header flex-between">
        <div>
          <div className="page-title">Despesas</div>
          <div className="page-sub">Controle de gastos</div>
        </div>
        <button className="btn btn-primary" onClick={abrirModal}>+ Adicionar Despesa</button>
      </div>

      {/* KPIs por categoria */}
      <div className="grid grid-3 mb16">
        {todasCats.map(cat => {
          const total = despesas.filter(d => d.categoria === cat).reduce((s, d) => s + d.valor, 0)
          if (total === 0 && !CATS_PADRAO.includes(cat)) return null
          return (
            <div key={cat} className="card">
              <div className="card-title">{CAT_ICONS[cat] || DEFAULT_ICON} {cat}</div>
              <div className="card-value red">{fmtBRL(total)}</div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Histórico de despesas</div>
        </div>
        {!despesas.length ? <div className="empty">Nenhuma despesa registrada ainda.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Categoria</th><th>Valor</th><th>Litros</th><th>Viagem</th><th></th></tr></thead>
              <tbody>
                {despesas.map(d => {
                  const viagem = d.viagem_id ? viagens.find(v => v.id === d.viagem_id) : null
                  return (
                    <tr key={d.id}>
                      <td>{fmtDate(d.data)}</td>
                      <td>{CAT_ICONS[d.categoria] || DEFAULT_ICON} {d.categoria}</td>
                      <td className="red fw600">{fmtBRL(d.valor)}</td>
                      <td>{d.litros ? `${d.litros} L` : '—'}</td>
                      <td>{viagem ? <span style={{ fontSize: '12px' }}>{viagem.origem} → {viagem.destino}</span> : <span className="muted">—</span>}</td>
                      <td><button className="btn-icon" onClick={() => excluirDespesa(d.id)} title="Excluir">🗑️</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) fecharModal() }}>
          <div className="modal">
            <div className="modal-title">Adicionar Despesa</div>

            {step === 1 && (
              <>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Selecione a categoria</div>
                <div className="cat-grid">
                  {todasCats.map(cat => (
                    <div key={cat} className={`cat-btn ${catSel === cat ? 'selected' : ''}`} onClick={() => { setCatSel(cat); setStep(2) }}>
                      <div className="cat-icon">{CAT_ICONS[cat] || DEFAULT_ICON}</div>
                      <div>{cat}</div>
                    </div>
                  ))}
                </div>
                <div className="field mt16">
                  <label>Criar nova categoria</label>
                  <div className="flex gap8">
                    <input type="text" value={novaCat} onChange={e => setNovaCat(e.target.value)} placeholder="Nome da categoria" onKeyDown={e => e.key === 'Enter' && criarCategoria()} />
                    <button className="btn btn-ghost btn-sm" onClick={criarCategoria}>Criar</button>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex-between mb16">
                  <div className="fw600" style={{ fontSize: '15px' }}>{CAT_ICONS[catSel] || DEFAULT_ICON} {catSel}</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Trocar</button>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Valor (R$)</label>
                    <input type="text" value={valor} onChange={e => setValorStr(maskMoney(e.target.value))} placeholder="R$ 0,00" autoFocus />
                  </div>
                  {catSel === 'Diesel' && (
                    <div className="field">
                      <label>Litros abastecidos</label>
                      <input type="number" value={litros} onChange={e => setLitros(e.target.value)} placeholder="Ex: 150" step="0.1" />
                    </div>
                  )}
                  {viagemAtiva && (
                    <div className="field">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={vinculada} onChange={e => setVinculada(e.target.checked)} style={{ width: 'auto' }} />
                        <span>Faz parte da viagem atual?</span>
                      </label>
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
                  <button className="btn btn-primary" onClick={salvarDespesa}>Registrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

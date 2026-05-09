'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ViagemRow, DespesaRow } from '@/types/database'
import { fmtBRL, fmtDate, parseMoney, maskMoney, margemPct, today, calcularDistanciaOSRM } from '@/lib/utils'
import Toast from '@/components/Toast'

interface Form {
  data: string; origem: string; destino: string; km: string
  tonelada: string; contratante: string; tipoCarga: string
  valorFrete: string; descontosNota: string
}

const FORM_VAZIO: Form = { data: '', origem: '', destino: '', km: '', tonelada: '', contratante: '', tipoCarga: '', valorFrete: '', descontosNota: '' }

export default function ViagensPage() {
  const [viagens, setViagens] = useState<ViagemRow[]>([])
  const [despesas, setDespesas] = useState<DespesaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [verTudo, setVerTudo] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ ...FORM_VAZIO, data: today() })
  const [calcLoading, setCalcLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [acContratante, setAcContratante] = useState<string[]>([])
  const [acCarga, setAcCarga] = useState<string[]>([])
  const [showAcC, setShowAcC] = useState(false)
  const [showAcK, setShowAcK] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

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

  const viagemAtiva = viagens.find(v => v.status === 'EM_ANDAMENTO') || null
  const finalizadas = viagens.filter(v => v.status === 'FINALIZADA')
  const contratantes = [...new Set(viagens.map(v => v.contratante).filter(Boolean) as string[])]
  const cargas = [...new Set(viagens.map(v => v.tipo_carga).filter(Boolean) as string[])]

  function abrirModal(id?: string) {
    if (id) {
      const v = viagens.find(x => x.id === id)!
      setForm({
        data: v.data, origem: v.origem, destino: v.destino,
        km: v.km?.toString() || '', tonelada: v.tonelada?.toString() || '',
        contratante: v.contratante || '', tipoCarga: v.tipo_carga || '',
        valorFrete: fmtBRL(v.valor_frete), descontosNota: fmtBRL(v.descontos_nota),
      })
      setEditId(id)
    } else {
      setForm({ ...FORM_VAZIO, data: today() })
      setEditId(null)
    }
    setModalOpen(true)
  }

  function fecharModal() { setModalOpen(false); setEditId(null) }

  async function salvarViagem() {
    if (!form.origem || !form.destino || !form.valorFrete) {
      setToast({ msg: 'Preencha os campos obrigatórios', type: 'error' }); return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      data: form.data || today(),
      origem: form.origem.trim(),
      destino: form.destino.trim(),
      km: parseInt(form.km) || null,
      tonelada: parseFloat(form.tonelada) || null,
      contratante: form.contratante.trim() || null,
      tipo_carga: form.tipoCarga.trim() || null,
      valor_frete: parseMoney(form.valorFrete),
      descontos_nota: parseMoney(form.descontosNota),
    }

    if (editId) {
      await supabase.from('viagens').update(payload).eq('id', editId)
      setToast({ msg: 'Viagem atualizada', type: 'success' })
    } else {
      // Capturar GPS se disponível
      let gpsLat: number | null = null, gpsLon: number | null = null
      if (navigator.geolocation) {
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(
            pos => { gpsLat = pos.coords.latitude; gpsLon = pos.coords.longitude; resolve() },
            () => resolve(), { timeout: 5000 }
          )
        })
      }
      await supabase.from('viagens').insert({
        user_id: user.id, ...payload, status: 'EM_ANDAMENTO',
        gps_origem_lat: gpsLat, gps_origem_lon: gpsLon,
      })
      setToast({ msg: 'Viagem iniciada!', type: 'success' })
    }
    fecharModal()
    fetchData()
  }

  async function encerrarViagem(id: string) {
    if (!confirm('Confirma o encerramento desta viagem?')) return
    const supabase = createClient()
    await supabase.from('viagens').update({ status: 'FINALIZADA' }).eq('id', id)
    setToast({ msg: 'Viagem encerrada!', type: 'success' })
    fetchData()
  }

  async function excluirViagem(id: string) {
    if (!confirm('Excluir esta viagem? Esta ação não pode ser desfeita.')) return
    const supabase = createClient()
    await supabase.from('viagens').delete().eq('id', id)
    setToast({ msg: 'Viagem excluída', type: 'info' })
    fetchData()
  }

  async function autoCalc() {
    if (!form.origem || !form.destino) { setToast({ msg: 'Preencha partida e chegada primeiro', type: 'error' }); return }
    setCalcLoading(true)
    setToast({ msg: 'Calculando rota...', type: 'info' })
    const km = await calcularDistanciaOSRM(form.origem, form.destino)
    if (km) {
      setForm(f => ({ ...f, km: km.toString() }))
      setToast({ msg: `✅ ${km} km calculados via OSRM`, type: 'success' })
    } else {
      setToast({ msg: 'Não foi possível calcular a rota', type: 'error' })
    }
    setCalcLoading(false)
  }

  function setFrete(val: string) { setForm(f => ({ ...f, valorFrete: maskMoney(val) })) }
  function setDesconto(val: string) { setForm(f => ({ ...f, descontosNota: maskMoney(val) })) }

  if (loading) return <div className="empty">Carregando...</div>

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header flex-between">
        <div>
          <div className="page-title">Viagens</div>
          <div className="page-sub">Histórico e gestão de fretes</div>
        </div>
        {!viagemAtiva && (
          <button className="btn btn-primary" onClick={() => abrirModal()}>+ Nova Viagem</button>
        )}
      </div>

      {/* Viagem ativa */}
      {viagemAtiva && (() => {
        const c = custoViagem(viagemAtiva), l = lucroViagem(viagemAtiva)
        return (
          <div className="card card-green mb16">
            <div className="card-header">
              <div style={{ fontSize: '14px', fontWeight: 700 }}>🚛 Viagem em andamento</div>
              <div className="flex gap8">
                <button className="btn btn-ghost btn-sm" onClick={() => abrirModal(viagemAtiva.id)}>✏️ Editar</button>
                <button className="btn btn-danger btn-sm" onClick={() => encerrarViagem(viagemAtiva.id)}>Encerrar</button>
              </div>
            </div>
            <div className="stat-row mt16">
              <div className="stat-item"><div className="stat-label">Rota</div><div className="stat-value">{viagemAtiva.origem} → {viagemAtiva.destino}</div></div>
              <div className="stat-item"><div className="stat-label">Contratante</div><div className="stat-value">{viagemAtiva.contratante || '—'}</div></div>
              <div className="stat-item"><div className="stat-label">KM</div><div className="stat-value">{Number(viagemAtiva.km || 0).toLocaleString('pt-BR')} km</div></div>
              <div className="stat-item"><div className="stat-label">Frete</div><div className="stat-value green">{fmtBRL(viagemAtiva.valor_frete)}</div></div>
              <div className="stat-item"><div className="stat-label">Custo atual</div><div className="stat-value red">{fmtBRL(c)}</div></div>
              <div className="stat-item"><div className="stat-label">Lucro atual</div><div className={`stat-value ${l >= 0 ? 'green' : 'red'}`}>{fmtBRL(l)}</div></div>
            </div>
          </div>
        )
      })()}

      {/* Tabela historico */}
      <div className="card">
        <div className="card-header">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)' }}>Histórico</div>
          <div className="flex gap8">
            <span className="muted" style={{ fontSize: '13px' }}>{finalizadas.length} viagens</span>
            {finalizadas.length > 10 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setVerTudo(v => !v)}>
                {verTudo ? 'Ver menos' : 'Ver tudo'}
              </button>
            )}
          </div>
        </div>
        {!finalizadas.length ? <div className="empty">Nenhuma viagem registrada ainda.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Rota</th><th>Contratante</th><th>Faturamento</th><th>Custo</th><th>Lucro</th><th>Margem</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(verTudo ? finalizadas : finalizadas.slice(0, 10)).map(v => {
                  const c = custoViagem(v), l = lucroViagem(v), mg = margemPct(v.valor_frete, l)
                  return (
                    <tr key={v.id}>
                      <td>{fmtDate(v.data)}</td>
                      <td><strong>{v.origem}</strong><br /><span className="muted" style={{ fontSize: '12px' }}>→ {v.destino}</span></td>
                      <td>{v.contratante || '—'}</td>
                      <td className="green fw600">{fmtBRL(v.valor_frete)}</td>
                      <td className="red">{fmtBRL(c)}</td>
                      <td className={`${l >= 0 ? 'green' : 'red'} fw600`}>{fmtBRL(l)}</td>
                      <td><span className={`badge ${l < 0 ? 'badge-red' : mg >= 20 ? 'badge-green' : 'badge-yellow'}`}>{mg}%</span></td>
                      <td><span className="badge badge-green">Finalizada</span></td>
                      <td>
                        <button className="btn-icon" onClick={() => abrirModal(v.id)} title="Editar">✏️</button>
                        <button className="btn-icon" onClick={() => excluirViagem(v.id)} title="Excluir">🗑️</button>
                      </td>
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
            <div className="modal-title">{editId ? 'Editar Viagem' : 'Nova Viagem'}</div>
            <div className="form-grid">
              <div className="form-grid form-grid-2">
                <div className="field">
                  <label>Data da viagem</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Tonelada</label>
                  <input type="number" value={form.tonelada} onChange={e => setForm(f => ({ ...f, tonelada: e.target.value }))} placeholder="Ex: 22" step="0.1" />
                </div>
              </div>
              <div className="field">
                <label>Ponto de Partida</label>
                <input type="text" value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} placeholder="Ex: São Paulo - SP" />
              </div>
              <div className="field">
                <label>Ponto de Chegada</label>
                <input type="text" value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} placeholder="Ex: Curitiba - PR" />
              </div>
              <div className="field">
                <label>Distância (km)</label>
                <div className="flex gap8">
                  <input type="number" value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} placeholder="Ex: 408" style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={autoCalc} disabled={calcLoading}>
                    {calcLoading ? '...' : '📍 Auto'}
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Contratante</label>
                <div className="autocomplete-wrap">
                  <input
                    type="text" value={form.contratante} placeholder="Digite o nome..." autoComplete="off"
                    onChange={e => {
                      setForm(f => ({ ...f, contratante: e.target.value }))
                      const q = e.target.value.toLowerCase()
                      setAcContratante(q ? contratantes.filter(c => c.toLowerCase().includes(q)) : [])
                      setShowAcC(true)
                    }}
                    onBlur={() => setTimeout(() => setShowAcC(false), 150)}
                  />
                  {showAcC && acContratante.length > 0 && (
                    <div className="autocomplete-list">
                      {acContratante.map(c => (
                        <div key={c} className="autocomplete-item" onMouseDown={() => { setForm(f => ({ ...f, contratante: c })); setShowAcC(false) }}>{c}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="field">
                <label>Tipo de Carga</label>
                <div className="autocomplete-wrap">
                  <input
                    type="text" value={form.tipoCarga} placeholder="Ex: Grãos, Combustível..." autoComplete="off"
                    onChange={e => {
                      setForm(f => ({ ...f, tipoCarga: e.target.value }))
                      const q = e.target.value.toLowerCase()
                      setAcCarga(q ? cargas.filter(c => c.toLowerCase().includes(q)) : [])
                      setShowAcK(true)
                    }}
                    onBlur={() => setTimeout(() => setShowAcK(false), 150)}
                  />
                  {showAcK && acCarga.length > 0 && (
                    <div className="autocomplete-list">
                      {acCarga.map(c => (
                        <div key={c} className="autocomplete-item" onMouseDown={() => { setForm(f => ({ ...f, tipoCarga: c })); setShowAcK(false) }}>{c}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div className="field">
                  <label>Valor do Frete (R$)</label>
                  <input type="text" value={form.valorFrete} onChange={e => setFrete(e.target.value)} placeholder="R$ 0,00" />
                </div>
                <div className="field">
                  <label>Descontos em Nota (R$)</label>
                  <input type="text" value={form.descontosNota} onChange={e => setDesconto(e.target.value)} placeholder="R$ 0,00" />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarViagem}>Salvar Viagem</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

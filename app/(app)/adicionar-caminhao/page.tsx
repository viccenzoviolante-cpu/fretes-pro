'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CARROCERIAS = ['Graneleiro', 'Baú', 'Tanque', 'Frigorífico', 'Plataforma', 'Sider', 'Caçamba', 'Outro']
const TIPOS_CARGA = ['Granel', 'Frigorífico', 'Perigosa', 'Vivo', 'Conteiner', 'Líquido', 'Outro']

export default function AdicionarCaminhaoPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'pagamento' | 'aguardando'>('form')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [caminhaoId, setCaminhaoId] = useState<string | null>(null)

  // Dados do formulário
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [carroceria, setCarroceria] = useState('')
  const [kml, setKml] = useState('')
  const [capacidade, setCapacidade] = useState('')
  const [tipos, setTipos] = useState<string[]>([])

  function toggleTipo(t: string) {
    setTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function salvarCaminhao() {
    if (!modelo.trim() || !placa.trim()) { setErro('Modelo e placa são obrigatórios.'); return }
    setSaving(true)
    setErro('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase.from('caminhoes').insert({
      user_id: user.id,
      apelido: null,
      modelo: modelo.trim(),
      placa: placa.trim().toUpperCase(),
      carroceria: carroceria || null,
      kml_medio: parseFloat(kml) || null,
      capacidade_kg: parseFloat(capacidade) || null,
      tipos_carga: tipos.length > 0 ? tipos : null,
      is_principal: false,
      plano_ativo: false, // ativa após pagamento confirmado
    }).select('id').single()

    setSaving(false)
    if (error || !data) { setErro('Erro ao salvar. Tente novamente.'); return }
    setCaminhaoId(data.id)
    setStep('pagamento')
  }

  async function simularPagamento() {
    if (!caminhaoId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('caminhoes').update({ plano_ativo: true }).eq('id', caminhaoId)
    setSaving(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div className="page-header flex-between" style={{ marginBottom: '24px' }}>
        <div>
          <div className="page-title">Adicionar caminhão</div>
          <div className="page-sub">R$47,90/mês por caminhão adicional</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← Voltar</button>
      </div>

      {/* Barra de progresso */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {(['form', 'pagamento', 'aguardando'] as const).map((s, i) => (
          <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= ['form', 'pagamento', 'aguardando'].indexOf(step) ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s' }} />
        ))}
      </div>

      {/* PASSO 1 — Formulário do caminhão */}
      {step === 'form' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>🚛 Dados do caminhão</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="field">
                <label>Modelo *</label>
                <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Scania R450" autoFocus />
              </div>
              <div className="field">
                <label>Placa *</label>
                <input type="text" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" style={{ textTransform: 'uppercase' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="field">
                <label>Carroceria</label>
                <select value={carroceria} onChange={e => setCarroceria(e.target.value)}>
                  <option value="">Selecionar...</option>
                  {CARROCERIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Consumo (km/L)</label>
                <input type="number" value={kml} onChange={e => setKml(e.target.value)} placeholder="Ex: 3.5" step="0.1" min="0" />
              </div>
            </div>

            <div className="field">
              <label>Capacidade máxima (kg) <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opcional</span></label>
              <input type="number" value={capacidade} onChange={e => setCapacidade(e.target.value)} placeholder="Ex: 25000" min="0" />
            </div>

            <div className="field">
              <label>Tipos de carga aceitos <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opcional</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {TIPOS_CARGA.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTipo(t)}
                    style={{
                      padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                      cursor: 'pointer', border: '1px solid',
                      borderColor: tipos.includes(t) ? 'var(--primary)' : 'var(--border)',
                      background: tipos.includes(t) ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                      color: tipos.includes(t) ? 'var(--primary)' : 'var(--muted)',
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>

          {erro && <div style={{ color: 'var(--red)', fontSize: '13px', marginTop: '12px' }}>{erro}</div>}

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: '24px' }}
            onClick={salvarCaminhao}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Continuar para pagamento →'}
          </button>
        </div>
      )}

      {/* PASSO 2 — Pagamento */}
      {step === 'pagamento' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>💳 Pagamento</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>Após confirmação, o caminhão fica ativo imediatamente.</div>

          {/* Card de valor */}
          <div style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Caminhão adicional</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)' }}>R$47,90</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>/mês · cancele quando quiser</div>
          </div>

          {/* Placeholder PIX — integração PagHiper em breve */}
          <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📲</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>PIX via PagHiper</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>QR code disponível em breve — integração em andamento</div>
          </div>

          {/* Botão de simulação (remover quando PagHiper estiver ativo) */}
          <div style={{ background: 'color-mix(in srgb, var(--yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--yellow) 30%, transparent)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--yellow)', fontWeight: 600, marginBottom: '6px' }}>⚠️ Modo de teste — pagamento simulado</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>PagHiper será integrado em breve. Por agora, simule a aprovação para testar o fluxo.</div>
            <button
              className="btn btn-primary btn-full"
              onClick={simularPagamento}
              disabled={saving}
              style={{ fontSize: '14px' }}
            >
              {saving ? 'Ativando...' : '✅ Simular pagamento aprovado'}
            </button>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => setStep('form')}>← Voltar para dados do caminhão</button>
        </div>
      )}

    </div>
  )
}

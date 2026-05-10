'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CARROCERIAS = ['Graneleiro', 'Baú', 'Tanque', 'Frigorífico', 'Plataforma', 'Sider', 'Caçamba', 'Outro']
const TIPOS_CARGA = ['Granel', 'Frigorífico', 'Perigosa', 'Vivo', 'Conteiner', 'Líquido', 'Outro']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // Passo 1 — Perfil
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')

  // Passo 2 — Caminhão
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [carroceria, setCarroceria] = useState('')
  const [kml, setKml] = useState('')
  const [capacidade, setCapacidade] = useState('')
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([])

  // Passo 3 — Meta
  const [meta, setMeta] = useState('')

  function toggleTipo(tipo: string) {
    setTiposSelecionados(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  async function concluir() {
    setSaving(true)
    setErro('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const placaUpper = placa.trim().toUpperCase()
    const kmlNum = parseFloat(kml) || null
    const capNum = parseFloat(capacidade) || null
    const metaNum = parseFloat(meta.replace(/\./g, '').replace(',', '.')) || null

    const { error: uErr } = await supabase.from('users').update({
      nome: nome.trim() || null,
      telefone: telefone.trim() || null,
      modelo_caminhao: modelo.trim() || null,
      placa: placaUpper || null,
      carroceria: carroceria || null,
      kml_medio: kmlNum,
      meta_financeira: metaNum,
      onboarding_completo: true,
    }).eq('id', user.id)

    if (uErr) { setErro('Erro ao salvar perfil. Tente novamente.'); setSaving(false); return }

    const { error: cErr } = await supabase.from('caminhoes').insert({
      user_id: user.id,
      apelido: null,
      modelo: modelo.trim() || 'Não informado',
      placa: placaUpper || 'Não informada',
      carroceria: carroceria || null,
      kml_medio: kmlNum,
      capacidade_kg: capNum,
      tipos_carga: tiposSelecionados.length > 0 ? tiposSelecionados : null,
      is_principal: true,
      plano_ativo: true,
    })

    if (cErr) { setErro('Erro ao salvar caminhão. Tente novamente.'); setSaving(false); return }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px', marginBottom: '6px' }}>FretesPro</div>
          <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Configure sua conta em 3 passos</div>
        </div>

        {/* Barra de progresso */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: s <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        <div className="card" style={{ padding: '28px' }}>

          {/* PASSO 1 — Perfil */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>👤 Seu perfil</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Como você quer aparecer no app</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="field">
                  <label>Seu nome completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: João da Silva"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '24px' }}
                onClick={() => { if (nome.trim()) setStep(2); else setErro('Informe seu nome para continuar.') }}
              >
                Continuar →
              </button>
              {erro && <div style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>{erro}</div>}
            </>
          )}

          {/* PASSO 2 — Caminhão */}
          {step === 2 && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>🚛 Seu caminhão</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Usado para calcular lucro real por corrida</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field">
                    <label>Modelo</label>
                    <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Scania R450" />
                  </div>
                  <div className="field">
                    <label>Placa</label>
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
                  <label>Tipos de carga que aceita <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opcional</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {TIPOS_CARGA.map(tipo => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => toggleTipo(tipo)}
                        style={{
                          padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '1px solid',
                          borderColor: tiposSelecionados.includes(tipo) ? 'var(--primary)' : 'var(--border)',
                          background: tiposSelecionados.includes(tipo) ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                          color: tiposSelecionados.includes(tipo) ? 'var(--primary)' : 'var(--muted)',
                        }}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setErro(''); setStep(1) }}>← Voltar</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={() => { if (modelo.trim() && placa.trim()) { setErro(''); setStep(3) } else setErro('Informe modelo e placa para continuar.') }}
                >
                  Continuar →
                </button>
              </div>
              {erro && <div style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>{erro}</div>}
            </>
          )}

          {/* PASSO 3 — Meta */}
          {step === 3 && (
            <>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>🎯 Sua meta mensal</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Quanto você quer lucrar por mês? Vamos te mostrar o progresso em tempo real.</div>
              </div>
              <div className="field">
                <label>Meta de lucro mensal (R$)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={meta}
                  onChange={e => setMeta(e.target.value)}
                  placeholder="Ex: 8.000"
                  autoFocus
                  style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', letterSpacing: '1px' }}
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Você pode alterar isso a qualquer momento nas configurações.</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setErro(''); setStep(2) }}>← Voltar</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  onClick={concluir}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : '✅ Entrar no FretesPro'}
                </button>
              </div>
              {erro && <div style={{ color: 'var(--red)', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>{erro}</div>}
            </>
          )}

        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
          Você pode pular e configurar depois nas ⚙️ Configurações
        </div>

      </div>
    </div>
  )
}

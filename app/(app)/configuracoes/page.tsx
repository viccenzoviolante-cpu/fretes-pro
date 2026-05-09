'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'
import Toast from '@/components/Toast'

const TEMAS = [
  { key: 'azul', label: 'Azul', bg: '#1e293b', border: '#3b82f6', emoji: '🔵' },
  { key: 'roxo', label: 'Roxo', bg: '#1a1230', border: '#8b5cf6', emoji: '🟣' },
  { key: 'verde', label: 'Verde', bg: '#0f2419', border: '#10b981', emoji: '🟢' },
  { key: 'laranja', label: 'Laranja', bg: '#251a00', border: '#f59e0b', emoji: '🟡' },
  { key: 'claro', label: 'Claro', bg: '#f8fafc', border: '#94a3b8', emoji: '☀️', textColor: '#0f172a' },
]

const CARROCERIAS = ['', 'Graneleiro', 'Baú', 'Tanque', 'Frigorífico', 'Plataforma', 'Sider', 'Caçamba', 'Outro']

export default function ConfiguracoesPage() {
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [carroceria, setCarroceria] = useState('')
  const [kml, setKml] = useState('')
  const [tema, setTema] = useState('azul')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setNome(data.nome || '')
      setTelefone(data.telefone || '')
      setModelo(data.modelo_caminhao || '')
      setPlaca(data.placa || '')
      setCarroceria(data.carroceria || '')
      setKml(data.kml_medio?.toString() || '')
      setTema(data.tema || 'azul')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function salvar() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('users').update({
      nome: nome.trim() || null,
      telefone: telefone.trim() || null,
      modelo_caminhao: modelo.trim() || null,
      placa: placa.trim().toUpperCase() || null,
      carroceria: carroceria || null,
      kml_medio: parseFloat(kml) || null,
      tema,
    }).eq('id', user.id)
    setToast({ msg: 'Configurações salvas!', type: 'success' })
    setSaving(false)
  }

  async function sair() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) return <div className="empty">Carregando...</div>

  const diasTrial = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-title">Configurações</div>
        <div className="page-sub">Perfil, caminhão e aparência</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '520px' }}>

        {/* Status do plano */}
        {profile?.plano === 'trial' && (
          <div className="card" style={{ borderColor: 'var(--yellow)', background: 'color-mix(in srgb, var(--yellow) 7%, transparent)' }}>
            <div className="card-title">⏱️ Período de teste</div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>{diasTrial} dias restantes</div>
            <div className="muted" style={{ fontSize: '13px', marginTop: '4px' }}>Entre em contato para ativar seu plano.</div>
          </div>
        )}

        {/* Perfil */}
        <div className="card">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>👤 Perfil</div>
          <div className="form-grid">
            <div className="field">
              <label>Nome de exibição</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div className="field">
              <label>Telefone (WhatsApp)</label>
              <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
        </div>

        {/* Caminhão */}
        <div className="card">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>🚛 Caminhão</div>
          <div className="form-grid">
            <div className="form-grid form-grid-2">
              <div className="field">
                <label>Modelo</label>
                <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Scania R450" />
              </div>
              <div className="field">
                <label>Placa</label>
                <input type="text" value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="Ex: ABC-1234" style={{ textTransform: 'uppercase' }} />
              </div>
            </div>
            <div className="form-grid form-grid-2">
              <div className="field">
                <label>Tipo de carroceria</label>
                <select value={carroceria} onChange={e => setCarroceria(e.target.value)}>
                  {CARROCERIAS.map(c => <option key={c} value={c}>{c || 'Selecionar...'}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Consumo médio (km/L)</label>
                <input type="number" value={kml} onChange={e => setKml(e.target.value)} placeholder="Ex: 3.5" step="0.1" min="0" />
              </div>
            </div>
          </div>
        </div>

        {/* Aparência */}
        <div className="card">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>🎨 Aparência</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Tema do app</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {TEMAS.map(t => (
              <div
                key={t.key}
                className={`tema-btn ${tema === t.key ? 'active' : ''}`}
                style={{ background: t.bg, borderColor: t.border, color: t.textColor }}
                onClick={() => setTema(t.key)}
              >
                {t.emoji}<br />{t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Suporte */}
        <div className="card">
          <div className="card-title fw600" style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px' }}>💬 Suporte</div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>Dúvidas ou problemas? Fale direto com a gente.</p>
          <a href="https://wa.me/5511999999999?text=Oi,%20preciso%20de%20ajuda%20com%20o%20FretesPro" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">💬 Chamar no WhatsApp</a>
        </div>

        <div className="flex gap8">
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button>
          <button className="btn btn-ghost" onClick={sair}>Sair da conta</button>
        </div>

      </div>
    </>
  )
}

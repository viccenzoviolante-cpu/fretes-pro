'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function AtualizarSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirma) {
      setErro('As senhas não coincidem.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Não foi possível atualizar a senha. Tente novamente.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="auth-card">
      <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <div className="brand-dot" />
        <span>FretesPro</span>
      </Link>

      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Nova senha</h2>
      <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>Escolha uma senha segura para sua conta.</p>

      {erro && <div className="alert-error">{erro}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="mínimo 6 caracteres"
            />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              required
              placeholder="repita a senha"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-full mt16" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  )
}

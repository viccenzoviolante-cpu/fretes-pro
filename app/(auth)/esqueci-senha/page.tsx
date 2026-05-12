'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/atualizar-senha`,
    })
    if (error) {
      setErro('Não foi possível enviar o e-mail. Tente novamente.')
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div className="auth-card">
      <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <div className="brand-dot" />
        <span>FretesPro</span>
      </Link>

      {enviado ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📬</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>E-mail enviado</h2>
            <p className="muted" style={{ fontSize: '14px', lineHeight: '1.6' }}>
              Verifique sua caixa de entrada e clique no link para redefinir sua senha. O link expira em 1 hora.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-full" style={{ textAlign: 'center', display: 'block' }}>
            Voltar para o login
          </Link>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Esqueceu a senha?</h2>
          <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
            Digite seu e-mail e vamos enviar um link para redefinir.
          </p>

          {erro && <div className="alert-error">{erro}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full mt16" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }} className="muted">
            Lembrou?{' '}
            <Link href="/login" style={{ color: 'var(--primary)' }}>Voltar ao login</Link>
          </p>
        </>
      )}
    </div>
  )
}

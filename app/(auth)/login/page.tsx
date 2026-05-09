'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro('Email ou senha inválidos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="auth-card">
      <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <div className="brand-dot" />
        <span>FretesPro</span>
      </Link>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Entrar</h2>
      <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>Acesse sua conta</p>

      {erro && <div className="alert-error">{erro}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-grid">
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="••••••••" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-full mt16" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }} className="muted">
        Não tem conta?{' '}
        <Link href="/cadastro" style={{ color: 'var(--primary)' }}>Criar conta</Link>
      </p>
    </div>
  )
}

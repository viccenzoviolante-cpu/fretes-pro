'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return }
    setLoading(true)
    setErro('')
    const supabase = createClient()

    let trialDias = 7
    if (codigo.trim()) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('codigo', codigo.trim().toUpperCase())
        .eq('ativo', true)
        .single()

      if (!promo) {
        setErro('Código promocional inválido ou expirado')
        setLoading(false)
        return
      }
      if (promo.usos_max !== null && promo.usos_atual >= promo.usos_max) {
        setErro('Código promocional já atingiu o limite de usos')
        setLoading(false)
        return
      }
      trialDias = promo.trial_dias
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    })

    if (error) {
      setErro(error.message.includes('already registered') ? 'Email já cadastrado' : 'Erro ao criar conta. Tente novamente.')
      setLoading(false)
      return
    }

    // Se tinha código promo com trial diferente, atualiza
    if (codigo.trim() && data.user && trialDias !== 7) {
      const trialFim = new Date()
      trialFim.setDate(trialFim.getDate() + trialDias)
      await supabase
        .from('users')
        .update({ trial_fim: trialFim.toISOString() })
        .eq('id', data.user.id)
      // Incrementa uso
      await supabase
        .from('promo_codes')
        .update({ usos_atual: (await supabase.from('promo_codes').select('usos_atual').eq('codigo', codigo.trim().toUpperCase()).single()).data?.usos_atual ?? 0 + 1 })
        .eq('codigo', codigo.trim().toUpperCase())
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-card">
      <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <div className="brand-dot" />
        <span>FretesPro</span>
      </Link>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Criar conta</h2>
      <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>Comece grátis por 7 dias</p>

      {erro && <div className="alert-error">{erro}</div>}

      <form onSubmit={handleCadastro}>
        <div className="form-grid">
          <div className="field">
            <label>Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="field">
            <label>Código promocional <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <input type="text" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALEXANDRE30" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-full mt16" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }} className="muted">
        Já tem conta?{' '}
        <Link href="/login" style={{ color: 'var(--primary)' }}>Entrar</Link>
      </p>
    </div>
  )
}

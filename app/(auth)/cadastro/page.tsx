'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function CadastroForm() {
  const searchParams = useSearchParams()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [refCodigo, setRefCodigo] = useState('')
  const [refNome, setRefNome] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const c = searchParams.get('codigo') || searchParams.get('promo')
    if (c) setCodigo(c.toUpperCase())

    const ref = searchParams.get('ref')
    if (ref) {
      setRefCodigo(ref)
      const supabase = createClient()
      supabase.from('users').select('nome').ilike('id', `${ref}%`).single()
        .then(({ data }) => { if (data) setRefNome(data.nome || 'um caminhoneiro') })
    }
  }, [searchParams])

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return }
    setLoading(true)
    setErro('')
    const supabase = createClient()

    let trialDias = 14
    if (codigo.trim()) {
      const { data: promo } = await supabase.from('promo_codes').select('*')
        .eq('codigo', codigo.trim().toUpperCase()).eq('ativo', true).single()
      if (!promo) { setErro('Código promocional inválido ou expirado'); setLoading(false); return }
      if (promo.usos_max !== null && promo.usos_atual >= promo.usos_max) {
        setErro('Código promocional já atingiu o limite de usos'); setLoading(false); return
      }
      trialDias = promo.trial_dias
    }

    const { error, data } = await supabase.auth.signUp({
      email, password: senha, options: { data: { nome } },
    })

    if (error) {
      setErro(error.message.includes('already registered') ? 'Email já cadastrado' : 'Erro ao criar conta.')
      setLoading(false)
      return
    }
    if (!data.user) { setLoading(false); return }
    const userId = data.user.id

    // Aplicar trial do promo code
    if (codigo.trim() && trialDias !== 14) {
      const trialFim = new Date()
      trialFim.setDate(trialFim.getDate() + trialDias)
      await supabase.from('users').update({ trial_fim: trialFim.toISOString() }).eq('id', userId)
      const { data: p } = await supabase.from('promo_codes').select('usos_atual').eq('codigo', codigo.trim().toUpperCase()).single()
      if (p) await supabase.from('promo_codes').update({ usos_atual: p.usos_atual + 1 }).eq('codigo', codigo.trim().toUpperCase())
    }

    // Processar link de indicação
    if (refCodigo) {
      const { data: referrer } = await supabase.from('users').select('id').ilike('id', `${refCodigo}%`).single()
      if (referrer && referrer.id !== userId) {
        await supabase.from('users').update({ referred_by: referrer.id, desconto_referral: 10 }).eq('id', userId)
        await supabase.from('referrals').insert({
          referrer_id: referrer.id, referred_id: userId, status: 'pending', desconto_aplicado: 10,
        })
      }
    }

    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="auth-card">
      <Link href="/" className="brand" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <div className="brand-dot" /><span>FretesPro</span>
      </Link>

      {refNome && (
        <div style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>🎁 Convite de {refNome}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Você ganhou <strong style={{ color: 'var(--green)' }}>10% de desconto</strong> na primeira mensalidade ao assinar.</div>
        </div>
      )}

      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Criar conta</h2>
      <p className="muted" style={{ fontSize: '14px', marginBottom: '24px' }}>
        {refNome ? 'Comece grátis por 14 dias + 10% off no primeiro mês' : 'Comece grátis por 14 dias'}
      </p>

      {erro && <div className="alert-error">{erro}</div>}

      <form onSubmit={handleCadastro}>
        <div className="form-grid">
          <div className="field"><label>Nome</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome" /></div>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" /></div>
          <div className="field"><label>Senha</label><input type="password" value={senha} onChange={e => setSenha(e.target.value)} required placeholder="Mínimo 6 caracteres" /></div>
          {!refCodigo && (
            <div className="field">
              <label>Código promocional <span className="muted" style={{ fontWeight: 400 }}>(opcional)</span></label>
              <input type="text" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ex: ALEXANDRE30" />
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary btn-full mt16" disabled={loading}>
          {loading ? 'Criando conta...' : refNome ? 'Criar conta com 10% de desconto' : 'Criar conta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }} className="muted">
        Já tem conta? <Link href="/login" style={{ color: 'var(--primary)' }}>Entrar</Link>
      </p>
    </div>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="auth-card"><div className="empty">Carregando...</div></div>}>
      <CadastroForm />
    </Suspense>
  )
}

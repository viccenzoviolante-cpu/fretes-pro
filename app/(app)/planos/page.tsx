'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRow } from '@/types/database'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Periodo = 'mensal' | 'trimestral' | 'anual'
type Metodo  = 'PIX' | 'CREDIT_CARD'
type ModalStep = 'metodo' | 'cpf' | 'card' | 'pix' | 'card-ok'

const STARTER = {
  mensal:     { primeira: 67.90,  renovacao: 97.00,   regular: null   },
  trimestral: { primeira: 227.00, renovacao: 247.00,  regular: 291.00 },
  anual:      { primeira: 770.00, renovacao: 970.00,  regular: 1164.00},
}
const PRO = {
  mensal:     { primeira: 97.90,  renovacao: 127.00,  regular: null   },
  trimestral: { primeira: 287.00, renovacao: 324.00,  regular: 381.00 },
  anual:      { primeira: 970.00, renovacao: 1270.00, regular: 1524.00},
}

const STARTER_FEATURES = [
  'Registro de viagens e despesas',
  'Lucro real por corrida (diesel + pedágio)',
  'GPS e barra de progresso da viagem',
  'Relatórios com ranking de lucratividade',
  'Detalhe de despesas por viagem',
  'Meta financeira mensal',
  'Compartilhar resumo no WhatsApp',
  '5 temas visuais',
  'Melhores Fretes — 5 buscas/mês',
  'Salvar fretes favoritos',
]
const PRO_EXTRAS = [
  'Melhores Fretes — 10 buscas/dia',
  'Caminhões adicionais (R$47,90/mês cada)',
  'Suporte via WhatsApp',
  'Roleta diária Pro (em breve)',
]

export default function PlanosPage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<UserRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [periodo, setPeriodo]   = useState<Periodo>('mensal')

  // modal
  const [open, setOpen]               = useState(false)
  const [step, setStep]               = useState<ModalStep>('metodo')
  const [selectedPlano, setSelected]  = useState<'starter' | 'pro'>('pro')
  const [metodo, setMetodo]           = useState<Metodo>('PIX')
  const [cpf, setCpf]                 = useState('')
  const [card, setCard]               = useState({ holderName:'', number:'', expiryMonth:'', expiryYear:'', ccv:'', postalCode:'', addressNumber:'', phone:'' })
  const [err, setErr]                 = useState('')
  const [loading2, setLoading2]       = useState(false)
  const [pixData, setPixData]         = useState<{ pix_copia_e_cola:string; qrcode_base64:string; due_date:string; value:number } | null>(null)
  const [copied, setCopied]           = useState(false)

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (data) setProfile(data as UserRow)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])
  if (loading) return <div className="empty">Carregando...</div>

  const isPrimeira = profile?.plano === 'trial' || profile?.plano === 'expired'
  const isPago     = profile?.plano === 'active'
  const temDesc    = (profile?.desconto_referral || 0) > 0
  const pct        = profile?.desconto_referral || 0
  const diasTrial  = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0

  function precoStarter() {
    const p = STARTER[periodo]
    const base = isPrimeira ? p.primeira : p.renovacao
    return temDesc && periodo === 'mensal' ? Math.round(base * (1 - pct/100) * 100)/100 : base
  }
  function precoPro() {
    const p = PRO[periodo]
    const base = isPrimeira ? p.primeira : p.renovacao
    return temDesc && periodo === 'mensal' ? Math.round(base * (1 - pct/100) * 100)/100 : base
  }
  function porMes(p: 'starter'|'pro') {
    const meses = periodo === 'trimestral' ? 3 : periodo === 'anual' ? 12 : 1
    const preco = p === 'starter' ? precoStarter() : precoPro()
    return meses > 1 ? `${fmtBRL(preco/meses)}/mês` : ''
  }
  function economia(p: 'starter'|'pro') {
    const r = (p === 'starter' ? STARTER : PRO)[periodo].regular
    if (!r || periodo === 'mensal') return null
    return fmtBRL(r - (p === 'starter' ? precoStarter() : precoPro()))
  }
  function labelPeriodo() {
    if (periodo === 'mensal') return isPrimeira ? '1º mês' : '/mês'
    if (periodo === 'trimestral') return 'a cada 3 meses'
    return 'por ano'
  }

  function abrirModal(p: 'starter'|'pro') {
    setSelected(p); setStep('metodo'); setCpf(''); setErr(''); setPixData(null)
    setCard({ holderName:'', number:'', expiryMonth:'', expiryYear:'', ccv:'', postalCode:'', addressNumber:'', phone:'' })
    setOpen(true)
  }

  function fmtCpf(v: string) {
    const d = v.replace(/\D/g,'').slice(0,11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')
  }
  function fmtCard(v: string) {
    return v.replace(/\D/g,'').slice(0,16).replace(/(\d{4})/g,'$1 ').trim()
  }
  function fmtCep(v: string) {
    return v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2')
  }

  async function confirmar() {
    const cpfLimpo = cpf.replace(/\D/g,'')
    if (cpfLimpo.length !== 11) { setErr('CPF inválido'); return }
    if (metodo === 'CREDIT_CARD') {
      if (!card.holderName || card.number.replace(/\s/g,'').length < 13) { setErr('Número do cartão inválido'); return }
      if (!card.expiryMonth || !card.expiryYear || !card.ccv) { setErr('Dados de validade/CVV inválidos'); return }
      if (card.postalCode.replace(/\D/g,'').length < 8 || !card.addressNumber || !card.phone) { setErr('Preencha CEP, número e telefone'); return }
    }
    setErr(''); setLoading2(true)
    try {
      const resp = await fetch('/api/asaas/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: selectedPlano, periodo, metodo, cpf: cpfLimpo, card: metodo === 'CREDIT_CARD' ? card : undefined }),
      })
      const data = await resp.json()
      if (!resp.ok) { setErr(data.detail || data.error || 'Erro ao processar'); return }
      if (metodo === 'PIX') { setPixData(data); setStep('pix') }
      else { setStep('card-ok') }
    } catch { setErr('Erro de rede — tente novamente') }
    finally { setLoading2(false) }
  }

  function copiar() {
    if (!pixData?.pix_copia_e_cola) return
    navigator.clipboard.writeText(pixData.pix_copia_e_cola)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const preco = selectedPlano === 'starter' ? precoStarter() : precoPro()

  return (
    <>
      {/* cabeçalho */}
      <div className="page-header" style={{ textAlign:'center', marginBottom:'24px' }}>
        <div className="page-title">Planos</div>
        <div className="page-sub">
          {isPago ? 'Gerencie sua assinatura' : diasTrial > 0 ? `${diasTrial} dias de trial restantes` : 'Escolha seu plano'}
        </div>
      </div>

      {temDesc && !isPago && (
        <div style={{ background:'color-mix(in srgb, var(--green) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius:'12px', padding:'14px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'22px' }}>🎁</span>
          <div>
            <div style={{ fontWeight:700, color:'var(--green)', fontSize:'14px' }}>{pct}% de desconto na primeira mensalidade</div>
            <div style={{ fontSize:'12px', color:'var(--muted)' }}>Aplicado automaticamente por indicação.</div>
          </div>
        </div>
      )}

      {/* seletor período */}
      <div style={{ display:'flex', gap:'4px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px', padding:'4px', marginBottom:'24px' }}>
        {(['mensal','trimestral','anual'] as Periodo[]).map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{ flex:1, padding:'8px 4px', borderRadius:'7px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:600, background:periodo===p?'var(--primary)':'transparent', color:periodo===p?'#fff':'var(--muted)', transition:'all .15s', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
            {p.charAt(0).toUpperCase()+p.slice(1)}
            {p==='trimestral' && <span style={{ fontSize:'10px', opacity:.85 }}>15% off</span>}
            {p==='anual'      && <span style={{ fontSize:'10px', opacity:.85 }}>2 meses grátis</span>}
          </button>
        ))}
      </div>

      {/* cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px', marginBottom:'28px' }}>
        {/* STARTER */}
        <div className="card" style={{ opacity:isPago?.6:1 }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'10px' }}>Starter</div>
          {STARTER[periodo].regular && <div style={{ fontSize:'12px', color:'var(--muted)', textDecoration:'line-through', marginBottom:'2px' }}>{fmtBRL(STARTER[periodo].regular!)}</div>}
          <div style={{ fontSize:'26px', fontWeight:800, lineHeight:1, marginBottom:'2px' }}>{fmtBRL(precoStarter())}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'4px' }}>{labelPeriodo()}</div>
          {porMes('starter') && <div style={{ fontSize:'11px', color:'var(--green)', fontWeight:600, marginBottom:'4px' }}>{porMes('starter')}</div>}
          {economia('starter') && <div style={{ fontSize:'11px', color:'var(--green)', marginBottom:'12px' }}>Economia de {economia('starter')}</div>}
          {!isPago && <button className="btn btn-ghost btn-sm btn-full" onClick={() => abrirModal('starter')}>Assinar Starter</button>}
        </div>

        {/* PRO */}
        <div className="card" style={{ border:'2px solid var(--primary)', position:'relative' }}>
          <div style={{ position:'absolute', top:'-1px', right:'14px', background:'var(--primary)', color:'#fff', fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'0 0 8px 8px', letterSpacing:'.04em' }}>RECOMENDADO</div>
          <div style={{ fontSize:'12px', fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'10px' }}>Pro</div>
          {PRO[periodo].regular && <div style={{ fontSize:'12px', color:'var(--muted)', textDecoration:'line-through', marginBottom:'2px' }}>{fmtBRL(PRO[periodo].regular!)}</div>}
          <div style={{ fontSize:'26px', fontWeight:800, lineHeight:1, marginBottom:'2px' }}>{fmtBRL(precoPro())}</div>
          <div style={{ fontSize:'12px', color:'var(--muted)', marginBottom:'4px' }}>{labelPeriodo()}</div>
          {porMes('pro') && <div style={{ fontSize:'11px', color:'var(--green)', fontWeight:600, marginBottom:'4px' }}>{porMes('pro')}</div>}
          {economia('pro') && <div style={{ fontSize:'11px', color:'var(--green)', marginBottom:'12px' }}>Economia de {economia('pro')}</div>}
          {isPago ? (
            <div style={{ background:'color-mix(in srgb, var(--green) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius:'8px', padding:'8px', textAlign:'center', fontSize:'12px', fontWeight:700, color:'var(--green)' }}>✅ Plano ativo</div>
          ) : (
            <button className="btn btn-primary btn-sm btn-full" onClick={() => abrirModal('pro')}>
              {temDesc ? `Assinar com ${pct}% off` : 'Assinar Pro'}
            </button>
          )}
        </div>
      </div>

      {/* tabela features */}
      <div className="card">
        <div style={{ fontSize:'13px', fontWeight:700, marginBottom:'14px' }}>O que está incluído</div>
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }}>Starter + Pro</div>
        {STARTER_FEATURES.map(f => (
          <div key={f} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
            <span style={{ color:'var(--green)', fontSize:'15px', flexShrink:0 }}>✓</span>{f}
          </div>
        ))}
        <div style={{ fontSize:'12px', fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:'.05em', margin:'14px 0 8px' }}>Só no Pro</div>
        {PRO_EXTRAS.map(f => (
          <div key={f} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:'13px' }}>
            <span style={{ color:'var(--primary)', fontSize:'15px', flexShrink:0 }}>⭐</span>{f}
          </div>
        ))}
        <div style={{ marginTop:'14px', padding:'10px 14px', background:'var(--surface2)', borderRadius:'8px', fontSize:'12px', color:'var(--muted)' }}>
          Dados preservados por 30 dias após o vencimento. Cancele quando quiser.
        </div>
      </div>

      <div style={{ marginTop:'16px', padding:'16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', textAlign:'center' }}>
        <div style={{ fontSize:'14px', fontWeight:600, marginBottom:'4px' }}>💸 Indique e ganhe 1 mês grátis</div>
        <div style={{ fontSize:'12px', color:'var(--muted)' }}>Quando seu amigo assinar, você ganha 1 mês grátis. Ele recebe 10% off.</div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop:'10px' }} onClick={() => router.back()}>← Voltar</button>
      </div>

      {/* =================== MODAL =================== */}
      {open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setOpen(false)}>
          <div style={{ background:'var(--bg)', borderRadius:'20px 20px 0 0', padding:'28px 24px 36px', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>

            {/* STEP: escolher método */}
            {step === 'metodo' && (
              <>
                <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'6px' }}>
                  Assinar {selectedPlano === 'starter' ? 'Starter' : 'Pro'} — {fmtBRL(preco)}
                </div>
                <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'20px' }}>Como prefere pagar?</div>

                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
                  {([['PIX','💠 PIX — copia e cola','Código gerado na hora. Cole no app do banco.'],
                     ['CREDIT_CARD','💳 Cartão de crédito','Débito automático todo mês. Sem precisar pagar manualmente.']] as [Metodo,string,string][]).map(([m,label,desc]) => (
                    <button key={m} onClick={() => setMetodo(m)} style={{ padding:'14px 16px', borderRadius:'12px', border:`2px solid ${metodo===m?'var(--primary)':'var(--border)'}`, background:metodo===m?'color-mix(in srgb, var(--primary) 8%, transparent)':'var(--surface)', cursor:'pointer', textAlign:'left', transition:'all .15s' }}>
                      <div style={{ fontWeight:700, fontSize:'14px', color:metodo===m?'var(--primary)':'var(--text)', marginBottom:'2px' }}>{label}</div>
                      <div style={{ fontSize:'12px', color:'var(--muted)' }}>{desc}</div>
                    </button>
                  ))}
                </div>

                <button className="btn btn-primary btn-full" onClick={() => setStep('cpf')}>Continuar</button>
                <button className="btn btn-ghost btn-full" style={{ marginTop:'8px' }} onClick={() => setOpen(false)}>Cancelar</button>
              </>
            )}

            {/* STEP: CPF */}
            {step === 'cpf' && (
              <>
                <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'6px' }}>
                  {metodo === 'PIX' ? '💠 Pagamento via PIX' : '💳 Cartão de crédito'}
                </div>
                <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'20px' }}>{fmtBRL(preco)} — {labelPeriodo()}</div>

                <label style={{ fontSize:'12px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'6px' }}>SEU CPF</label>
                <input
                  type="text" inputMode="numeric" placeholder="000.000.000-00"
                  value={cpf} onChange={e => setCpf(fmtCpf(e.target.value))}
                  style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'15px', boxSizing:'border-box', marginBottom:'6px' }}
                />
                <div style={{ fontSize:'11px', color:'var(--muted)', marginBottom:'20px' }}>Necessário para emissão. Não armazenamos dados de pagamento.</div>

                {err && <div style={{ fontSize:'12px', color:'var(--red)', marginBottom:'12px' }}>{err}</div>}

                {metodo === 'PIX' ? (
                  <button className="btn btn-primary btn-full" onClick={confirmar} disabled={loading2}>{loading2 ? 'Gerando...' : 'Gerar código PIX'}</button>
                ) : (
                  <button className="btn btn-primary btn-full" onClick={() => { const r = cpf.replace(/\D/g,''); if(r.length!==11){setErr('CPF inválido');return}; setErr(''); setStep('card') }}>Continuar para dados do cartão</button>
                )}
                <button className="btn btn-ghost btn-full" style={{ marginTop:'8px' }} onClick={() => setStep('metodo')}>← Voltar</button>
              </>
            )}

            {/* STEP: dados do cartão */}
            {step === 'card' && (
              <>
                <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Dados do cartão</div>
                <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'18px' }}>{fmtBRL(preco)} cobrado agora e depois mensalmente</div>

                {[
                  ['Nome no cartão', 'text', 'holderName', 'NOME COMO NO CARTÃO', undefined] as const,
                  ['Número do cartão', 'text', 'number', '0000 0000 0000 0000', fmtCard] as const,
                ].map(([label, type, field, ph, fmt]) => (
                  <div key={field} style={{ marginBottom:'12px' }}>
                    <label style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'4px' }}>{label}</label>
                    <input type={type} inputMode={field==='number'?'numeric':undefined} placeholder={ph}
                      value={card[field]} onChange={e => setCard(c => ({ ...c, [field]: fmt ? fmt(e.target.value) : e.target.value }))}
                      style={{ width:'100%', padding:'11px 13px', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'14px', boxSizing:'border-box' }}
                    />
                  </div>
                ))}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'12px' }}>
                  {[['MM','expiryMonth','Mês'],['AAAA','expiryYear','Ano'],['CVV','ccv','CVV']].map(([ph,field,label]) => (
                    <div key={field}>
                      <label style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'4px' }}>{label}</label>
                      <input type="text" inputMode="numeric" placeholder={ph} maxLength={field==='expiryYear'?4:field==='ccv'?4:2}
                        value={card[field as keyof typeof card]} onChange={e => setCard(c => ({ ...c, [field]: e.target.value.replace(/\D/g,'') }))}
                        style={{ width:'100%', padding:'11px 10px', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'14px', boxSizing:'border-box' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ fontSize:'12px', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.04em', margin:'16px 0 10px' }}>Endereço de cobrança</div>

                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'10px', marginBottom:'12px' }}>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'4px' }}>CEP</label>
                    <input type="text" inputMode="numeric" placeholder="00000-000"
                      value={card.postalCode} onChange={e => setCard(c => ({ ...c, postalCode: fmtCep(e.target.value) }))}
                      style={{ width:'100%', padding:'11px 13px', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'14px', boxSizing:'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'4px' }}>Número</label>
                    <input type="text" inputMode="numeric" placeholder="123"
                      value={card.addressNumber} onChange={e => setCard(c => ({ ...c, addressNumber: e.target.value }))}
                      style={{ width:'100%', padding:'11px 13px', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'14px', boxSizing:'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom:'18px' }}>
                  <label style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', display:'block', marginBottom:'4px' }}>TELEFONE</label>
                  <input type="text" inputMode="numeric" placeholder="(00) 00000-0000"
                    value={card.phone} onChange={e => setCard(c => ({ ...c, phone: e.target.value }))}
                    style={{ width:'100%', padding:'11px 13px', borderRadius:'9px', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'14px', boxSizing:'border-box' }}
                  />
                </div>

                {err && <div style={{ fontSize:'12px', color:'var(--red)', marginBottom:'12px' }}>{err}</div>}

                <button className="btn btn-primary btn-full" onClick={confirmar} disabled={loading2}>
                  {loading2 ? 'Processando...' : `Assinar por ${fmtBRL(preco)}`}
                </button>
                <button className="btn btn-ghost btn-full" style={{ marginTop:'8px' }} onClick={() => setStep('cpf')}>← Voltar</button>
              </>
            )}

            {/* STEP: PIX gerado */}
            {step === 'pix' && pixData && (
              <>
                <div style={{ textAlign:'center', marginBottom:'16px' }}>
                  <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Código PIX gerado!</div>
                  <div style={{ fontSize:'13px', color:'var(--muted)' }}>{fmtBRL(pixData.value)} — vence em {pixData.due_date}</div>
                </div>

                {/* Código em texto — principal */}
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'14px', marginBottom:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:600, color:'var(--muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.04em' }}>Cole esse código no seu banco</div>
                  <div style={{ fontSize:'11px', wordBreak:'break-all', color:'var(--text)', lineHeight:'1.5', fontFamily:'monospace', userSelect:'all' }}>
                    {pixData.pix_copia_e_cola}
                  </div>
                </div>

                <button className="btn btn-primary btn-full" onClick={copiar} style={{ marginBottom:'10px' }}>
                  {copied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
                </button>

                {pixData.qrcode_base64 && (
                  <div style={{ display:'flex', justifyContent:'center', marginBottom:'12px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image/png;base64,${pixData.qrcode_base64}`} alt="QR Code PIX" style={{ width:'160px', height:'160px', borderRadius:'10px', border:'1px solid var(--border)' }} />
                  </div>
                )}

                <div style={{ fontSize:'11px', color:'var(--muted)', textAlign:'center', marginBottom:'14px' }}>
                  Após o pagamento, seu plano é ativado em até 2 minutos.
                </div>

                <button className="btn btn-ghost btn-full" onClick={() => setOpen(false)}>Fechar</button>
              </>
            )}

            {/* STEP: cartão aprovado */}
            {step === 'card-ok' && (
              <>
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
                  <div style={{ fontSize:'17px', fontWeight:700, marginBottom:'8px' }}>Assinatura ativada!</div>
                  <div style={{ fontSize:'13px', color:'var(--muted)', marginBottom:'24px' }}>Seu cartão será debitado automaticamente a cada renovação.</div>
                  <button className="btn btn-primary btn-full" onClick={() => { setOpen(false); router.push('/dashboard') }}>Ir para o dashboard</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}

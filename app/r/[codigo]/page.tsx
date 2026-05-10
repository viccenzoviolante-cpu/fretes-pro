import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { redirect } from 'next/navigation'

// Busca dados do indicador pelo prefixo do ID (8 chars)
async function getReferrer(codigo: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('users')
    .select('id, nome, modelo_caminhao, placa')
    .ilike('id', `${codigo}%`)
    .single()
  return data
}

export default async function ReferralPage({ params }: { params: { codigo: string } }) {
  const { codigo } = params

  if (!codigo || codigo.length < 6) redirect('/cadastro')

  const referrer = await getReferrer(codigo)
  if (!referrer) redirect('/cadastro')

  const nome = referrer.nome || 'um caminhoneiro'
  const caminhao = referrer.modelo_caminhao || 'seu caminhão'
  const placaMask = referrer.placa
    ? `***${referrer.placa.replace(/[-\s]/g, '').slice(-3)}`
    : null

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px' }} />
            FretesPro
          </div>
        </div>

        {/* Card principal */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>

          {/* Banner de indicação */}
          <div style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', padding: '20px 24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>
              🔗 Link de convite
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text)', lineHeight: '1.5' }}>
              <strong>{nome}</strong> está te convidando para o FretesPro
              {caminhao && <span style={{ color: 'var(--muted)' }}> — com o {caminhao}{placaMask ? ` (${placaMask})` : ''}</span>}
            </div>
          </div>

          {/* Desconto */}
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', background: 'color-mix(in srgb, var(--green) 15%, transparent)', border: '2px solid color-mix(in srgb, var(--green) 30%, transparent)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
                🎁
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)' }}>10% de desconto</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>na primeira mensalidade ao assinar</div>
              </div>
            </div>

            <div style={{ marginTop: '16px', background: 'var(--surface2)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Preço normal (1º mês)</span>
                <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>R$77,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
                <span>Com seu desconto</span>
                <span style={{ color: 'var(--green)' }}>R$69,30</span>
              </div>
            </div>
          </div>

          {/* O que é o FretesPro */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px' }}>O que você vai ter</div>
            {[
              { icon: '💰', text: 'Lucro real por corrida — diesel, pedágio e descontos calculados' },
              { icon: '🔍', text: 'Melhores fretes da sua região filtrados pelo seu caminhão' },
              { icon: '📊', text: 'Relatórios mensais com ranking de lucratividade' },
              { icon: '🎯', text: '14 dias gratuitos para testar tudo sem cartão' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', marginTop: '1px' }}>{icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.5' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ padding: '20px 24px' }}>
            <Link
              href={`/cadastro?ref=${codigo}`}
              style={{
                display: 'block', textAlign: 'center', background: 'var(--primary)', color: '#fff',
                padding: '14px', borderRadius: '10px', fontWeight: 700, fontSize: '15px',
                textDecoration: 'none', marginBottom: '12px',
              }}
            >
              Criar conta com 10% de desconto →
            </Link>
            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
              14 dias grátis · sem cartão · cancele quando quiser
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
          Já tem conta? <Link href="/login" style={{ color: 'var(--primary)' }}>Entrar</Link>
        </div>
      </div>
    </div>
  )
}

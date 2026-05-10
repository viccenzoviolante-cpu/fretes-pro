'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mesAtual, fmtBRL } from '@/lib/utils'
import { maskPlaca } from '@/types/database'
import type { Plano } from '@/types/database'

const NAV_BOTTOM = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/viagens', icon: '🚛', label: 'Viagens' },
  { href: '/despesas', icon: '💸', label: 'Despesas' },
  { href: '/relatorios', icon: '📈', label: 'Relatórios' },
  { href: '/corridas', icon: '🎯', label: 'Corridas' },
]

const NAV_SIDEBAR = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/viagens', icon: '🚛', label: 'Viagens' },
  { href: '/despesas', icon: '💸', label: 'Despesas' },
  { href: '/relatorios', icon: '📈', label: 'Relatórios' },
  { href: '/corridas', icon: '🎯', label: 'Corridas' },
]

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/viagens': 'Viagens',
  '/despesas': 'Despesas',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
  '/corridas': 'Corridas',
}

type Profile = {
  nome: string | null
  tema: string
  modelo_caminhao: string | null
  placa: string | null
  foto_perfil: string | null
  plano: Plano
  trial_fim: string
  meta_financeira: number | null
  corridas_usos: number
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // swipe da borda direita para abrir drawer
  useEffect(() => {
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      const dx = startX - e.changedTouches[0].clientX
      if (startX > window.innerWidth - 40 && dx > 50) setDrawerOpen(true)
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('users')
        .select('nome, tema, modelo_caminhao, placa, foto_perfil, plano, trial_fim, meta_financeira, corridas_usos')
        .eq('id', user.id)
        .single()
        .then(({ data }) => { if (data) setProfile(data as Profile) })
    })
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nome = profile?.nome || ''
  const inicial = (nome || 'M').charAt(0).toUpperCase()
  const primeiroNome = nome ? nome.split(' ')[0] : 'Motorista'
  const placaMasked = profile?.placa ? maskPlaca(profile.placa) : null
  const tema = profile?.tema || 'azul'
  const diasTrial = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0
  const planoLabel = profile?.plano === 'active' ? 'Pro ativo' : `Trial — ${diasTrial}d restantes`

  const AvatarImg = () => (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%',
      background: profile?.foto_perfil ? 'transparent' : 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
    }}>
      {profile?.foto_perfil
        ? <img src={profile.foto_perfil} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : inicial}
    </div>
  )

  return (
    <div className={`app-root${tema !== 'azul' ? ` tema-${tema}` : ''}`}>

      {/* SIDEBAR — desktop */}
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <div className="brand-dot" />
          FretesPro
        </Link>
        {NAV_SIDEBAR.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
          <span className="nav-icon">🚪</span>Sair
        </button>
      </aside>

      {/* COLUNA PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-title">{TITLES[pathname] || 'FretesPro'}</div>
          <div className="flex gap8" style={{ alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: '13px' }}>{mesAtual()}</span>

            {profile?.modelo_caminhao && placaMasked && (
              <div className="topbar-caminhao" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '4px 10px', fontSize: '12px',
              }}>
                <span>🚛</span>
                <span style={{ fontWeight: 600 }}>{profile.modelo_caminhao}</span>
                <span style={{ color: 'var(--muted)', letterSpacing: '1px' }}>{placaMasked}</span>
              </div>
            )}

            {/* AVATAR — dropdown desktop, drawer mobile */}
            <div className="avatar-wrap" ref={dropdownRef}>
              <div
                onClick={() => {
                  if (window.innerWidth < 600) setDrawerOpen(true)
                  else setDropdownOpen(v => !v)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <AvatarImg />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{primeiroNome}</span>
              </div>

              {/* DROPDOWN — desktop only */}
              {dropdownOpen && (
                <div className="avatar-dropdown">
                  <div className="avatar-dropdown-header">
                    <div className="avatar-dropdown-name">{nome || 'Motorista'}</div>
                    <div className="avatar-dropdown-plan">{planoLabel}</div>
                  </div>

                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/configuracoes') }}>
                    <span className="dropdown-item-icon">🎨</span>Personalizar app
                  </button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/configuracoes') }}>
                    <span className="dropdown-item-icon">👤</span>Informações do usuário
                  </button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/configuracoes') }}>
                    <span className="dropdown-item-icon">💳</span>Plano e pagamentos
                  </button>

                  <div className="dropdown-sep" />

                  <div style={{ padding: '8px 12px 6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Indique e ganhe</div>
                    <ReferralMini userId={null} />
                  </div>

                  <div className="dropdown-sep" />

                  <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
                    <span className="dropdown-item-icon">🚪</span>Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="content">{children}</div>
      </div>

      {/* BOTTOM NAV — mobile */}
      <nav className="bottom-nav">
        {NAV_BOTTOM.map(item => (
          <Link key={item.href} href={item.href} className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}>
            <span className="bnav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* DRAWER — mobile */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className={`drawer open`}>
            <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>

            {/* Header do drawer */}
            <div className="drawer-header">
              <div className="drawer-avatar">
                {profile?.foto_perfil
                  ? <img src={profile.foto_perfil} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : inicial}
              </div>
              <div>
                <div className="drawer-name">{nome || 'Motorista'}</div>
                <div className="drawer-plan">{planoLabel}</div>
              </div>
            </div>

            {/* Seção — App */}
            <div className="drawer-section">Aplicativo</div>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); router.push('/configuracoes') }}>
              <span className="drawer-item-icon">🎨</span>Personalizar app
            </button>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); router.push('/configuracoes') }}>
              <span className="drawer-item-icon">👤</span>Informações do usuário
            </button>

            {/* Seção — Plano */}
            <div className="drawer-section">Plano e pagamentos</div>
            <div style={{ padding: '0 16px 12px' }}>
              <PlanoCard plano={profile?.plano || 'trial'} diasTrial={diasTrial} onClose={() => setDrawerOpen(false)} />
            </div>

            {/* Seção — Indique */}
            <div className="drawer-section">Indique e ganhe</div>
            <div style={{ padding: '0 16px 16px' }}>
              <ReferralCard />
            </div>

            <div style={{ flex: 1 }} />
            <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
              <button className="drawer-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
                <span className="drawer-item-icon">🚪</span>Sair da conta
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PlanoCard({ plano, diasTrial, onClose }: { plano: Plano; diasTrial: number; onClose: () => void }) {
  const router = useRouter()
  if (plano === 'active') {
    return (
      <div style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '10px', padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>✅ Plano Pro ativo</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Todas as funcionalidades desbloqueadas</div>
      </div>
    )
  }
  return (
    <div style={{ background: 'color-mix(in srgb, var(--yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--yellow) 25%, transparent)', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>⏱️ Trial — {diasTrial} dias restantes</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 10px' }}>Assine para desbloquear Corridas Pro e continuar usando sem limite.</div>
      <button className="btn btn-primary btn-sm btn-full" onClick={() => { onClose(); router.push('/planos') }}>
        Ver planos →
      </button>
    </div>
  )
}

function ReferralCard() {
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [usos, setUsos] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const url = `${window.location.origin}/cadastro?ref=${user.id.slice(0, 8)}`
      setLink(url)
      supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_id', user.id).then(({ count }) => setUsos(count || 0))
    })
  }, [])

  function copiar() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div style={{ fontSize: '13px' }}>
      <div style={{ marginBottom: '8px', color: 'var(--text)' }}>
        Convide 5 amigos que usem por <strong>7 dias</strong> e ganhe <strong>1 mês grátis</strong> automaticamente.
      </div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {[1,2,3,4,5].map(n => (
          <div key={n} style={{ flex: 1, height: '6px', borderRadius: '3px', background: n <= usos ? 'var(--green)' : 'var(--border)' }} />
        ))}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>{usos} de 5 amigos indicados qualificados</div>
      <button className="btn btn-ghost btn-sm btn-full" onClick={copiar}>
        {copiado ? '✅ Link copiado!' : '🔗 Copiar link de convite'}
      </button>
    </div>
  )
}

function ReferralMini({ userId }: { userId: string | null }) {
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setLink(`${window.location.origin}/cadastro?ref=${user.id.slice(0, 8)}`)
    })
  }, [userId])

  function copiar() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
      Convide 5 amigos (7 dias de uso) → 1 mês grátis
      <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '8px' }} onClick={copiar}>
        {copiado ? '✅ Copiado!' : '🔗 Copiar link'}
      </button>
    </div>
  )
}

'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mesAtual } from '@/lib/utils'
import { maskPlaca } from '@/types/database'
import type { Plano, CaminhaoRow } from '@/types/database'
import RoletaModal from './RoletaModal'

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/viagens', icon: '🚛', label: 'Viagens' },
  { href: '/despesas', icon: '💸', label: 'Despesas' },
  { href: '/relatorios', icon: '📈', label: 'Relatórios' },
  { href: '/fretes', icon: '🔍', label: 'Fretes' },
]

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard', '/viagens': 'Viagens', '/despesas': 'Despesas',
  '/relatorios': 'Relatórios', '/configuracoes': 'Configurações',
  '/fretes': 'Melhores Fretes', '/planos': 'Planos', '/adicionar-caminhao': 'Adicionar Caminhão',
}

type Profile = {
  nome: string | null; tema: string; foto_perfil: string | null
  plano: Plano; trial_fim: string; meta_financeira: number | null; corridas_usos: number
}

const TRUCK_KEY = 'fretes_active_truck'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [caminhoes, setCaminhoes] = useState<CaminhaoRow[]>([])
  const [activeTruckId, setActiveTruckId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [truckPickerOpen, setTruckPickerOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const truckRef = useRef<HTMLDivElement>(null)

  // swipe borda direita → abre drawer
  useEffect(() => {
    let startX = 0
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onEnd = (e: TouchEvent) => {
      if (startX > window.innerWidth - 40 && startX - e.changedTouches[0].clientX > 50)
        setDrawerOpen(true)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd) }
  }, [])

  // fechar dropdowns ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
      if (truckRef.current && !truckRef.current.contains(e.target as Node)) setTruckPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(TRUCK_KEY)
    if (saved) setActiveTruckId(saved)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      Promise.all([
        supabase.from('users').select('nome, tema, foto_perfil, plano, trial_fim, meta_financeira, corridas_usos').eq('id', user.id).single(),
        supabase.from('caminhoes').select('*').eq('user_id', user.id).eq('plano_ativo', true).order('is_principal', { ascending: false }),
      ]).then(([{ data: p }, { data: c }]) => {
        if (p) setProfile(p as Profile)
        if (c && c.length > 0) {
          setCaminhoes(c as CaminhaoRow[])
          const savedId = localStorage.getItem(TRUCK_KEY)
          const valid = savedId && c.find(t => t.id === savedId)
          if (!valid) {
            const principal = c.find(t => t.is_principal) || c[0]
            setActiveTruckId(principal.id)
            localStorage.setItem(TRUCK_KEY, principal.id)
          }
        }
      })
    })
  }, [pathname])

  function selectTruck(id: string) {
    setActiveTruckId(id)
    localStorage.setItem(TRUCK_KEY, id)
    setTruckPickerOpen(false)
    setDrawerOpen(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const activeTruck = caminhoes.find(c => c.id === activeTruckId) || caminhoes[0] || null
  const nome = profile?.nome || ''
  const inicial = (nome || 'M').charAt(0).toUpperCase()
  const primeiroNome = nome ? nome.split(' ')[0] : 'Motorista'
  const tema = profile?.tema || 'azul'
  const diasTrial = profile?.trial_fim
    ? Math.max(0, Math.ceil((new Date(profile.trial_fim).getTime() - Date.now()) / 86400000))
    : 0
  const planoLabel = profile?.plano === 'active' ? '✅ Pro ativo' : `⏱️ Trial — ${diasTrial}d`
  const isTrial = profile?.plano !== 'active'
  const isExpired = profile?.plano === 'expired'
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [expiredDismissed, setExpiredDismissed] = useState(false)
  const [roletaOpen, setRoletaOpen] = useState(false)
  const showBanner = isTrial && !isExpired && diasTrial <= 7 && diasTrial > 0 && !bannerDismissed
  const bannerUrgente = diasTrial <= 3

  const Avatar = () => (
    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: profile?.foto_perfil ? 'transparent' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
      {profile?.foto_perfil ? <img src={profile.foto_perfil} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
    </div>
  )

  return (
    <div className={`app-root${tema !== 'azul' ? ` tema-${tema}` : ''}`}>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <Link href="/dashboard" className="brand"><div className="brand-dot" />FretesPro</Link>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>{item.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={() => setRoletaOpen(true)}>
          <span className="nav-icon">🎰</span>Roleta
        </button>
        <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
          <span className="nav-icon">🚪</span>Sair
        </button>
      </aside>

      {/* COLUNA PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div className="topbar">
          <div className="topbar-title">{TITLES[pathname] || 'FretesPro'}</div>
          <div className="flex gap8" style={{ alignItems: 'center', flexShrink: 0 }}>
            <span className="muted topbar-caminhao" style={{ fontSize: '13px' }}>{mesAtual()}</span>

            {/* BADGE TRIAL na topbar */}
            {isTrial && profile && (
              <button
                onClick={() => router.push('/planos')}
                style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: diasTrial <= 3 ? 'var(--red)' : diasTrial <= 7 ? 'color-mix(in srgb, var(--yellow) 20%, transparent)' : 'color-mix(in srgb, var(--primary) 15%, transparent)', color: diasTrial <= 3 ? '#fff' : diasTrial <= 7 ? 'var(--yellow)' : 'var(--primary)' }}
              >
                {diasTrial > 0 ? `⏱ ${diasTrial}d de trial` : '🔒 Trial expirado'}
              </button>
            )}

            {/* TRUCK BADGE — sempre clicável */}
            {activeTruck && (
              <div className="topbar-caminhao" ref={truckRef} style={{ position: 'relative' }}>
                <div
                  className="truck-badge"
                  onClick={() => setTruckPickerOpen(v => !v)}
                  title="Gerenciar caminhões"
                >
                  <span>🚛</span>
                  <span style={{ fontWeight: 600, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTruck.modelo}</span>
                  <span style={{ color: 'var(--muted)', letterSpacing: '1px' }}>{maskPlaca(activeTruck.placa)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '10px' }}>▾</span>
                </div>

                {truckPickerOpen && (
                  <div className="truck-picker">
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 12px 8px' }}>Meus caminhões</div>
                    {caminhoes.map(c => (
                      <div key={c.id} className={`truck-picker-item ${c.id === activeTruckId ? 'active' : ''}`} onClick={() => selectTruck(c.id)}>
                        <span>🚛</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.modelo}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{maskPlaca(c.placa)} · {c.carroceria || 'Sem carroceria'}</div>
                        </div>
                        {c.id === activeTruckId && <span style={{ fontSize: '14px' }}>✓</span>}
                      </div>
                    ))}
                    <div style={{ height: '1px', background: 'var(--border)', margin: '6px 8px' }} />
                    <div className="truck-picker-item" onClick={() => { setTruckPickerOpen(false); router.push('/adicionar-caminhao') }} style={{ color: 'var(--primary)' }}>
                      <span>➕</span>
                      <span style={{ fontWeight: 600 }}>Adicionar caminhão</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: 'auto' }}>R$47,90/mês</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AVATAR */}
            <div className="avatar-wrap" ref={dropdownRef}>
              <div onClick={() => { if (window.innerWidth < 600) setDrawerOpen(true); else setDropdownOpen(v => !v) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <Avatar />
                <span className="topbar-nome" style={{ fontSize: '13px', fontWeight: 500 }}>{primeiroNome}</span>
              </div>

              {dropdownOpen && (
                <div className="avatar-dropdown">
                  <div className="avatar-dropdown-header">
                    <div className="avatar-dropdown-name">{nome || 'Motorista'}</div>
                    <div className="avatar-dropdown-plan">{planoLabel}</div>
                  </div>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/configuracoes') }}><span className="dropdown-item-icon">🎨</span>Personalizar app</button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/configuracoes') }}><span className="dropdown-item-icon">👤</span>Informações do usuário</button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); router.push('/planos') }}><span className="dropdown-item-icon">💳</span>Plano e pagamentos</button>
                  <button className="dropdown-item" onClick={() => { setDropdownOpen(false); setRoletaOpen(true) }}><span className="dropdown-item-icon">🎰</span>Roleta diária</button>
                  {caminhoes.length > 1 && (
                    <>
                      <div className="dropdown-sep" />
                      <div style={{ padding: '4px 12px 6px', fontSize: '11px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Caminhões</div>
                      {caminhoes.map(c => (
                        <div key={c.id} className={`dropdown-item ${c.id === activeTruckId ? 'active' : ''}`} style={c.id === activeTruckId ? { color: 'var(--primary)' } : {}} onClick={() => { selectTruck(c.id); setDropdownOpen(false) }}>
                          <span className="dropdown-item-icon">🚛</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.modelo} · {maskPlaca(c.placa)}</span>
                          {c.id === activeTruckId && <span>✓</span>}
                        </div>
                      ))}
                    </>
                  )}
                  <div className="dropdown-sep" />
                  <div style={{ padding: '8px 12px 4px' }}><ReferralMini /></div>
                  <div className="dropdown-sep" />
                  <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}><span className="dropdown-item-icon">🚪</span>Sair da conta</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BANNER TRIAL EXPIRANDO */}
        {showBanner && (
          <div style={{ background: bannerUrgente ? 'color-mix(in srgb, var(--red) 12%, transparent)' : 'color-mix(in srgb, var(--yellow) 10%, transparent)', borderBottom: `1px solid ${bannerUrgente ? 'color-mix(in srgb, var(--red) 30%, transparent)' : 'color-mix(in srgb, var(--yellow) 30%, transparent)'}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', color: bannerUrgente ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>
              {bannerUrgente ? `🚨 Seu trial expira em ${diasTrial} dia${diasTrial > 1 ? 's' : ''}! Assine agora para não perder o acesso.` : `⏳ ${diasTrial} dias restantes de trial — assine e continue sem interrupção.`}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={() => router.push('/planos')}>Assinar →</button>
              <button onClick={() => setBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: '0 4px' }}>✕</button>
            </div>
          </div>
        )}

        <div className="content" style={{ position: 'relative' }}>
          {children}

          {/* OVERLAY PLANO EXPIRADO */}
          {isExpired && !expiredDismissed && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'color-mix(in srgb, var(--bg) 92%, transparent)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div className="card" style={{ maxWidth: '380px', width: '100%', textAlign: 'center', padding: '36px 28px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Seu acesso foi pausado</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '8px' }}>
                  Seu período de trial encerrou. Seus dados estão preservados por 30 dias.
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '28px' }}>
                  Assine agora e volte a registrar viagens, despesas e acompanhar seu lucro real.
                </div>
                <button
                  className="btn btn-primary btn-full"
                  style={{ fontSize: '15px', padding: '13px', marginBottom: '12px' }}
                  onClick={() => router.push('/planos')}
                >
                  Assinar por R$67,90 →
                </button>
                <button
                  onClick={() => setExpiredDismissed(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--muted)', textDecoration: 'underline' }}
                >
                  Ver meus dados (somente leitura)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}>
            <span className="bnav-icon">{item.icon}</span>{item.label}
          </Link>
        ))}
      </nav>

      {/* DRAWER mobile */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="drawer open">
            <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            <div className="drawer-header">
              <div className="drawer-avatar">{profile?.foto_perfil ? <img src={profile.foto_perfil} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}</div>
              <div><div className="drawer-name">{nome || 'Motorista'}</div><div className="drawer-plan">{planoLabel}</div></div>
            </div>

            <div className="drawer-section">Meus caminhões</div>
            {caminhoes.map(c => (
              <div key={c.id} className="drawer-item" style={c.id === activeTruckId ? { color: 'var(--primary)', fontWeight: 600 } : {}} onClick={() => selectTruck(c.id)}>
                <span className="drawer-item-icon">🚛</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.modelo}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{maskPlaca(c.placa)}</div>
                </div>
                {c.id === activeTruckId && <span>✓</span>}
              </div>
            ))}
            <div className="drawer-item" style={{ color: 'var(--primary)' }} onClick={() => { setDrawerOpen(false); router.push('/adicionar-caminhao') }}>
              <span className="drawer-item-icon">➕</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Adicionar caminhão</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>R$47,90/mês por caminhão</div>
              </div>
            </div>

            <div className="drawer-section">Aplicativo</div>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); router.push('/configuracoes') }}><span className="drawer-item-icon">🎨</span>Personalizar app</button>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); router.push('/configuracoes') }}><span className="drawer-item-icon">👤</span>Informações do usuário</button>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); setRoletaOpen(true) }}><span className="drawer-item-icon">🎰</span>Roleta diária</button>

            <div className="drawer-section">Plano e pagamentos</div>
            <div style={{ padding: '0 16px 12px' }}>
              <PlanoCard plano={profile?.plano || 'trial'} diasTrial={diasTrial} onClose={() => setDrawerOpen(false)} />
            </div>

            <div className="drawer-section">Indique e ganhe</div>
            <div style={{ padding: '0 16px 16px' }}><ReferralCard /></div>

            <div style={{ flex: 1 }} />
            <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
              <button className="drawer-item" onClick={handleLogout} style={{ color: 'var(--red)' }}><span className="drawer-item-icon">🚪</span>Sair da conta</button>
            </div>
          </div>
        </>
      )}
      <RoletaModal open={roletaOpen} onClose={() => setRoletaOpen(false)} />
    </div>
  )
}

function PlanoCard({ plano, diasTrial, onClose }: { plano: Plano; diasTrial: number; onClose: () => void }) {
  const router = useRouter()
  if (plano === 'active') return (
    <div style={{ background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 25%, transparent)', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>✅ Plano Pro ativo</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Todas as funcionalidades desbloqueadas</div>
    </div>
  )
  return (
    <div style={{ background: 'color-mix(in srgb, var(--yellow) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--yellow) 25%, transparent)', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--yellow)' }}>⏱️ Trial — {diasTrial} dias restantes</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 10px' }}>Assine para desbloquear Corridas Pro e continuar sem limite.</div>
      <button className="btn btn-primary btn-sm btn-full" onClick={() => { onClose(); router.push('/planos') }}>Ver planos →</button>
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
      setLink(`${window.location.origin}/r/${user.id.slice(0, 8)}`)
      supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_id', user.id).then(({ count }) => setUsos(count || 0))
    })
  }, [])

  function copiar() {
    navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  return (
    <div style={{ fontSize: '13px' }}>
      <div style={{ marginBottom: '10px', lineHeight: '1.5' }}>
        Convide amigos — quando <strong>pagarem o app</strong>, você ganha <strong>1 mês Starter grátis</strong>.
        Seu amigo ainda recebe <strong>10% off</strong> na primeira mensalidade.
      </div>
      {usos > 0 && <div style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '8px', fontWeight: 600 }}>✅ {usos} indicado{usos > 1 ? 's pagaram' : ' pagou'} — você ganhou {usos} mês{usos > 1 ? 'es' : ''} grátis</div>}
      <button className="btn btn-ghost btn-sm btn-full" onClick={copiar}>{copiado ? '✅ Link copiado!' : '🔗 Copiar link de convite'}</button>
    </div>
  )
}

function ReferralMini() {
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setLink(`${window.location.origin}/r/${user.id.slice(0, 8)}`)
    })
  }, [])

  function copiar() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  return (
    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
      Amigo paga → você ganha 1 mês grátis · ele ganha 10% off
      <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '8px' }} onClick={copiar}>{copiado ? '✅ Copiado!' : '🔗 Copiar link'}</button>
    </div>
  )
}


'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mesAtual } from '@/lib/utils'
import { maskPlaca } from '@/types/database'

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/viagens', icon: '🚛', label: 'Viagens' },
  { href: '/despesas', icon: '💸', label: 'Despesas' },
  { href: '/relatorios', icon: '📈', label: 'Relatórios' },
  { href: '/configuracoes', icon: '⚙️', label: 'Config' },
]

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/viagens': 'Viagens',
  '/despesas': 'Despesas',
  '/relatorios': 'Relatórios',
  '/configuracoes': 'Configurações',
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [tema, setTema] = useState('azul')
  const [modelo, setModelo] = useState('')
  const [placa, setPlaca] = useState('')
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('users')
        .select('nome, tema, modelo_caminhao, placa, foto_perfil')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setNome(data.nome || '')
            setTema(data.tema || 'azul')
            setModelo(data.modelo_caminhao || '')
            setPlaca(data.placa || '')
            setFotoPerfil(data.foto_perfil || null)
          }
        })
    })
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const inicial = (nome || 'M').charAt(0).toUpperCase()
  const primeiroNome = nome ? nome.split(' ')[0] : 'Motorista'
  const placaMasked = placa ? maskPlaca(placa) : null

  return (
    <div className={`app-root${tema !== 'azul' ? ` tema-${tema}` : ''}`}>

      {/* SIDEBAR — desktop */}
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <div className="brand-dot" />
          FretesPro
        </Link>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
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

            {/* Info do caminhão — some no mobile via CSS */}
            {modelo && placaMasked && (
              <div className="topbar-caminhao" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '4px 10px', fontSize: '12px',
              }}>
                <span style={{ fontSize: '14px' }}>🚛</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{modelo}</span>
                <span style={{ color: 'var(--muted)', letterSpacing: '1px' }}>{placaMasked}</span>
              </div>
            )}

            {/* Avatar */}
            <div
              onClick={() => router.push('/configuracoes')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: fotoPerfil ? 'transparent' : 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {fotoPerfil
                  ? <img src={fotoPerfil} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : inicial
                }
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{primeiroNome}</span>
            </div>
          </div>
        </div>

        {/* CONTEÚDO — único elemento que faz scroll */}
        <div className="content">{children}</div>
      </div>

      {/* BOTTOM NAV — mobile only */}
      <nav className="bottom-nav">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <span className="bnav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

    </div>
  )
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/cadastro')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isReferralPage = pathname.startsWith('/r/')

  if (!user && !isAuthPage && !isReferralPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (isReferralPage) return supabaseResponse

  if (user && !isAuthPage && !isOnboarding) {
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_completo, plano, trial_fim, plano_fim')
      .eq('id', user.id)
      .single()

    if (userData && !userData.onboarding_completo) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    if (userData) {
      let plano = userData.plano

      // Trial expirado → atualizar no DB e tratar como expired
      if (plano === 'trial' && userData.trial_fim && new Date(userData.trial_fim) < new Date()) {
        await supabase.from('users').update({ plano: 'expired' }).eq('id', user.id)
        plano = 'expired'
      }

      // Plano ativo expirado → idem
      if (plano === 'active' && userData.plano_fim && new Date(userData.plano_fim) < new Date()) {
        await supabase.from('users').update({ plano: 'expired' }).eq('id', user.id)
        plano = 'expired'
      }

      if (plano === 'expired') {
        // Bloquear mutações nas rotas de API de escrita
        const isWriteRoute =
          request.method === 'POST' &&
          (pathname.startsWith('/api/viagens') ||
            pathname.startsWith('/api/despesas') ||
            pathname.startsWith('/api/relatorios') ||
            pathname.startsWith('/api/caminhoes') ||
            pathname.startsWith('/api/roleta'))

        if (isWriteRoute) {
          return NextResponse.json({ error: 'Plano expirado' }, { status: 403 })
        }

        // Redirecionar páginas de app para /planos (exceto as permitidas)
        const isAllowedWhileExpired =
          pathname.startsWith('/planos') ||
          pathname.startsWith('/configuracoes') ||
          pathname.startsWith('/dashboard') ||
          pathname.startsWith('/api/')

        if (!isAllowedWhileExpired) {
          return NextResponse.redirect(new URL('/planos', request.url))
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

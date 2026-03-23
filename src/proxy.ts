import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // MUST call getUser() not getSession() -- validates JWT against Supabase public keys
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/reset-password') ||
    request.nextUrl.pathname.startsWith('/check-email')

  const isProtected = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/account') ||
    request.nextUrl.pathname.startsWith('/api/proposals') ||
    request.nextUrl.pathname.startsWith('/api/generate') ||
    request.nextUrl.pathname.startsWith('/api/billing')

  // Redirect unauthenticated users to login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)$).*)'],
}

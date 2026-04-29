'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface PageHeaderProps {
  userEmail?: string | null
}

const NAV_LINKS = [
  { href: '/dashboard',        label: 'Dashboard' },
  { href: '/proposals',        label: 'Proposals' },
  { href: '/past-performance', label: 'Past Performance' },
  { href: '/analytics',        label: 'Analytics' },
  { href: '/team',             label: 'Team' },
  { href: '/profile',          label: 'Profile' },
  { href: '/help',             label: 'Help' },
]

function initials(email: string | null | undefined): string {
  if (!email) return 'U'
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function PageHeader({ userEmail }: PageHeaderProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#1A1D21] border-b border-[#2E3238] flex items-center px-4 gap-6">
        {/* Avero Wordmark */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 shrink-0 select-none"
          aria-label="Avero GovRFP — home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avero-logo.svg" alt="Avero" style={{ height: 48, width: 'auto', display: 'block' }} />
          <span className="text-[#F5F5F7] font-bold text-sm leading-none tracking-widest uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            GovRFP
          </span>
        </Link>

        {/* Nav links — centered (desktop only) */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'relative px-3 py-1.5 text-sm font-medium font-sans transition-colors duration-150 rounded-md',
                  isActive
                    ? 'text-[#F5F5F7]'
                    : 'text-[#C0C2C6] hover:text-[#F5F5F7]',
                ].join(' ')}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: '#FF1A1A' }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="shrink-0 ml-auto flex items-center gap-2">
          {/* Hamburger — mobile */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 text-[#C0C2C6]"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold font-sans hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1A1A]/60"
              style={{ background: '#FF1A1A' }}
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {initials(userEmail)}
            </button>

            {menuOpen && (
              <div className="absolute top-10 right-0 w-52 bg-[#1A1D21] border border-[#2E3238] rounded-xl shadow-xl py-1 z-50">
                {userEmail && (
                  <div className="px-3 py-2 border-b border-[#2E3238]">
                    <p className="text-xs text-[#C0C2C6] truncate font-sans">{userEmail}</p>
                  </div>
                )}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-[#C0C2C6] hover:text-[#F5F5F7] hover:bg-[#22262B] transition-colors font-sans"
                >
                  Account Settings
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-[#C0C2C6] hover:text-[#F5F5F7] hover:bg-[#22262B] transition-colors font-sans"
                >
                  Profile
                </Link>
                <div className="border-t border-[#2E3238] mt-1 pt-1">
                  <Link
                    href="/auth/signout"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#22262B] transition-colors font-sans"
                  >
                    Sign out
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileNavOpen(false)}>
          <nav
            className="absolute top-14 left-0 right-0 bg-[#1A1D21] border-b border-[#2E3238]"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'block px-4 py-3 text-sm font-medium font-sans border-b border-[#2E3238] transition-colors',
                    isActive ? 'text-[#FF1A1A]' : 'text-[#C0C2C6] hover:text-[#F5F5F7]',
                  ].join(' ')}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
    </>
  )
}

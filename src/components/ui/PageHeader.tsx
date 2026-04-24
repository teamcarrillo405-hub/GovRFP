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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-black border-b border-gray-800 flex items-center px-4 gap-6">
        {/* HCC Wordmark */}
        <Link
          href="/dashboard"
          className="flex items-center gap-0 shrink-0 select-none"
          aria-label="HCC ProposalAI — home"
        >
          <span className="text-[#FDFF66] font-black text-base leading-none tracking-tight font-sans">
            HCC
          </span>
          <span className="text-white font-bold text-base leading-none ml-1 font-sans">
            ProposalAI
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
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white',
                ].join(' ')}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#FDFF66] rounded-full"
                    aria-hidden="true"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side: hamburger (mobile) + user menu */}
        <div className="shrink-0 ml-auto flex items-center gap-2">
          {/* Hamburger button — mobile only */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 text-white"
            onClick={() => setMobileNavOpen((o) => !o)}
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? (
              /* X icon */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              /* Hamburger icon */
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          {/* User menu — right */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#FDFF66] text-black text-xs font-black font-sans hover:brightness-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFF66]/60"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {initials(userEmail)}
            </button>

            {menuOpen && (
              <div className="absolute top-10 right-0 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50">
                {userEmail && (
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400 truncate font-sans">{userEmail}</p>
                  </div>
                )}
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors font-sans"
                >
                  Account Settings
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors font-sans"
                >
                  Profile
                </Link>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <Link
                    href="/auth/signout"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors font-sans"
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
            className="absolute top-14 left-0 right-0 bg-black border-b border-gray-800"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="sr-only"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close"
            >
              Close
            </button>
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'block px-4 py-3 text-sm font-medium font-sans border-b border-gray-800 transition-colors',
                    isActive ? 'text-[#FDFF66]' : 'text-gray-300 hover:text-white',
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

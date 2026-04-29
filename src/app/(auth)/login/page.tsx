'use client'
import { useState } from 'react'
import { loginAction } from './actions'
import Link from 'next/link'
import { HolographicVizClient as HolographicViz } from '@/components/3d/HolographicVizClient'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(event.currentTarget)
    const result = await loginAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0B0B0D',
      position: 'relative',
      overflow: 'hidden',
    }}
      className="cmd-grid"
    >
      {/* Background 3D holographic orb */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: 0.5,
        pointerEvents: 'none',
      }}>
        <HolographicViz />
      </div>

      {/* HUD corner accents */}
      <div style={{ position: 'absolute', top: 24, left: 24, width: 20, height: 20, borderTop: '1px solid rgba(255,26,26,0.4)', borderLeft: '1px solid rgba(255,26,26,0.4)' }} />
      <div style={{ position: 'absolute', top: 24, right: 24, width: 20, height: 20, borderTop: '1px solid rgba(255,26,26,0.4)', borderRight: '1px solid rgba(255,26,26,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 24, left: 24, width: 20, height: 20, borderBottom: '1px solid rgba(255,26,26,0.4)', borderLeft: '1px solid rgba(255,26,26,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 24, right: 24, width: 20, height: 20, borderBottom: '1px solid rgba(255,26,26,0.4)', borderRight: '1px solid rgba(255,26,26,0.4)' }} />

      {/* Login card */}
      <div
        className="panel-enter"
        style={{
          width: '100%', maxWidth: 400,
          position: 'relative', zIndex: 10,
          background: 'rgba(26, 29, 33, 0.82)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          border: '1px solid rgba(192, 194, 198, 0.12)',
          borderRadius: 14,
          padding: '38px 32px',
          boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,26,26,0.06) inset',
          margin: '16px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avero-logo.svg" alt="Avero" style={{ height: 64, width: 'auto', display: 'block' }} />
          <div>
            <span style={{
              color: '#F5F5F7', fontWeight: 700, fontSize: 15,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'block',
            }}>
              GovRFP
            </span>
            <span style={{
              fontSize: 9, color: '#D4AF37',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.10em',
            }}>
              COMMAND · ACCESS
            </span>
          </div>
        </div>

        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#F5F5F7',
          marginBottom: 6,
          fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.04em',
        }}>
          AUTHENTICATE
        </h1>
        <p style={{ fontSize: 12, color: '#C0C2C6', marginBottom: 28, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
          ENTER CREDENTIALS TO ACCESS SYSTEM
        </p>

        {error && (
          <div style={{
            marginBottom: 20, padding: '10px 14px',
            background: 'rgba(255,26,26,0.08)',
            border: '1px solid rgba(255,26,26,0.25)',
            borderRadius: 6, color: '#FF6B6B', fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="email" style={{
              display: 'block', fontSize: 9, fontWeight: 700,
              color: '#C0C2C6', marginBottom: 7,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Email Address
            </label>
            <input
              id="email" name="email" type="email" required
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(11,11,13,0.6)',
                border: '1px solid rgba(192,194,198,0.15)',
                borderRadius: 6, color: '#F5F5F7', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: "'IBM Plex Mono', monospace",
                transition: 'border-color 0.15s linear',
              }}
              placeholder="user@agency.gov"
            />
          </div>

          <div>
            <label htmlFor="password" style={{
              display: 'block', fontSize: 9, fontWeight: 700,
              color: '#C0C2C6', marginBottom: 7,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              Password
            </label>
            <input
              id="password" name="password" type="password" required
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(11,11,13,0.6)',
                border: '1px solid rgba(192,194,198,0.15)',
                borderRadius: 6, color: '#F5F5F7', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: "'IBM Plex Mono', monospace",
                transition: 'border-color 0.15s linear',
              }}
              placeholder="••••••••"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href="/reset-password" style={{
              fontSize: 11, color: '#C0C2C6', textDecoration: 'none',
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: '0.04em',
            }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px 16px',
              background: loading ? '#B30000' : '#FF1A1A',
              color: '#fff', fontWeight: 700, fontSize: 12,
              border: 'none', borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s linear',
              letterSpacing: '0.14em',
              fontFamily: "'Oxanium', sans-serif",
              textTransform: 'uppercase',
              boxShadow: loading ? 'none' : '0 0 20px rgba(255,26,26,0.25)',
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: '#FF1A1A', fontWeight: 600, textDecoration: 'none' }}>
            REQUEST ACCESS
          </Link>
        </p>
      </div>
    </div>
  )
}

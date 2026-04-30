'use client'

import { useState, useEffect } from 'react'
import { createAddinClient } from '@/lib/addin/supabase-client'
import { WriteTab } from './WriteTab'
import { ComplianceTab } from './ComplianceTab'
import { HistoryTab } from './HistoryTab'
import { LibraryTab } from './LibraryTab'

type Tab = 'write' | 'compliance' | 'history' | 'library'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'write', label: 'Write' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'history', label: 'History' },
  { id: 'library', label: 'Library' },
]

const S = {
  shell: { display: 'flex', flexDirection: 'column' as const, height: '100vh', background: '#0B0B0D' },
  header: { padding: '12px 16px 0', borderBottom: '1px solid rgba(192,194,198,0.1)', flexShrink: 0 },
  brand: { fontSize: 13, fontWeight: 800, fontFamily: "'Oxanium', 'Space Grotesk', sans-serif", letterSpacing: '0.06em', color: '#FF1A1A', marginBottom: 10 },
  tabs: { display: 'flex', gap: 0 },
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 4px',
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #FF1A1A' : '2px solid transparent',
    color: active ? '#F5F5F7' : 'rgba(192,194,198,0.4)',
    transition: 'color 0.12s, border-color 0.12s',
  }),
  content: { flex: 1, overflowY: 'auto' as const, padding: 16 },
  loginWrap: { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', height: '100vh', padding: '0 24px' },
  loginTitle: { fontSize: 20, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', marginBottom: 4 },
  loginSub: { fontSize: 12, color: 'rgba(192,194,198,0.5)', marginBottom: 24 },
  input: {
    width: '100%',
    background: 'rgba(11,11,13,0.6)',
    border: '1px solid rgba(192,194,198,0.18)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    color: '#F5F5F7',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 10,
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  btn: {
    width: '100%',
    background: '#FF1A1A',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'Oxanium', sans-serif",
    letterSpacing: '0.08em',
    cursor: 'pointer',
    marginBottom: 8,
  },
  err: { fontSize: 11, color: '#FF4D4F', fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 },
  signout: { fontSize: 10, color: 'rgba(192,194,198,0.35)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", padding: 0 } as React.CSSProperties,
}

export function AddinShell() {
  const [officeReady, setOfficeReady] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('write')

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Office) {
      (window as any).Office.onReady(() => setOfficeReady(true))
    } else {
      setOfficeReady(true)
    }
  }, [])

  useEffect(() => {
    if (!officeReady) return
    const sb = createAddinClient()
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setAccessToken(data.session.access_token)
    })
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [officeReady])

  async function handleLogin() {
    setLoggingIn(true)
    setLoginError('')
    const sb = createAddinClient()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) {
      setLoginError(error.message)
    } else {
      setAccessToken(data.session?.access_token ?? null)
    }
    setLoggingIn(false)
  }

  async function handleSignOut() {
    const sb = createAddinClient()
    await sb.auth.signOut()
    setAccessToken(null)
  }

  if (!officeReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(192,194,198,0.35)', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
        Loading Office.js...
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div style={S.loginWrap}>
        <div style={S.loginTitle}>GovTool Writer</div>
        <div style={S.loginSub}>Sign in to your GovTool account</div>
        <input
          style={S.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        <input
          style={S.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        <button style={S.btn} onClick={handleLogin} disabled={loggingIn}>
          {loggingIn ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
        {loginError && <div style={S.err}>{loginError}</div>}
      </div>
    )
  }

  return (
    <div style={S.shell}>
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={S.brand}>GOVTOOL</div>
          <button style={S.signout} onClick={handleSignOut}>sign out</button>
        </div>
        <div style={S.tabs}>
          {TAB_LABELS.map(t => (
            <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={S.content}>
        {activeTab === 'write' && <WriteTab accessToken={accessToken} />}
        {activeTab === 'compliance' && <ComplianceTab accessToken={accessToken} />}
        {activeTab === 'history' && <HistoryTab accessToken={accessToken} />}
        {activeTab === 'library' && <LibraryTab accessToken={accessToken} />}
      </div>
    </div>
  )
}

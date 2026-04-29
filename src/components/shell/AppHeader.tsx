'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

interface AppHeaderProps {
  userInitials?: string;
}

export function AppHeader({ userInitials = 'GC' }: AppHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        height: 52,
        background: 'rgba(11, 11, 13, 0.92)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderBottom: '1px solid rgba(192, 194, 198, 0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, textDecoration: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/avero-logo.svg" alt="Avero" style={{ height: 56, width: 'auto', display: 'block' }} />
        <span style={{
          color: '#F5F5F7', fontWeight: 700, fontSize: 14,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          GovRFP
        </span>
      </Link>

      {/* System status indicator */}
      <div style={{
        marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 10px',
        border: '1px solid rgba(0, 196, 140, 0.25)',
        borderRadius: 3,
        flexShrink: 0,
      }}>
        <div className="hud-dot" style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#00C48C',
          boxShadow: '0 0 6px rgba(0,196,140,0.7)',
        }} />
        <span style={{
          fontSize: 9, fontWeight: 600,
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#00C48C', letterSpacing: '0.10em',
        }}>
          SYS LIVE
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Notification bell */}
      <button
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(192,194,198,0.7)',
          display: 'flex', alignItems: 'center',
          padding: '6px 8px', borderRadius: 6,
          transition: 'color 0.15s linear',
        }}
        aria-label="Notifications"
      >
        <Bell size={14} strokeWidth={1.5} />
      </button>

      {/* User avatar */}
      <div
        style={{
          width: 28, height: 28,
          background: 'rgba(255, 26, 26, 0.15)',
          border: '1px solid rgba(255, 26, 26, 0.35)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#FF1A1A',
          cursor: 'pointer', flexShrink: 0,
          letterSpacing: '0.04em',
        }}
      >
        {userInitials}
      </div>
    </header>
  );
}

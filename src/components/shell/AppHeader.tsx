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
        background: '#0B1220',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Monogram */}
      <div
        style={{
          width: 28,
          height: 28,
          background: '#2F80FF',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 13,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        A
      </div>

      {/* Wordmark */}
      <Link
        href="/dashboard"
        style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '-0.01em',
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        Avero GovTool
      </Link>

      <div style={{ flex: 1 }} />

      {/* Notification bell */}
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9AA4B2',
          display: 'flex',
          alignItems: 'center',
          padding: 6,
          borderRadius: 6,
        }}
        aria-label="Notifications"
      >
        <Bell size={15} strokeWidth={1.5} />
      </button>

      {/* User avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          background: '#263447',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#9AA4B2',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {userInitials}
      </div>
    </header>
  );
}

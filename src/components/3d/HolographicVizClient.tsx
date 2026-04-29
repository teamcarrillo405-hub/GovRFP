'use client'
import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'

const HolographicViz = dynamic(
  () => import('./HolographicViz').then(m => ({ default: m.HolographicViz })),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(212,175,55,0.4)', fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}>
          RENDERING MATRIX...
        </span>
      </div>
    ),
  }
)

interface Props {
  style?: CSSProperties
  className?: string
  nodeCount?: number
  winRate?: number
}

export function HolographicVizClient({ style, className, nodeCount, winRate }: Props) {
  return <HolographicViz style={style} className={className} nodeCount={nodeCount} winRate={winRate} />
}

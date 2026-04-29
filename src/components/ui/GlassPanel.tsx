import { type ReactNode, type CSSProperties, type HTMLAttributes } from 'react'

type GlassPanelVariant = 'default' | 'accent' | 'gold'

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: GlassPanelVariant
  noPad?: boolean
}

const styles: Record<GlassPanelVariant, CSSProperties> = {
  default: {
    background: 'rgba(26, 29, 33, 0.72)',
    backdropFilter: 'blur(20px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
    border: '1px solid rgba(192, 194, 198, 0.1)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  },
  accent: {
    background: 'rgba(26, 29, 33, 0.72)',
    backdropFilter: 'blur(20px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
    border: '1px solid rgba(255, 26, 26, 0.22)',
    borderRadius: 12,
    boxShadow: '0 0 24px rgba(255, 26, 26, 0.07) inset, 0 8px 32px rgba(0,0,0,0.5)',
  },
  gold: {
    background: 'rgba(26, 29, 33, 0.72)',
    backdropFilter: 'blur(20px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.05) inset, 0 8px 32px rgba(0,0,0,0.5)',
  },
}

export function GlassPanel({
  children,
  variant = 'default',
  noPad,
  className = '',
  style,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={['panel-enter', className].join(' ')}
      style={{ ...styles[variant], padding: noPad ? 0 : undefined, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}

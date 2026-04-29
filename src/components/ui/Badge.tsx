import { type ReactNode } from 'react'

type StatusVariant = 'draft' | 'processing' | 'analyzed' | 'ready' | 'shared'
type SeverityVariant = 'go' | 'caution' | 'no-go'
type SetAsideVariant = 'set-aside'

type BadgeVariant = StatusVariant | SeverityVariant | SetAsideVariant

interface BadgeProps {
  variant: BadgeVariant
  children?: ReactNode
  dot?: boolean
  className?: string
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  draft: {
    bg:   'bg-gray-100',
    text: 'text-gray-600',
    dot:  'bg-gray-400',
  },
  processing: {
    bg:   'bg-[#22262B]',
    text: 'text-[#C0C2C6]',
    dot:  'bg-[#C0C2C6]',
  },
  analyzed: {
    bg:   'bg-[#FF1A1A]/10',
    text: 'text-[#B30000]',
    dot:  'bg-[#FF1A1A]',
  },
  ready: {
    bg:   'bg-green-50',
    text: 'text-green-700',
    dot:  'bg-green-500',
  },
  shared: {
    bg:   'bg-gray-100',
    text: 'text-gray-600',
    dot:  'bg-gray-400',
  },
  go: {
    bg:   'bg-green-50',
    text: 'text-green-700',
    dot:  'bg-green-500',
  },
  caution: {
    bg:   'bg-amber-50',
    text: 'text-amber-700',
    dot:  'bg-amber-500',
  },
  'no-go': {
    bg:   'bg-red-50',
    text: 'text-red-600',
    dot:  'bg-red-500',
  },
  'set-aside': {
    bg:   'bg-[#D4AF37]/10',
    text: 'text-[#9A7A10]',
    dot:  'bg-[#D4AF37]',
  },
}

const defaultLabels: Partial<Record<BadgeVariant, string>> = {
  draft:      'Draft',
  processing: 'Processing',
  analyzed:   'Analyzed',
  ready:      'Ready',
  shared:     'Shared',
  go:         'Go',
  caution:    'Caution',
  'no-go':    'No-Go',
}

export function Badge({ variant, children, dot = true, className = '' }: BadgeProps) {
  const cfg = variantConfig[variant]
  const label = children ?? defaultLabels[variant]

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold font-sans',
        cfg.bg,
        cfg.text,
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={['w-1.5 h-1.5 rounded-full shrink-0', cfg.dot].join(' ')}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  )
}

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
    bg:   'bg-blue-50',
    text: 'text-blue-700',
    dot:  'bg-blue-500',
  },
  analyzed: {
    bg:   'bg-[#FDFF66]/20',
    text: 'text-yellow-700',
    dot:  'bg-[#FDFF66]',
  },
  ready: {
    bg:   'bg-green-50',
    text: 'text-green-700',
    dot:  'bg-green-500',
  },
  shared: {
    bg:   'bg-purple-50',
    text: 'text-purple-700',
    dot:  'bg-purple-500',
  },
  go: {
    bg:   'bg-green-50',
    text: 'text-green-700',
    dot:  'bg-green-500',
  },
  caution: {
    bg:   'bg-orange-50',
    text: 'text-[#ff7b20]',
    dot:  'bg-[#ff7b20]',
  },
  'no-go': {
    bg:   'bg-red-50',
    text: 'text-red-600',
    dot:  'bg-red-500',
  },
  'set-aside': {
    bg:   'bg-[#FDFF66]/20',
    text: 'text-yellow-700',
    dot:  'bg-[#FDFF66]',
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

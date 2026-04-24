'use client'

export type ColorTeamStatus = 'white' | 'pink' | 'red' | 'gold' | 'final'

interface Props {
  status: ColorTeamStatus
  size?: 'sm' | 'md'
}

const DOT_COLOR: Record<ColorTeamStatus, string> = {
  white: 'bg-gray-300',
  pink:  'bg-pink-400',
  red:   'bg-red-500',
  gold:  'bg-yellow-500',
  final: 'bg-green-500',
}

const LABEL: Record<ColorTeamStatus, string> = {
  white: 'White',
  pink:  'Pink',
  red:   'Red',
  gold:  'Gold',
  final: 'Final',
}

export default function ColorTeamBadge({ status, size = 'sm' }: Props) {
  const dotSize = size === 'md' ? 'w-3 h-3' : 'w-2 h-2'
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} text-gray-600`}>
      <span
        className={`${dotSize} rounded-full inline-block flex-shrink-0 ${DOT_COLOR[status]}`}
        aria-label={`Color team status: ${LABEL[status]}`}
      />
      <span>{LABEL[status]}</span>
    </span>
  )
}

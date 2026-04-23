import { type ReactNode, type HTMLAttributes } from 'react'

type CardVariant = 'default' | 'highlight' | 'stat'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  children: ReactNode
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  className?: string
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-white border border-gray-200 rounded-xl p-6',
  highlight:
    'bg-white border border-gray-200 border-l-4 border-l-[#FDFF66] rounded-xl p-6',
  stat:
    'bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1',
}

export function Card({ variant = 'default', children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[variantClasses[variant], className].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, className = '' }: StatCardProps) {
  return (
    <div className={['bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-1', className].join(' ')}>
      <span className="text-gray-400 text-xs font-medium uppercase tracking-wider font-sans">{label}</span>
      <span className="text-[#ff7b20] text-3xl font-black leading-none font-sans">{value}</span>
      {sub && <span className="text-gray-400 text-xs font-sans">{sub}</span>}
    </div>
  )
}

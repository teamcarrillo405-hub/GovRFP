'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[#FDFF66] text-black font-bold uppercase tracking-wide hover:brightness-105 active:brightness-95 disabled:opacity-50 shadow-sm',
  secondary:
    'border border-gray-300 text-gray-700 bg-white hover:border-[#FDFF66] hover:text-gray-900 disabled:opacity-50',
  ghost:
    'text-gray-600 bg-transparent hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50',
  danger:
    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50',
}

const sizeClasses: Record<Size, string> = {
  sm:  'px-3 py-1.5 text-xs rounded-md',
  md:  'px-4 py-2 text-sm rounded-lg',
  lg:  'px-6 py-3 text-base rounded-xl',
}

const Spinner = () => (
  <svg
    className="animate-spin h-4 w-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          'inline-flex items-center justify-center gap-2 font-sans transition-all duration-150 cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFF66] focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          (disabled || loading) ? 'cursor-not-allowed' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {loading && <Spinner />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

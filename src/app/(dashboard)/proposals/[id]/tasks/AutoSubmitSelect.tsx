'use client'

import { useRef } from 'react'

interface Props {
  name: string
  defaultValue: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export default function AutoSubmitSelect({ name, defaultValue, style, children }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null)

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => {
        const form = (e.target as HTMLSelectElement).closest('form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }}
      style={style}
    >
      {children}
    </select>
  )
}

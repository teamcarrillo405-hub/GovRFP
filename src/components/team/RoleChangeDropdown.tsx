'use client'

import { useEffect, useRef } from 'react'

interface Props {
  memberId: string
  currentRole: string
  onRoleChanged: () => void
}

export default function RoleChangeDropdown({ memberId, currentRole, onRoleChanged }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onRoleChanged()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onRoleChanged])

  const handleRoleSelect = async (role: 'editor' | 'viewer') => {
    if (role === currentRole) {
      onRoleChanged()
      return
    }
    try {
      await fetch(`/api/teams/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
    } catch {
      // Silently fail — parent refresh will show current state
    }
    onRoleChanged()
  }

  const roles: Array<{ value: 'editor' | 'viewer'; label: string }> = [
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' },
  ]

  return (
    <div
      ref={containerRef}
      className="mt-1 bg-white rounded-md border border-gray-200 shadow-md p-2 w-48 absolute right-0 z-10"
    >
      <div className="flex flex-col gap-1">
        {roles.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleRoleSelect(value)}
            className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors ${
              currentRole === value
                ? 'font-semibold text-gray-900'
                : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

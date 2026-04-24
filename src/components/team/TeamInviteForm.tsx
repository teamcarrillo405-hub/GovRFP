'use client'

import { useState } from 'react'

interface Props {
  teamId: string
  onInviteSent: () => void
}

export default function TeamInviteForm({ teamId, onInviteSent }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, email: trimmedEmail, role }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        const msg = data.error ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          throw new Error(`${trimmedEmail} is already a team member.`)
        }
        throw new Error('Something went wrong. Try again or contact support.')
      }

      setEmail('')
      setRole('editor')
      setSuccess(true)
      onInviteSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="team-invite-email" className="sr-only">
            Teammate email
          </label>
          <input
            id="team-invite-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSuccess(false) }}
            placeholder="teammate@company.com"
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-400 disabled:opacity-60"
          />
        </div>

        <div className="shrink-0">
          <label htmlFor="team-invite-role" className="sr-only">
            Select role
          </label>
          <select
            id="team-invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            disabled={loading}
            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="shrink-0 px-4 py-2 bg-black text-white text-sm font-semibold rounded-md hover:bg-gray-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : 'Send Invite'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {success && <p className="text-xs text-green-600 mt-2">Invite sent!</p>}
    </form>
  )
}

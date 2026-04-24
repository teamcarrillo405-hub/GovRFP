'use client'

import { useState } from 'react'

interface Props {
  teamId: string | null
  proposalId: string
  proposalTitle: string
  onTeamCreated: (teamId: string) => void
  onInviteSent: () => void
}

export default function InviteForm({
  teamId,
  proposalId,
  proposalTitle,
  onTeamCreated,
  onInviteSent,
}: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setLoading(true)

    try {
      let resolvedTeamId = teamId

      // Step 1: Create team if this is the first share
      if (!resolvedTeamId) {
        const createRes = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: proposalTitle, proposal_id: proposalId }),
        })
        if (!createRes.ok) {
          const data = await createRes.json() as { error?: string }
          throw new Error(data.error ?? 'Something went wrong. Try again or contact support.')
        }
        const createData = await createRes.json() as { team: { id: string } }
        resolvedTeamId = createData.team.id
        onTeamCreated(resolvedTeamId)
      }

      // Step 2: Send invite
      const inviteRes = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: resolvedTeamId, email: trimmedEmail, role }),
      })

      if (!inviteRes.ok) {
        const data = await inviteRes.json() as { error?: string }
        const msg = data.error ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          throw new Error(`${trimmedEmail} is already a team member.`)
        }
        throw new Error('Something went wrong. Try again or contact support.')
      }

      // Step 3: Reset form on success
      setEmail('')
      setRole('editor')
      onInviteSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again or contact support.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Invite teammate</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="invite-email" className="sr-only">
              Teammate email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              autoFocus
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder:text-gray-500 disabled:opacity-60"
            />
          </div>

          <div className="flex-shrink-0">
            <label htmlFor="invite-role" className="sr-only">
              Select role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              disabled={loading}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-32 flex-shrink-0 disabled:opacity-60"
              aria-label="Select role"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </form>
    </div>
  )
}

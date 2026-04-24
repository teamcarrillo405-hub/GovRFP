'use client'

import { useState } from 'react'

interface PendingInvite {
  id: string
  invitee_email: string
  role: string
  created_at: string
}

interface Props {
  teamId: string
  invites: PendingInvite[]
  isAdmin: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PendingInvitesList({ teamId, invites: initialInvites, isAdmin }: Props) {
  const [invites, setInvites] = useState<PendingInvite[]>(initialInvites)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId)
    try {
      const res = await fetch(`/api/teams/invites/${inviteId}/resend`, { method: 'POST' })
      if (res.ok) {
        setFeedback((prev) => ({ ...prev, [inviteId]: 'Resent!' }))
        setTimeout(() => setFeedback((prev) => { const n = { ...prev }; delete n[inviteId]; return n }), 3000)
      } else {
        setFeedback((prev) => ({ ...prev, [inviteId]: 'Failed to resend.' }))
      }
    } catch {
      setFeedback((prev) => ({ ...prev, [inviteId]: 'Failed to resend.' }))
    } finally {
      setResendingId(null)
    }
  }

  const handleCancel = async (inviteId: string) => {
    setCancellingId(inviteId)
    try {
      const res = await fetch(`/api/teams/members/${inviteId}`, { method: 'DELETE' })
      if (res.ok) {
        setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
        setConfirmCancelId(null)
      } else {
        setFeedback((prev) => ({ ...prev, [inviteId]: 'Failed to cancel.' }))
      }
    } catch {
      setFeedback((prev) => ({ ...prev, [inviteId]: 'Failed to cancel.' }))
    } finally {
      setCancellingId(null)
    }
  }

  if (invites.length === 0) {
    return <p className="text-sm text-gray-500">No pending invites.</p>
  }

  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {invites.map((inv) => (
        <div key={inv.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{inv.invitee_email}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Invited {formatDate(inv.created_at)} &middot; {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)}
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              {feedback[inv.id] ? (
                <span className={`text-xs font-medium ${feedback[inv.id] === 'Resent!' ? 'text-green-600' : 'text-red-600'}`}>
                  {feedback[inv.id]}
                </span>
              ) : null}

              {confirmCancelId === inv.id ? (
                <>
                  <span className="text-xs text-gray-600">Cancel invite?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmCancelId(null)}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={cancellingId === inv.id}
                    onClick={() => handleCancel(inv.id)}
                    className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {cancellingId === inv.id ? 'Cancelling…' : 'Cancel invite'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={resendingId === inv.id}
                    onClick={() => handleResend(inv.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 underline disabled:opacity-60"
                  >
                    {resendingId === inv.id ? 'Sending…' : 'Resend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancelId(inv.id)}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    aria-label={`Cancel invite to ${inv.invitee_email}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-gray-400 hover:text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

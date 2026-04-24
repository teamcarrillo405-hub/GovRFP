'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  teamId: string
  isOwner: boolean
}

export default function DangerZone({ teamId, isOwner }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const action = isOwner ? 'Delete Team' : 'Leave Team'
  const confirmPrompt = isOwner
    ? 'This will permanently delete the team and remove all members. This cannot be undone.'
    : 'You will lose access to all proposals shared with this team.'

  const handleAction = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        isOwner ? `/api/teams/${teamId}` : `/api/teams/${teamId}/leave`,
        { method: isOwner ? 'DELETE' : 'POST' }
      )

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Something went wrong.')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-1">
        Danger Zone
      </h2>
      <p className="text-xs text-red-600 mb-4">{confirmPrompt}</p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 border border-red-600 text-red-600 text-sm font-semibold rounded-md hover:bg-red-100 transition-colors"
        >
          {action}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-sm text-red-700 font-medium">Are you sure?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowConfirm(false); setError(null) }}
              disabled={loading}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAction}
              disabled={loading}
              className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-60 font-semibold"
            >
              {loading ? 'Processing…' : `Yes, ${action}`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  )
}

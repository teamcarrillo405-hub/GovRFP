'use client'

interface Props {
  memberId: string
  email: string
  onRemoved: () => void
  onCancel: () => void
  isPendingInvite?: boolean
}

export default function RemoveMemberConfirmation({
  memberId,
  email,
  onRemoved,
  onCancel,
  isPendingInvite = false,
}: Props) {
  const handleRemove = async () => {
    try {
      await fetch(`/api/teams/members/${memberId}`, {
        method: 'DELETE',
      })
    } catch {
      // Silently fail — parent refresh will show current state
    }
    onRemoved()
  }

  const promptText = isPendingInvite
    ? `Cancel invite to ${email}?`
    : `Remove ${email}?`

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-700">{promptText}</span>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Keep member
      </button>
      <button
        type="button"
        onClick={handleRemove}
        className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors"
      >
        Remove member
      </button>
    </div>
  )
}

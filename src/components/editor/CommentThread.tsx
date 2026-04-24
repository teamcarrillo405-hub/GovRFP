'use client'

import { useState, useTransition } from 'react'
import type { SectionComment } from '@/app/(dashboard)/proposals/[id]/review/actions'
import {
  addCommentAction,
  resolveCommentAction,
  deleteCommentAction,
} from '@/app/(dashboard)/proposals/[id]/review/actions'

interface Props {
  proposalId: string
  sectionName: string
  initialComments: SectionComment[]
  currentUserId: string
}

function authorInitials(email: string): string {
  const name = email.split('@')[0]
  return name.slice(0, 2).toUpperCase()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

export function CommentThread({
  proposalId,
  sectionName,
  initialComments,
  currentUserId,
}: Props) {
  const [comments, setComments] = useState<SectionComment[]>(initialComments)
  const [body, setBody] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const unresolved = comments.filter((c) => !c.resolved)
  const resolved = comments.filter((c) => c.resolved)
  const visible = showResolved ? comments : unresolved

  const onAdd = () => {
    const trimmed = body.trim()
    if (!trimmed || isPending) return
    setError(null)
    startTransition(async () => {
      try {
        const { comment } = await addCommentAction(proposalId, sectionName, trimmed)
        setComments((prev) => [...prev, comment])
        setBody('')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add comment')
      }
    })
  }

  const onResolve = (id: string) => {
    startTransition(async () => {
      try {
        await resolveCommentAction(id)
        setComments((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, resolved: true, resolved_at: new Date().toISOString() }
              : c,
          ),
        )
      } catch {
        setError('Failed to resolve comment')
      }
    })
  }

  const onDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCommentAction(id)
        setComments((prev) => prev.filter((c) => c.id !== id))
      } catch {
        setError('Failed to delete comment')
      }
    })
  }

  return (
    <div className="border-l-2 border-gray-200 pl-4 space-y-3">
      {/* Comment list */}
      {visible.length === 0 && unresolved.length === 0 && (
        <p className="text-xs text-gray-500 italic">No comments yet.</p>
      )}
      {visible.length === 0 && unresolved.length === 0 && resolved.length > 0 && !showResolved && (
        <p className="text-xs text-gray-500 italic">All comments resolved.</p>
      )}

      {visible.map((comment) => (
        <div
          key={comment.id}
          className={`rounded-md p-3 text-sm ${
            comment.resolved ? 'bg-gray-50 opacity-60' : 'bg-white border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {authorInitials(comment.author_email)}
            </span>
            <span className="text-xs font-medium text-gray-700 truncate">{comment.author_email}</span>
            <span className="text-xs text-gray-500 ml-auto shrink-0">{relativeTime(comment.created_at)}</span>
          </div>
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
          {comment.resolved && (
            <p className="text-xs text-green-700 mt-1 font-medium">✓ Resolved</p>
          )}
          {!comment.resolved && (
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => onResolve(comment.id)}
                disabled={isPending}
                className="text-xs text-green-700 hover:text-green-900 font-medium"
              >
                Resolve
              </button>
              {comment.user_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Toggle resolved */}
      {resolved.length > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-600"
        >
          {showResolved ? 'Hide' : `Show ${resolved.length} resolved`}
        </button>
      )}

      {/* Add comment form */}
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onAdd()
          }}
          placeholder="Leave a comment… (⌘↵ to submit)"
          rows={2}
          maxLength={2000}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          onClick={onAdd}
          disabled={!body.trim() || isPending}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Posting…' : 'Comment'}
        </button>
      </div>
    </div>
  )
}

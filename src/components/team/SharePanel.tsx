'use client'

import { useEffect, useState } from 'react'
import InviteForm from './InviteForm'
import MemberList from './MemberList'

interface Props {
  proposalId: string
  proposalTitle: string
  teamId: string | null
  onClose: () => void
  onTeamCreated: (teamId: string) => void
}

export default function SharePanel({
  proposalId,
  proposalTitle,
  teamId: initialTeamId,
  onClose,
  onTeamCreated,
}: Props) {
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(initialTeamId)
  // refreshKey increments each time an invite is sent, triggering MemberList reload
  const [refreshKey, setRefreshKey] = useState(0)

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleTeamCreated = (teamId: string) => {
    setCurrentTeamId(teamId)
    onTeamCreated(teamId)
  }

  const handleInviteSent = () => {
    setRefreshKey((k) => k + 1)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-16"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-panel-title"
    >
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200 flex items-center justify-between">
          <h2
            id="share-panel-title"
            className="text-base font-semibold text-gray-900"
          >
            Share Proposal
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="p-2 rounded hover:bg-gray-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          <InviteForm
            teamId={currentTeamId}
            proposalId={proposalId}
            proposalTitle={proposalTitle}
            onTeamCreated={handleTeamCreated}
            onInviteSent={handleInviteSent}
          />

          {currentTeamId && (
            <MemberList
              teamId={currentTeamId}
              isOwner={true}
              refreshKey={refreshKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}

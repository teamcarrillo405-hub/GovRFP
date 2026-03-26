'use client'

import { useState } from 'react'
import SharePanel from './SharePanel'

interface Props {
  proposalId: string
  teamId: string | null
  userRole: 'owner' | 'editor' | 'viewer'
  proposalTitle?: string
}

/**
 * ShareButton — triggers the Share/Manage Team panel on the proposal detail page.
 * Viewer-role users do not see this button (server-side prop determines render per D-16).
 */
export default function ShareButton({
  proposalId,
  teamId,
  userRole,
  proposalTitle = 'Proposal',
}: Props) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(teamId)

  // Viewers do not get share access — per D-16 and UI-SPEC viewer restriction
  if (userRole === 'viewer') return null

  const label = currentTeamId ? 'Manage Team' : 'Share'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPanelOpen(true)}
        className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors"
      >
        {label}
      </button>

      {isPanelOpen && (
        <SharePanel
          proposalId={proposalId}
          proposalTitle={proposalTitle}
          teamId={currentTeamId}
          onClose={() => setIsPanelOpen(false)}
          onTeamCreated={(newTeamId) => setCurrentTeamId(newTeamId)}
        />
      )}
    </>
  )
}

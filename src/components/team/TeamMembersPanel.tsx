'use client'

import { useState } from 'react'
import MemberList from './MemberList'
import TeamInviteForm from './TeamInviteForm'

interface Props {
  teamId: string
  isAdmin: boolean
}

/**
 * Client wrapper that owns the refreshKey state shared between
 * the inline invite form and the member list.
 */
export default function TeamMembersPanel({ teamId, isAdmin }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <MemberList
        teamId={teamId}
        isOwner={isAdmin}
        refreshKey={refreshKey}
      />

      {isAdmin && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Invite teammate</p>
          <TeamInviteForm
            teamId={teamId}
            onInviteSent={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      )}
    </div>
  )
}

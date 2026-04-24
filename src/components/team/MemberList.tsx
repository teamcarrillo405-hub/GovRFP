'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import RoleChangeDropdown from './RoleChangeDropdown'
import RemoveMemberConfirmation from './RemoveMemberConfirmation'

interface TeamMember {
  id: string
  user_id: string
  role: string
  email: string
  isPending?: false
}

interface PendingInvite {
  id: string
  email: string
  role: string
  status: string
  isPending: true
}

type MemberRow = TeamMember | PendingInvite

interface Props {
  teamId: string
  isOwner: boolean
  refreshKey: number
}

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-gray-100 text-gray-700',
  editor: 'bg-blue-50 text-blue-700',
  viewer: 'bg-gray-100 text-gray-500',
}

function getInitial(email: string): string {
  return email.charAt(0).toUpperCase()
}

export default function MemberList({ teamId, isOwner, refreshKey }: Props) {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Stable client ref — createClient() must not be called on every render
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const loadMembers = async () => {
    setLoading(true)

    // Load confirmed team members via API route (resolves emails from auth.users)
    const membersRes = await fetch(`/api/teams/${teamId}/members`)
    const membersJson = membersRes.ok
      ? (await membersRes.json() as { members: Array<{ id: string; user_id: string; role: string; email: string }> })
      : { members: [] }

    // Load pending + declined invites — column is invitee_email, not email
    const { data: invites } = await supabase
      .from('team_invites')
      .select('id, invitee_email, role, status')
      .eq('team_id', teamId)
      .in('status', ['pending', 'declined'])

    const memberRows: TeamMember[] = membersJson.members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      email: m.email,
      isPending: false as const,
    }))

    const inviteRows: PendingInvite[] = (invites ?? []).map((inv) => ({
      id: inv.id,
      email: inv.invitee_email,
      role: inv.role,
      status: inv.status,
      isPending: true as const,
    }))

    setRows([...memberRows, ...inviteRows])
    setLoading(false)
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, refreshKey])

  if (loading) {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Team members</p>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Team members</p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No teammates yet. Invite someone below.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isPending = row.isPending === true
            const isDeclined = isPending && (row as PendingInvite).status === 'declined'
            const isConfirmingRemove = confirmRemoveId === row.id
            const isDropdownOpen = openDropdownId === row.id

            return (
              <div key={row.id} className="py-3">
                <div className="flex items-center justify-between">
                  {/* Left: avatar + email */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPending && !isDeclined
                          ? 'bg-yellow-50'
                          : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold ${
                          isPending && !isDeclined ? 'text-yellow-700' : 'text-gray-600'
                        }`}
                      >
                        {getInitial(row.email)}
                      </span>
                    </div>
                    <span
                      className={`text-sm ${
                        isPending ? 'text-gray-500 italic' : 'text-gray-900'
                      }`}
                    >
                      {row.email}
                    </span>
                  </div>

                  {/* Right: badge + actions */}
                  <div className="flex items-center gap-2 relative">
                    {/* Role / status badge */}
                    {isPending ? (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          isDeclined
                            ? 'bg-red-50 text-red-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        {isDeclined ? 'Declined' : 'Invited'}
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          ROLE_BADGE[row.role] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
                      </span>
                    )}

                    {/* Owner actions — only for non-pending non-declined non-owner members */}
                    {isOwner && !isPending && (row as TeamMember).role !== 'owner' && (
                      <>
                        {isConfirmingRemove ? (
                          <RemoveMemberConfirmation
                            memberId={row.id}
                            email={row.email}
                            onRemoved={() => {
                              setConfirmRemoveId(null)
                              loadMembers()
                            }}
                            onCancel={() => setConfirmRemoveId(null)}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenDropdownId(isDropdownOpen ? null : row.id)
                              }
                              className="text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              Change role
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(row.id)}
                              aria-label={`Remove ${row.email}`}
                              className="p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              {/* Trash icon */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4 text-gray-500 hover:text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Owner action for pending invites — cancel only */}
                    {isOwner && isPending && !isDeclined && (
                      <>
                        {isConfirmingRemove ? (
                          <RemoveMemberConfirmation
                            memberId={row.id}
                            email={row.email}
                            onRemoved={() => {
                              setConfirmRemoveId(null)
                              loadMembers()
                            }}
                            onCancel={() => setConfirmRemoveId(null)}
                            isPendingInvite
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(row.id)}
                            aria-label={`Remove ${row.email}`}
                            className="p-1 rounded hover:bg-red-50 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4 text-gray-500 hover:text-red-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </>
                    )}

                    {/* RoleChangeDropdown — rendered inline relative to this row */}
                    {isDropdownOpen && (
                      <RoleChangeDropdown
                        memberId={row.id}
                        currentRole={(row as TeamMember).role}
                        onRoleChanged={() => {
                          setOpenDropdownId(null)
                          loadMembers()
                        }}
                        onClose={() => setOpenDropdownId(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

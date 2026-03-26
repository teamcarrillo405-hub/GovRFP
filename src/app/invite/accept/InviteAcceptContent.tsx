'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type PageState = 'loading' | 'success' | 'expired' | 'already-member'

export default function InviteAcceptContent() {
  const [state, setState] = useState<PageState>('loading')
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalId, setProposalId] = useState('')
  const searchParams = useSearchParams()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  useEffect(() => {
    let timedOut = false

    async function acceptInvite(inviteId: string, teamId: string) {
      const res = await fetch('/api/teams/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId, team_id: teamId }),
      })
      if (res.ok) {
        // Fetch proposal title for success message
        const { data: proposal } = await supabase
          .from('proposals')
          .select('id, title')
          .eq('team_id', teamId)
          .limit(1)
          .single()
        setProposalTitle(proposal?.title || 'the proposal')
        setProposalId(proposal?.id || '')
        setState('success')
      } else {
        const data = await res.json()
        if (data.error?.includes('already')) {
          setState('already-member')
        } else {
          setState('expired')
        }
      }
    }

    async function handleAccept() {
      // Path 1: New user — Supabase sets session from hash fragment
      // Path 2: Existing user — invite_id and team_id from search params
      const inviteId = searchParams.get('invite_id')
      const teamId = searchParams.get('team_id')

      // Check for existing session (getSession is fine client-side)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Listen for SIGNED_IN event from hash token (new user path)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (event === 'SIGNED_IN' && newSession && !timedOut) {
            const metadata = newSession.user.user_metadata
            const metaInviteId = metadata?.invite_id
            const metaTeamId = metadata?.team_id
            if (metaInviteId && metaTeamId) {
              await acceptInvite(metaInviteId, metaTeamId)
            } else {
              setState('expired')
            }
            subscription.unsubscribe()
          }
        })
        // Set timeout for expired/invalid links
        setTimeout(() => {
          timedOut = true
          setState((prev) => (prev === 'loading' ? 'expired' : prev))
        }, 10000)
        return
      }

      // Session exists — use search params or user_metadata
      const finalInviteId = inviteId || session.user.user_metadata?.invite_id
      const finalTeamId = teamId || session.user.user_metadata?.team_id
      if (finalInviteId && finalTeamId) {
        await acceptInvite(finalInviteId, finalTeamId)
      } else {
        setState('expired')
      }
    }

    handleAccept()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {state === 'loading' && (
        <p className="text-sm text-gray-500 text-center">Verifying your invitation...</p>
      )}
      {state === 'success' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">You&apos;re in.</h1>
          <p className="text-sm text-gray-600 mb-6">{proposalTitle} has been added to your proposals.</p>
          <Link
            href={proposalId ? `/proposals/${proposalId}` : '/dashboard'}
            className="block w-full text-center px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors"
          >
            Go to Proposal
          </Link>
        </>
      )}
      {state === 'expired' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invitation expired</h1>
          <p className="text-sm text-gray-600 mb-6">
            This invitation link has expired or already been used. Ask the proposal owner to send a new invite.
          </p>
        </>
      )}
      {state === 'already-member' && (
        <>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Already joined</h1>
          <p className="text-sm text-gray-600 mb-6">You already have access to this proposal.</p>
          <Link
            href={proposalId ? `/proposals/${proposalId}` : '/dashboard'}
            className="block w-full text-center px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors"
          >
            Go to Proposal
          </Link>
        </>
      )}
    </>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function InviteDeclineContent() {
  const [done, setDone] = useState(false)
  const [proposalTitle, setProposalTitle] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    async function decline() {
      const inviteId = searchParams.get('invite_id')
      const title = searchParams.get('title') || 'the proposal'
      setProposalTitle(title)
      if (!inviteId) {
        setDone(true)
        return
      }
      await fetch('/api/teams/invite/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId }),
      })
      setDone(true)
    }
    decline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!done) {
    return <p className="text-sm text-gray-500 text-center">Processing...</p>
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Invitation declined</h1>
      <p className="text-sm text-gray-600 mb-6">
        You&apos;ve declined the invitation to {proposalTitle}. The proposal owner has been notified.
      </p>
      <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">
        Sign in to your account
      </Link>
    </>
  )
}

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { QuestionSessionView } from '@/components/questions/QuestionSessionView'
import type { QuestionSessionItem } from '@/lib/questions/types'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Question session page for a proposal.
 *
 * Loads the most recent in-progress session (or shows "Generate" CTA if
 * none exists). User answers questions; QuestionSessionView auto-saves
 * via PATCH /api/proposals/[id]/questions.
 */
export default async function QuestionsPage({ params }: Props) {
  const { id: proposalId } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title')
    .eq('id', proposalId)
    .single()
  if (!proposal) notFound()

  // Most recent session for this proposal (in_progress preferred, else most recent)
  const { data: session } = await supabase
    .from('question_sessions')
    .select('id, status, created_at')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const items: QuestionSessionItem[] = session
    ? (
        await supabase
          .from('question_session_items')
          .select('*')
          .eq('session_id', session.id)
          .order('position', { ascending: true })
      ).data ?? []
    : []

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href={`/proposals/${proposalId}`}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        ← Back to proposal
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{proposal.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        Contract-specific question session. Templated core (work-type aware) + AI-generated
        per-RFP questions. Answers feed every section your editor drafts.
      </p>

      <QuestionSessionView
        proposalId={proposalId}
        initialSessionId={session?.id ?? null}
        initialStatus={session?.status ?? null}
        initialItems={items}
      />
    </main>
  )
}

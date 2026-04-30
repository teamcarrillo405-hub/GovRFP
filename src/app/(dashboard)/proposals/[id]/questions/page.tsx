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
    <div style={{ maxWidth: 900 }}>
      <Link href={`/proposals/${proposalId}`} style={{ fontSize: 12, color: 'rgba(192,194,198,0.45)', textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>
        ← Back to proposal
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', margin: 0, marginBottom: 6 }}>{proposal.title}</h1>
      <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.5)', marginBottom: 28 }}>
        Contract-specific question session. Templated core (work-type aware) + AI-generated
        per-RFP questions. Answers feed every section your editor drafts.
      </p>

      <QuestionSessionView
        proposalId={proposalId}
        initialSessionId={session?.id ?? null}
        initialStatus={session?.status ?? null}
        initialItems={items}
      />
    </div>
  )
}

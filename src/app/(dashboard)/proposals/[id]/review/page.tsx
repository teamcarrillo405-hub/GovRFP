import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import { SECTION_NAMES, type SectionName } from '@/lib/editor/types'
import type { JSONContent } from '@tiptap/react'
import { ReadOnlySectionContent } from '@/components/editor/ReadOnlySectionContent'
import { CommentThread } from '@/components/editor/CommentThread'
import type { SectionComment } from './actions'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
  empty: 'Not drafted',
  generating: 'Generating…',
  scoring: 'Scoring…',
  draft: 'Draft',
  edited: 'Edited',
}

const STATUS_COLOR: Record<string, string> = {
  empty: 'bg-gray-100 text-gray-500',
  draft: 'bg-blue-50 text-blue-700',
  edited: 'bg-green-50 text-green-700',
}

export default async function ReviewPage({ params }: Props) {
  const { id } = await params
  const user = await getUser()
  if (!user) redirect('/login')

  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('title, status')
    .eq('id', id)
    .single()

  if (!proposal) notFound()

  const [sectionsResult, commentsResult] = await Promise.all([
    supabase
      .from('proposal_sections')
      .select('section_name, content, draft_status')
      .eq('proposal_id', id),
    supabase
      .from('section_comments')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true }),
  ])

  const sections = sectionsResult.data ?? []
  const allComments = (commentsResult.data ?? []) as SectionComment[]

  const commentsBySection = allComments.reduce<Record<string, SectionComment[]>>((acc, c) => {
    if (!acc[c.section_name]) acc[c.section_name] = []
    acc[c.section_name].push(c)
    return acc
  }, {})

  const sectionMap = new Map(
    sections.map((s) => [s.section_name as SectionName, s]),
  )

  const totalUnresolved = allComments.filter((c) => !c.resolved).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <span>/</span>
        <Link href={`/proposals/${id}`} className="hover:text-gray-700">{proposal.title}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Review</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
          {totalUnresolved > 0 && (
            <p className="text-sm text-yellow-700 mt-1">
              {totalUnresolved} unresolved comment{totalUnresolved !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {proposal.status === 'analyzed' && (
          <Link
            href={`/proposals/${id}/editor`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-md hover:bg-blue-800 transition-colors"
          >
            Open Editor →
          </Link>
        )}
      </div>

      <div className="space-y-12">
        {SECTION_NAMES.map((sectionName) => {
          const section = sectionMap.get(sectionName)
          const sectionComments = commentsBySection[sectionName] ?? []
          const unresolvedCount = sectionComments.filter((c) => !c.resolved).length
          const hasContent = section?.draft_status && section.draft_status !== 'empty'

          return (
            <section key={sectionName}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">{sectionName}</h2>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_COLOR[section?.draft_status ?? 'empty'] ?? 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {STATUS_LABEL[section?.draft_status ?? 'empty'] ?? section?.draft_status}
                </span>
                {unresolvedCount > 0 && (
                  <span className="ml-auto text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                    {unresolvedCount} comment{unresolvedCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Section content (read-only) */}
                <div className="prose prose-sm max-w-none">
                  {hasContent && section?.content ? (
                    <ReadOnlySectionContent content={section.content as JSONContent} />
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                      <p className="text-sm text-gray-500">No draft yet for this section.</p>
                      {proposal.status === 'analyzed' && (
                        <Link
                          href={`/proposals/${id}/editor`}
                          className="mt-2 inline-block text-xs text-blue-700 hover:underline"
                        >
                          Generate in editor →
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Comment thread */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Comments
                    {sectionComments.length > 0 && (
                      <span className="ml-1.5 text-gray-500 font-normal">({sectionComments.length})</span>
                    )}
                  </h3>
                  <CommentThread
                    proposalId={id}
                    sectionName={sectionName}
                    initialComments={sectionComments}
                    currentUserId={user.id}
                  />
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

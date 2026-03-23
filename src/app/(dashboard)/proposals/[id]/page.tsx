import { redirect, notFound } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import ProcessingStatus from '@/components/documents/ProcessingStatus'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProposalDetailPage({ params }: Props) {
  const { id } = await params // Next.js 16: params must be awaited
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  // Load proposal — RLS enforces user_id, but explicit eq for clarity
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  // Load job status (most recent job for this proposal)
  const { data: job } = await supabase
    .from('document_jobs')
    .select('status, error_message')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const isProcessing = proposal.status === 'processing'
  const isReady = proposal.status === 'ready'

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{proposal.title}</h1>
          {proposal.file_name && (
            <p className="text-sm text-gray-500 mt-1">{proposal.file_name}</p>
          )}
        </div>
      </div>

      {/* Processing status — shown when document is being processed */}
      {isProcessing && job && (
        <div className="mb-8">
          <ProcessingStatus
            proposalId={id}
            initialStatus={job.status}
            initialError={job.error_message}
          />
        </div>
      )}

      {/* Document info — shown when processing is complete */}
      {isReady && (
        <div className="space-y-6">
          {/* Document metadata */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Document Info</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {proposal.file_type === 'pdf' ? 'PDF' : 'Word (.docx)'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Pages</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {proposal.page_count ?? 'N/A'}
                </dd>
              </div>
              {proposal.is_scanned && (
                <div>
                  <dt className="text-gray-500">OCR</dt>
                  <dd className="font-medium text-gray-900 mt-0.5">
                    Scanned document — text extracted via OCR
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* RFP Structure preview (INGEST-05: data only, sidebar UI deferred to Phase 4) */}
          {proposal.rfp_structure && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">RFP Structure</h2>
              {((proposal.rfp_structure as { sections?: Array<{ number: string; title: string }> }).sections?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Sections</h3>
                  <ul className="space-y-1">
                    {(proposal.rfp_structure as { sections: Array<{ number: string; title: string }> }).sections.map(
                      (section, i: number) => (
                        <li key={i} className="text-sm text-gray-600">
                          <span className="font-mono text-gray-400 mr-2">{section.number}</span>
                          {section.title}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {((proposal.rfp_structure as { requirements?: Array<{ type: string }> }).requirements?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Requirements ({(proposal.rfp_structure as { requirements: Array<{ type: string }> }).requirements.length})
                  </h3>
                  <p className="text-xs text-gray-500">
                    {(proposal.rfp_structure as { requirements: Array<{ type: string }> }).requirements.filter(
                      (r) => r.type === 'shall' || r.type === 'must'
                    ).length} mandatory,{' '}
                    {(proposal.rfp_structure as { requirements: Array<{ type: string }> }).requirements.filter(
                      (r) => r.type === 'should'
                    ).length} desired
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Extracted text preview */}
          {proposal.rfp_text && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Extracted Text</h2>
              <div className="max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {(proposal.rfp_text as string).slice(0, 5000)}
                  {(proposal.rfp_text as string).length > 5000 && (
                    <span className="text-gray-400">
                      {'\n\n'}... ({((proposal.rfp_text as string).length / 1000).toFixed(0)}k characters total)
                    </span>
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draft/archived state — no document uploaded yet or archived */}
      {!isProcessing && !isReady && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            {proposal.status === 'draft' && !proposal.file_name
              ? 'No document uploaded yet.'
              : `Status: ${proposal.status}`}
          </p>
          {proposal.status === 'draft' && (
            <Link
              href="/proposals/new"
              className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              Upload an RFP
            </Link>
          )}
        </div>
      )}
    </main>
  )
}

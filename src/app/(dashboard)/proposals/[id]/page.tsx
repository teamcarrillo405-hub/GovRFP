import { redirect, notFound } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import ProcessingStatus from '@/components/documents/ProcessingStatus'
import FileUpload from '@/components/documents/FileUpload'
import ShareButton from '@/components/team/ShareButton'
import ExportButtons from '@/components/export/ExportButtons'
import OutcomeSelector from '@/components/proposals/OutcomeSelector'
import Link from 'next/link'
import {
  buildGovRfpOpportunityUrl,
  extractGovRfpSource,
} from '@/lib/bridge/govrfp-source'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProposalDetailPage({ params }: Props) {
  const { id } = await params // Next.js 16: params must be awaited
  const user = await getUser()
  if (!user) redirect('/login')

  // requireProposalRole handles access control — returns null if no access
  const roleResult = await requireProposalRole(id, 'viewer')
  if (!roleResult) notFound()

  const supabase = await createClient()

  // Load proposal — RLS dual-policy handles access (solo or team member)
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*, outcome, contract_value, submitted_at, outcome_notes')
    .eq('id', id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  // Load section scores summary (for scoring breakdown link)
  const { data: sectionScores } = await supabase
    .from('section_scores')
    .select('section_name, score, passed, attempt')
    .eq('proposal_id', id)
    .order('attempt', { ascending: false })

  const hasScores = (sectionScores?.length ?? 0) > 0

  // Load job status (most recent job for this proposal)
  const { data: job } = await supabase
    .from('document_jobs')
    .select('status, error_message')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // GovRFP return-trip: if this proposal was created via the Send-to-ProposalAI
  // handoff, surface a back-link to the source opportunity on GovRFP.
  const { data: analysis } = await supabase
    .from('rfp_analysis')
    .select('win_factors, win_score')
    .eq('proposal_id', id)
    .maybeSingle()
  const govRfpSource = extractGovRfpSource(analysis?.win_factors)
  const winScore: number | null = analysis?.win_score ?? null

  // Look up any existing past-performance record sourced from this proposal
  // so OutcomeSelector can show the "View record" callout on first load when
  // the proposal was previously marked Won.
  const { data: existingPp } = await supabase
    .from('past_performance')
    .select('id')
    .eq('source_proposal_id', id)
    .maybeSingle()

  const isProcessing = proposal.status === 'processing'
  const isReady      = proposal.status === 'ready'
  const isAnalyzed   = proposal.status === 'analyzed'

  // Go/No-Go logic
  const isGo      = winScore !== null && winScore >= 65
  const isCaution = winScore !== null && winScore >= 40 && winScore < 65
  const isNoGo    = winScore !== null && winScore < 40

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans">

      {/* ── GovRFP back-link banner ── */}
      {govRfpSource && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FDFF66]/40 bg-[#FDFF66]/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span
              className="inline-flex w-5 h-5 items-center justify-center rounded-full text-xs font-bold bg-[#FDFF66] text-black"
              aria-hidden="true"
            >
              ✓
            </span>
            <span>
              Opened from <strong>GovRFP</strong>
            </span>
          </div>
          <a
            href={buildGovRfpOpportunityUrl(
              govRfpSource.opportunityId,
              process.env.NEXT_PUBLIC_GOVRFP_URL,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-800 hover:text-black underline decoration-[#FDFF66]"
          >
            View source opportunity →
          </a>
        </div>
      )}

      {/* ── Back link ── */}
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-flex items-center gap-1 transition-colors"
      >
        ← Dashboard
      </Link>

      {/* ── Hero: title + share ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-gray-900 uppercase tracking-tight leading-tight">
            {proposal.title}
          </h1>
          {proposal.file_name && (
            <p className="text-sm text-gray-500 mt-1">{proposal.file_name}</p>
          )}
        </div>
        <div className="shrink-0">
          <ShareButton
            proposalId={id}
            teamId={proposal.team_id ?? null}
            userRole={roleResult.role === 'none' ? 'viewer' : roleResult.role}
            proposalTitle={proposal.title}
          />
        </div>
      </div>

      {/* ── Win Score hero stat ── */}
      {winScore !== null && (
        <div
          className={[
            'mb-6 rounded-xl border-l-4 p-5 flex items-center gap-5',
            isGo      ? 'border-l-green-500 border border-green-100 bg-green-50'      : '',
            isCaution ? 'border-l-[#ff7b20] border border-orange-100 bg-orange-50'   : '',
            isNoGo    ? 'border-l-red-500 border border-red-100 bg-red-50'            : '',
          ].join(' ')}
        >
          {/* Big orange score */}
          <span className="text-5xl font-black text-[#ff7b20] leading-none shrink-0">
            {winScore}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Win Score</span>
            <span
              className={[
                'text-base font-bold',
                isGo      ? 'text-green-700'  : '',
                isCaution ? 'text-[#ff7b20]'  : '',
                isNoGo    ? 'text-red-600'     : '',
              ].join(' ')}
            >
              {isGo      ? 'Go — Bid It'             : ''}
              {isCaution ? 'Proceed with Caution'    : ''}
              {isNoGo    ? 'No-Go — High Risk'        : ''}
            </span>
            <p className="text-xs text-gray-500">
              {isGo
                ? 'Win probability is strong. This opportunity aligns well with your profile.'
                : isCaution
                ? 'Borderline fit. Review gaps in the analysis before committing resources.'
                : 'Win probability is low. Significant gaps exist between your profile and this RFP.'}
            </p>
          </div>
          {/* Verdict pill */}
          <span
            className={[
              'ml-auto shrink-0 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide',
              isGo      ? 'bg-green-500 text-white'   : '',
              isCaution ? 'bg-[#ff7b20] text-white'   : '',
              isNoGo    ? 'bg-red-500 text-white'      : '',
            ].join(' ')}
          >
            {isGo ? 'Go' : isCaution ? 'Caution' : 'No-Go'}
          </span>
        </div>
      )}

      {/* ── Processing status ── */}
      {isProcessing && job && (
        <div className="mb-8">
          <ProcessingStatus
            proposalId={id}
            initialStatus={job.status}
            initialError={job.error_message}
          />
        </div>
      )}

      {/* ── ANALYZED state ── */}
      {isAnalyzed && (
        <div className="space-y-4">

          {/* PRIMARY ACTION — full-width yellow-accent card */}
          <div className="rounded-xl border-l-4 border-l-[#FDFF66] border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Ready to Draft</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Analysis complete. Generate AI-drafted proposal sections in the editor.
                </p>
              </div>
              <Link
                href={`/proposals/${id}/editor`}
                className="shrink-0 px-5 py-2.5 bg-[#FDFF66] text-black text-sm font-black uppercase tracking-wide rounded-lg hover:brightness-105 transition-all shadow-sm"
              >
                Draft Proposal
              </Link>
            </div>
          </div>

          {/* SECONDARY ACTIONS grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Analysis */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Analysis</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Requirements, compliance matrix, and win probability.
                </p>
              </div>
              <Link
                href={`/proposals/${id}/analysis`}
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-all w-fit"
              >
                View Analysis
              </Link>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Questions</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Contract-specific questions that sharpen each drafted section.
                </p>
              </div>
              <Link
                href={`/proposals/${id}/questions`}
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-[#FDFF66] transition-all w-fit"
              >
                Open Questions
              </Link>
            </div>

            {/* Review */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Review</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Share drafted sections with your team for inline comments.
                </p>
              </div>
              <Link
                href={`/proposals/${id}/review`}
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-all w-fit"
              >
                Review & Comment
              </Link>
            </div>

            {/* Section Scores — conditional */}
            {hasScores && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Section Scores</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Per-criterion quality scores from the AI watchdog review.
                  </p>
                </div>
                <Link
                  href={`/proposals/${id}/scoring`}
                  className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-all w-fit"
                >
                  View Scores
                </Link>
              </div>
            )}

            {/* Red Team Evaluation */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {/* Target/crosshair icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff7b20" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  <h3 className="text-sm font-bold text-gray-900">Red Team Evaluation</h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Score your proposal as federal evaluators would — Section M criteria, SSEB verdicts.
                </p>
              </div>
              <Link
                href={`/proposals/${id}/red-team`}
                className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-[#ff7b20] transition-all w-fit"
              >
                Run Red Team
              </Link>
            </div>

            {/* Export */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Export</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Download the drafted proposal as a PDF or Word document.
                </p>
              </div>
              <div className="mt-auto">
                <ExportButtons proposalId={id} />
              </div>
            </div>

          </div>

          {/* ── Outcome Tracking ── */}
          <OutcomeSelector
            proposalId={id}
            currentOutcome={proposal.outcome ?? null}
            contractValue={proposal.contract_value ?? null}
            ppRecordId={existingPp?.id ?? null}
          />

          {/* Document metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Document Info</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Type</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">
                  {proposal.file_type === 'pdf' ? 'PDF' : 'Word (.docx)'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Pages</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">
                  {proposal.page_count ?? 'N/A'}
                </dd>
              </div>
              {proposal.is_scanned && (
                <div>
                  <dt className="text-gray-500 text-xs">OCR</dt>
                  <dd className="font-semibold text-gray-900 mt-0.5">
                    Scanned — text extracted via OCR
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* ── READY state ── */}
      {isReady && (
        <div className="space-y-4">
          {/* Document metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Document Info</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500 text-xs">Type</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">
                  {proposal.file_type === 'pdf' ? 'PDF' : 'Word (.docx)'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 text-xs">Pages</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">
                  {proposal.page_count ?? 'N/A'}
                </dd>
              </div>
              {proposal.is_scanned && (
                <div>
                  <dt className="text-gray-500 text-xs">OCR</dt>
                  <dd className="font-semibold text-gray-900 mt-0.5">
                    Scanned — text extracted via OCR
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* RFP Structure preview */}
          {proposal.rfp_structure && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">RFP Structure</h2>
              {((proposal.rfp_structure as { sections?: Array<{ number: string; title: string }> }).sections?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Sections</h3>
                  <ul className="space-y-1">
                    {(proposal.rfp_structure as { sections: Array<{ number: string; title: string }> }).sections.map(
                      (section, i: number) => (
                        <li key={i} className="text-sm text-gray-600">
                          <span className="font-mono text-gray-500 mr-2">{section.number}</span>
                          {section.title}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {((proposal.rfp_structure as { requirements?: Array<{ type: string }> }).requirements?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
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
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Extracted Text</h2>
              <div className="max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {(proposal.rfp_text as string).slice(0, 5000)}
                  {(proposal.rfp_text as string).length > 5000 && (
                    <span className="text-gray-500">
                      {'\n\n'}... ({((proposal.rfp_text as string).length / 1000).toFixed(0)}k characters total)
                    </span>
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DRAFT state — no file yet ── */}
      {!isProcessing && !isReady && !isAnalyzed && proposal.status === 'draft' && !proposal.file_name && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-gray-900 mb-1">Upload RFP Document</h2>
          <p className="text-sm text-gray-500 mb-6">
            Upload the RFP PDF or Word file to begin analysis.
          </p>
          <FileUpload proposalId={id} />
        </div>
      )}

      {/* ── Other status ── */}
      {!isProcessing && !isReady && !isAnalyzed && proposal.status !== 'draft' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">Status: {proposal.status}</p>
        </div>
      )}
    </main>
  )
}

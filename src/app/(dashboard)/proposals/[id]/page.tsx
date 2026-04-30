import { redirect, notFound } from 'next/navigation'
import { getUser, createClient } from '@/lib/supabase/server'
import { requireProposalRole } from '@/lib/auth/proposal-role'
import ProcessingStatus from '@/components/documents/ProcessingStatus'
import FileUpload from '@/components/documents/FileUpload'
import ShareButton from '@/components/team/ShareButton'
import ExportButtons from '@/components/export/ExportButtons'
import OutcomeSelector from '@/components/proposals/OutcomeSelector'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
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
    <main style={{ maxWidth: 900, padding: '0' }}>

      {/* ── GovRFP back-link banner ── */}
      {govRfpSource && (
        <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: 8, border: '1px solid #2F80FF', borderLeft: '3px solid #2F80FF', background: '#FFFFFF', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0F172A' }}>
            <span style={{ display: 'inline-flex', width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, background: '#2F80FF14', color: '#2F80FF' }} aria-hidden="true">
              <Check size={11} strokeWidth={2.5} />
            </span>
            <span>Opened from <strong>GovRFP</strong></span>
          </div>
          <a
            href={buildGovRfpOpportunityUrl(
              govRfpSource.opportunityId,
              process.env.NEXT_PUBLIC_GOVRFP_URL,
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, fontWeight: 600, color: '#2F80FF', textDecoration: 'none' }}
          >
            View source opportunity →
          </a>
        </div>
      )}

      {/* ── Back link ── */}
      <Link href="/dashboard" style={{ fontSize: 12, color: 'rgba(192,194,198,0.5)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 20 }}>
        ← Dashboard
      </Link>

      {/* ── Hero: title + share ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0, textTransform: 'uppercase' }}>
            {proposal.title}
          </h1>
          {proposal.file_name && (
            <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.5)', marginTop: 4 }}>{proposal.file_name}</p>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
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
        <div style={{ marginBottom: 24, borderRadius: 12, borderLeft: `4px solid ${isGo ? '#00C48C' : isCaution ? '#F59E0B' : '#FF4D4F'}`, background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Oxanium', sans-serif", color: isGo ? '#00C48C' : isCaution ? '#F59E0B' : '#FF4D4F', lineHeight: 1, flexShrink: 0 }}>
            {winScore}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: 'rgba(192,194,198,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.14em' }}>Win Score</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: isGo ? '#00C48C' : isCaution ? '#F59E0B' : '#FF4D4F', fontFamily: "'Space Grotesk', sans-serif" }}>
              {isGo ? 'Go — Bid It' : isCaution ? 'Proceed with Caution' : 'No-Go — High Risk'}
            </span>
            <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)', margin: 0 }}>
              {isGo
                ? 'Win probability is strong. This opportunity aligns well with your profile.'
                : isCaution
                ? 'Borderline fit. Review gaps in the analysis before committing resources.'
                : 'Win probability is low. Significant gaps exist between your profile and this RFP.'}
            </p>
          </div>
          <span style={{
            marginLeft: 'auto', flexShrink: 0, padding: '3px 10px', borderRadius: 9999,
            fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.1em',
            color: isGo ? '#00C48C' : isCaution ? '#F59E0B' : '#FF4D4F',
            background: (isGo ? '#00C48C' : isCaution ? '#F59E0B' : '#FF4D4F') + '18',
          }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* PRIMARY ACTION */}
          <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', borderRadius: 12, borderLeft: '4px solid #FF1A1A', border: '1px solid rgba(192,194,198,0.1)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0 }}>Ready to Draft</h2>
                <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)', marginTop: 4, marginBottom: 0 }}>
                  Analysis complete. Generate AI-drafted proposal sections in the editor.
                </p>
              </div>
              <Link href={`/proposals/${id}/editor`} style={{ flexShrink: 0, padding: '10px 20px', background: '#FF1A1A', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em', borderRadius: 8, textDecoration: 'none' }}>
                DRAFT PROPOSAL
              </Link>
            </div>
          </div>

          {/* SECONDARY ACTIONS grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { title: 'Analysis', desc: 'Requirements, compliance matrix, and win probability.', href: `/proposals/${id}/analysis`, cta: 'View Analysis' },
              { title: 'Questions', desc: 'Contract-specific questions that sharpen each drafted section.', href: `/proposals/${id}/questions`, cta: 'Open Questions' },
              { title: 'Review', desc: 'Share drafted sections with your team for inline comments.', href: `/proposals/${id}/review`, cta: 'Review & Comment' },
              ...(hasScores ? [{ title: 'Section Scores', desc: 'Per-criterion quality scores from the AI watchdog review.', href: `/proposals/${id}/scoring`, cta: 'View Scores' }] : []),
              { title: 'Red Team Eval', desc: 'Score as federal evaluators would — Section M criteria, SSEB verdicts.', href: `/proposals/${id}/red-team`, cta: 'Run Red Team' },
            ].map((item) => (
              <div key={item.title} style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0 }}>{item.title}</h3>
                  <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.5)', marginTop: 4, marginBottom: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
                <Link href={item.href} style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', color: '#C0C2C6', border: '1px solid rgba(192,194,198,0.15)', borderRadius: 6, padding: '5px 12px', textDecoration: 'none', width: 'fit-content' }}>
                  {item.cta.toUpperCase()}
                </Link>
              </div>
            ))}
            {/* Export */}
            <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0 }}>Export</h3>
                <p style={{ fontSize: 11, color: 'rgba(192,194,198,0.5)', marginTop: 4, marginBottom: 0 }}>Download the drafted proposal as a PDF or Word document.</p>
              </div>
              <div style={{ marginTop: 'auto' }}>
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
          <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 14 }}>Document Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>Type</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.file_type === 'pdf' ? 'PDF' : 'Word (.docx)'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>Pages</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.page_count ?? 'N/A'}</div>
              </div>
              {proposal.is_scanned && (
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>OCR</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>Scanned — text extracted via OCR</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── READY state ── */}
      {isReady && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 14 }}>Document Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>Type</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.file_type === 'pdf' ? 'PDF' : 'Word (.docx)'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>Pages</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace" }}>{proposal.page_count ?? 'N/A'}</div>
              </div>
              {proposal.is_scanned && (
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.45)', marginBottom: 2 }}>OCR</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>Scanned — text extracted via OCR</div>
                </div>
              )}
            </div>
          </div>

          {proposal.rfp_structure && (
            <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 14 }}>RFP Structure</div>
              {((proposal.rfp_structure as { sections?: Array<{ number: string; title: string }> }).sections?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#C0C2C6', marginBottom: 8 }}>Sections</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(proposal.rfp_structure as { sections: Array<{ number: string; title: string }> }).sections.map(
                      (section, i: number) => (
                        <li key={i} style={{ fontSize: 12, color: 'rgba(192,194,198,0.7)' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', marginRight: 8 }}>{section.number}</span>
                          {section.title}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {proposal.rfp_text && (
            <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(192,194,198,0.45)', marginBottom: 14 }}>Extracted Text</div>
              <div style={{ maxHeight: 384, overflowY: 'auto' }}>
                <pre style={{ fontSize: 12, color: 'rgba(192,194,198,0.7)', whiteSpace: 'pre-wrap', fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6 }}>
                  {(proposal.rfp_text as string).slice(0, 5000)}
                  {(proposal.rfp_text as string).length > 5000 && `\n\n... (${((proposal.rfp_text as string).length / 1000).toFixed(0)}k characters total)`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DRAFT state — from SAM.gov opportunity ── */}
      {!isProcessing && !isReady && !isAnalyzed && proposal.status === 'draft' && !proposal.file_name && proposal.opportunity_id && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', borderRadius: 12, borderLeft: '4px solid #FF1A1A', border: '1px solid rgba(192,194,198,0.1)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0 }}>Ready to Draft</h2>
                <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)', marginTop: 4, marginBottom: 0 }}>
                  Proposal created from SAM.gov. Go to the editor to start writing, or upload the RFP PDF for deeper AI analysis.
                </p>
              </div>
              <Link href={`/proposals/${id}/editor`} style={{ flexShrink: 0, padding: '10px 20px', background: '#FF1A1A', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.06em', borderRadius: 8, textDecoration: 'none' }}>
                START WRITING
              </Link>
            </div>
          </div>
          <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7', margin: 0, marginBottom: 4 }}>Optional: Upload RFP for AI Analysis</h2>
            <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)', marginBottom: 16 }}>
              Download the RFP PDF from SAM.gov and upload it here to extract requirements, generate a compliance matrix, and get a win score.
            </p>
            <FileUpload proposalId={id} />
          </div>
        </div>
      )}

      {/* ── DRAFT state — no file yet ── */}
      {!isProcessing && !isReady && !isAnalyzed && proposal.status === 'draft' && !proposal.file_name && !proposal.opportunity_id && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#F5F5F7', margin: 0, marginBottom: 4 }}>Upload RFP Document</h2>
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.6)', marginBottom: 20 }}>Upload the RFP PDF or Word file to begin analysis.</p>
          <FileUpload proposalId={id} />
        </div>
      )}

      {/* ── Other status ── */}
      {!isProcessing && !isReady && !isAnalyzed && proposal.status !== 'draft' && (
        <div style={{ background: 'rgba(26,29,33,0.72)', backdropFilter: 'blur(20px)', border: '1px solid rgba(192,194,198,0.1)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'rgba(192,194,198,0.5)' }}>Status: {proposal.status}</p>
        </div>
      )}
    </main>
  )
}

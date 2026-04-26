import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Calendar, FileText } from 'lucide-react';

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: '#2F80FF', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{score}</span>
    </div>
  );
}

export default async function ProposalsPage() {
  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false });

  const statusColors: Record<string, string> = {
    draft: '#475569', processing: '#475569', ready: '#2F80FF',
    in_review: '#2F80FF', submitted: '#475569', won: '#00C48C', lost: '#FF4D4F', archived: '#94A3B8',
  };
  const statusLabels: Record<string, string> = {
    draft: 'Draft', processing: 'Processing', ready: 'Ready',
    in_review: 'In Review', submitted: 'Submitted', won: 'Won', lost: 'No-Go', archived: 'Archived',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em' }}>
            All Proposals
          </h1>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
            {proposals?.length ?? 0} proposals
          </p>
        </div>
        <Link
          href="/proposals/new"
          style={{
            background: '#2F80FF', color: '#fff', borderRadius: 8, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={15} strokeWidth={1.5} />
          New Proposal
        </Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '10px 20px', borderBottom: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.10em', color: '#475569' }}>
          <span>Proposal</span>
          <span>Created</span>
          <span>Status</span>
        </div>

        {proposals && proposals.length > 0 ? (
          proposals.map((p) => {
            const statusColor = statusColors[p.status ?? 'draft'] ?? '#475569';
            const statusLabel = statusLabels[p.status ?? 'draft'] ?? 'Draft';
            const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

            return (
              <Link
                key={p.id}
                href={`/proposals/${p.id}/editor`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px',
                  padding: '13px 20px', borderBottom: '1px solid #F8FAFC',
                  borderLeft: '2px solid #2F80FF', textDecoration: 'none', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{p.title}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} strokeWidth={1.5} />
                  {createdDate}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: statusColor, background: `${statusColor}14`, padding: '2px 7px', borderRadius: 4, display: 'inline-block' }}>
                  {statusLabel}
                </span>
              </Link>
            );
          })
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center' as const }}>
            <FileText size={32} strokeWidth={1} style={{ color: '#E2E8F0', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>No proposals yet</p>
            <Link href="/proposals/new" style={{ fontSize: 13, color: '#2F80FF' }}>
              Create your first proposal →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

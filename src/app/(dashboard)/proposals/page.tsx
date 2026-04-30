import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, Calendar, FileText } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';

export default async function ProposalsPage() {
  const supabase = await createClient();
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false });

  const statusColors: Record<string, string> = {
    draft: '#C0C2C6',
    processing: '#C0C2C6',
    ready: '#00C48C',
    in_review: '#F59E0B',
    submitted: '#F59E0B',
    won: '#00C48C',
    lost: '#FF4D4F',
    archived: 'rgba(192,194,198,0.4)',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    processing: 'Processing',
    ready: 'Ready',
    in_review: 'In Review',
    submitted: 'Submitted',
    won: 'Won',
    lost: 'No-Go',
    archived: 'Archived',
  };

  const allProposals = proposals ?? [];
  const totalCount = allProposals.length;
  const activeCount = allProposals.filter(p =>
    p.status === 'ready' || p.status === 'in_review' || p.status === 'processing'
  ).length;
  const submittedCount = allProposals.filter(p => p.status === 'submitted').length;

  return (
    <div>
      {/* Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.6)', flexShrink: 0 }} />
            <h1 style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Proposal Vault
            </h1>
            <span style={{
              fontSize: 9,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#FF1A1A',
              background: 'rgba(255,26,26,0.12)',
              border: '1px solid rgba(255,26,26,0.3)',
              borderRadius: 3,
              padding: '2px 7px',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              {totalCount} total
            </span>
          </div>
          <p style={{ fontSize: 10.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.07em', paddingLeft: 15, margin: '4px 0 0' }}>
            Government proposal intelligence &amp; workflow tracking
          </p>
        </div>
        <Link
          href="/proposals/new"
          style={{
            background: '#FF1A1A',
            color: '#fff',
            borderRadius: 6,
            padding: '9px 16px',
            fontFamily: "'Oxanium', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: 11,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 0 16px rgba(255,26,26,0.25)',
          }}
        >
          <Plus size={13} strokeWidth={2} />
          New Proposal
        </Link>
      </div>

      {/* Quick-stat KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <GlassPanel style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Total</div>
          <div style={{ fontSize: 38, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#F5F5F7', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>{totalCount}</div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', letterSpacing: '0.06em' }}>All proposals in vault</div>
        </GlassPanel>

        <GlassPanel variant="accent" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Active</div>
          <div style={{ fontSize: 38, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#FF1A1A', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>{activeCount}</div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', letterSpacing: '0.06em' }}>In progress</div>
        </GlassPanel>

        <GlassPanel variant="gold" style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#C0C2C6', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Submitted</div>
          <div style={{ fontSize: 38, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>{submittedCount}</div>
          <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(192,194,198,0.45)', letterSpacing: '0.06em' }}>Awaiting decision</div>
        </GlassPanel>
      </div>

      {/* Proposals table */}
      <GlassPanel noPad>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 120px',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(192,194,198,0.08)',
          fontSize: 9,
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'rgba(192,194,198,0.45)',
        }}>
          <span>Proposal</span>
          <span>Created</span>
          <span>Status</span>
        </div>

        {allProposals.length > 0 ? (
          allProposals.map((p) => {
            const statusColor = statusColors[p.status ?? 'draft'] ?? '#C0C2C6';
            const statusLabel = statusLabels[p.status ?? 'draft'] ?? 'Draft';
            const createdDate = p.created_at
              ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—';

            return (
              <Link
                key={p.id}
                href={`/proposals/${p.id}/editor`}
                className="glass-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 120px',
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(192,194,198,0.06)',
                  borderLeft: '2px solid rgba(255,26,26,0.4)',
                  textDecoration: 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>{p.title}</span>
                <span style={{
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#C0C2C6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  letterSpacing: '0.04em',
                }}>
                  <Calendar size={10} strokeWidth={1.5} />
                  {createdDate}
                </span>
                <span style={{
                  fontSize: 9,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: statusColor,
                  background: `${statusColor}18`,
                  border: `1px solid ${statusColor}30`,
                  borderRadius: 3,
                  padding: '2px 7px',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  display: 'inline-block',
                }}>
                  {statusLabel}
                </span>
              </Link>
            );
          })
        ) : (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <FileText size={32} strokeWidth={1} style={{ color: 'rgba(192,194,198,0.2)', margin: '0 auto 14px', display: 'block' }} />
            <p style={{ fontSize: 13, color: '#C0C2C6', marginBottom: 8, fontFamily: "'Oxanium', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              No proposals yet
            </p>
            <Link href="/proposals/new" style={{ fontSize: 11, color: '#FF1A1A', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em', textDecoration: 'none' }}>
              Create your first proposal →
            </Link>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Search, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { getProfile } from '@/app/(dashboard)/profile/actions';
import { scoreOpportunity, matchLabel } from '@/lib/matching/opportunity-scorer';
import type { ProfileFormData } from '@/lib/validators/profile';
import { GlassPanel } from '@/components/ui/GlassPanel';

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  let opportunities: any[] = [];
  try {
    const { data } = await (supabase as any)
      .from('opportunities')
      .select('id, title, agency, agency_name, naics_code, set_aside, set_aside_description, due_date, response_deadline, estimated_value, match_score, solicitation_number, place_of_performance_state, pop_state')
      .eq('active', true)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50);
    opportunities = (data ?? []).map((opp: any) => ({
      ...opp,
      agency: opp.agency ?? opp.agency_name ?? null,
      set_aside: opp.set_aside ?? opp.set_aside_description ?? null,
      due_date: opp.due_date ?? opp.response_deadline ?? null,
      place_of_performance_state: opp.place_of_performance_state ?? opp.pop_state ?? null,
    }));
  } catch {
    opportunities = [];
  }

  const profile = await getProfile() as Partial<ProfileFormData> | null;

  const profileIncomplete =
    !profile ||
    ((profile.naics_codes ?? []).length === 0 && (profile.certifications ?? []).length === 0);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 3, height: 22, background: '#FF1A1A', borderRadius: 2, boxShadow: '0 0 8px rgba(255,26,26,0.6)', flexShrink: 0 }} />
          <h1 style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>OPPORTUNITY SCAN</h1>
        </div>
        <p style={{ fontSize: 10.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.07em', paddingLeft: 15, margin: '4px 0 0' }}>
          {opportunities.length} LIVE SAM.GOV CONTRACTS
        </p>
      </div>

      {/* Profile incomplete banner */}
      {profileIncomplete && (
        <GlassPanel variant="gold" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={14} strokeWidth={1.5} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: '#F59E0B', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
            PROFILE INCOMPLETE — match scores are estimated.{' '}
            <Link href="/profile" style={{ color: '#D4AF37', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.06em' }}>
              COMPLETE PROFILE
            </Link>
          </span>
        </GlassPanel>
      )}

      {/* Filter bar */}
      <GlassPanel noPad style={{ marginBottom: 20 }}>
        <div style={{ padding: '11px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(11,11,13,0.5)', border: '1px solid rgba(192,194,198,0.12)', borderRadius: 6, padding: '7px 12px' }}>
            <Search size={13} strokeWidth={1.5} style={{ color: '#C0C2C6', flexShrink: 0 }} />
            <input
              placeholder="SEARCH BY KEYWORD, AGENCY, OR NAICS..."
              style={{
                border: 'none',
                background: 'none',
                fontSize: 11,
                color: '#F5F5F7',
                outline: 'none',
                flex: 1,
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.05em',
              }}
            />
          </div>
          <button style={{ background: 'transparent', border: '1px solid rgba(255,26,26,0.3)', color: '#FF1A1A', borderRadius: 6, fontSize: 10, padding: '6px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Oxanium', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <SlidersHorizontal size={11} strokeWidth={1.5} />
            FILTERS
          </button>
        </div>
      </GlassPanel>

      {/* Opportunity cards */}
      {opportunities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opportunities.map((opp: any) => {
            const dueDate = opp.due_date ? new Date(opp.due_date) : null;
            const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
            const dateColor =
              daysLeft !== null && daysLeft <= 1
                ? '#FF4D4F'
                : daysLeft !== null && daysLeft <= 7
                  ? '#F59E0B'
                  : '#C0C2C6';

            const value = opp.estimated_value
              ? opp.estimated_value >= 1_000_000
                ? `$${(opp.estimated_value / 1_000_000).toFixed(1)}M`
                : `$${(opp.estimated_value / 1_000).toFixed(0)}K`
              : 'TBD';

            const liveScore = profile
              ? scoreOpportunity(
                  {
                    certifications: profile.certifications ?? [],
                    naics_codes: profile.naics_codes ?? [],
                    construction_types: (profile.construction_types ?? []) as string[],
                    geographic_states: profile.geographic_states ?? [],
                    primary_state: profile.primary_state ?? null,
                    annual_revenue_usd: profile.annual_revenue_usd ?? null,
                    bonding_single_usd: profile.bonding_single_usd ?? null,
                    max_project_size_usd: profile.max_project_size_usd ?? null,
                    sba_size_category: profile.sba_size_category ?? null,
                  },
                  {
                    naics_code: opp.naics_code,
                    set_aside: opp.set_aside,
                    place_of_performance_state: opp.place_of_performance_state ?? null,
                    estimated_value: opp.estimated_value ?? null,
                    title: opp.title ?? null,
                  },
                ).total
              : (opp.match_score ?? 0);

            const label = matchLabel(liveScore);

            const borderColor =
              label === 'Strong Match'
                ? '#00C48C'
                : label === 'Good Match'
                  ? '#D4AF37'
                  : label === 'Moderate Match'
                    ? '#F59E0B'
                    : 'rgba(192,194,198,0.3)';

            const scoreColor =
              label === 'Strong Match'
                ? '#00C48C'
                : label === 'Good Match'
                  ? '#D4AF37'
                  : label === 'Moderate Match'
                    ? '#F59E0B'
                    : '#C0C2C6';

            const deadlineLabel =
              daysLeft !== null && daysLeft >= 0
                ? `T-${daysLeft}d`
                : dueDate
                  ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';

            return (
              <GlassPanel
                key={opp.id}
                noPad
                style={{ borderLeft: `2px solid ${borderColor}`, overflow: 'hidden' }}
              >
                {/* Card header */}
                <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/opportunities/${opp.id}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#F5F5F7',
                        textDecoration: 'none',
                        display: 'block',
                        lineHeight: 1.4,
                        marginBottom: 4,
                      }}
                    >
                      {opp.title}
                    </Link>
                    <div style={{ fontSize: 10.5, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.04em' }}>
                      {opp.agency}{opp.solicitation_number ? ` · ${opp.solicitation_number}` : ''}
                    </div>
                  </div>
                  {/* Score block */}
                  <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
                    <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: scoreColor, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {liveScore}%
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: scoreColor,
                        background: `${scoreColor}18`,
                        border: `1px solid ${scoreColor}30`,
                        borderRadius: 3,
                        padding: '2px 7px',
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase' as const,
                      }}>
                        {label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadata row */}
                <div style={{ padding: '0 18px 12px', display: 'flex', flexWrap: 'wrap' as const, gap: '6px 18px', alignItems: 'center' }}>
                  {opp.naics_code && (
                    <span style={{ fontSize: 10, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
                      NAICS {opp.naics_code}
                    </span>
                  )}
                  {opp.set_aside && (
                    <span style={{ fontSize: 10, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
                      {opp.set_aside}
                    </span>
                  )}
                  <span style={{ fontSize: 10.5, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#D4AF37', letterSpacing: '0.04em' }}>
                    {value}
                  </span>
                </div>

                {/* Footer row */}
                <div style={{ padding: '10px 18px', borderTop: '1px solid rgba(192,194,198,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{
                    fontSize: 10.5,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: dateColor,
                    letterSpacing: '0.06em',
                    fontWeight: daysLeft !== null && daysLeft <= 7 ? 700 : 400,
                  }}>
                    {deadlineLabel}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ background: 'transparent', border: '1px solid rgba(255,26,26,0.3)', color: '#FF1A1A', borderRadius: 6, fontSize: 10, padding: '6px 11px', cursor: 'pointer', fontFamily: "'Oxanium', sans-serif", fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                      TRACK
                    </button>
                    <Link
                      href={`/opportunities/${opp.id}`}
                      style={{ background: '#FF1A1A', color: '#fff', borderRadius: 6, fontFamily: "'Oxanium', sans-serif", textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontSize: 11, fontWeight: 700, padding: '9px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      OPEN IN NEXUS &rarr;
                    </Link>
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      ) : (
        <GlassPanel style={{ padding: '52px 20px', textAlign: 'center' as const }}>
          <Search size={30} strokeWidth={1} style={{ color: 'rgba(192,194,198,0.2)', margin: '0 auto 14px', display: 'block' }} />
          <div style={{ fontSize: 11, color: '#C0C2C6', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            NO OPPORTUNITIES FOUND
          </div>
          <div style={{ fontSize: 10, color: 'rgba(192,194,198,0.5)', fontFamily: "'IBM Plex Mono', monospace", marginTop: 6, letterSpacing: '0.05em' }}>
            Update your profile to improve matches.
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

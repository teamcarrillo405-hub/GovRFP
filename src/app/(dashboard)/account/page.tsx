import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { checkSubscription, type SubscriptionStatus } from '@/lib/billing/subscription-check'
import { BillingButtons } from './billing-buttons'
import { GlassPanel } from '@/components/ui/GlassPanel'

interface AccountPageProps {
  searchParams: Promise<{ success?: string; canceled?: string }>
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Oxanium', sans-serif",
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#C0C2C6',
  marginBottom: 16,
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid rgba(192,194,198,0.07)',
  fontSize: 13,
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const colors: Record<SubscriptionStatus, string> = {
    trialing: '#2F80FF',
    active: '#00C48C',
    past_due: '#F59E0B',
    canceled: '#FF4D4F',
    none: 'rgba(192,194,198,0.5)',
  }
  const labels: Record<SubscriptionStatus, string> = {
    trialing: 'TRIAL',
    active: 'ACTIVE',
    past_due: 'PAST DUE',
    canceled: 'CANCELED',
    none: 'NO SUB',
  }
  const color = colors[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 9999,
      padding: '3px 10px',
      fontSize: 9,
      fontWeight: 700,
      fontFamily: "'Oxanium', sans-serif",
      letterSpacing: '0.1em',
      color,
      background: color + '18',
      border: `1px solid ${color}30`,
    }}>
      {labels[status]}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const subscription = await checkSubscription(user.id)
  const params = await searchParams

  const showSuccess = params.success === 'true'
  const showCanceled = params.canceled === 'true'
  const showStartTrial = subscription.status === 'none' || subscription.status === 'canceled'
  const showManageBilling = !!profile?.stripe_customer_id

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Oxanium', sans-serif", color: '#F5F5F7', letterSpacing: '-0.01em', margin: 0 }}>
          Account Settings
        </h1>
      </div>

      {showSuccess && (
        <GlassPanel variant="default" style={{ marginBottom: 20, padding: '12px 16px', fontSize: 13, color: '#00C48C', fontWeight: 500, borderColor: 'rgba(0,196,140,0.25)' }}>
          Your subscription has been activated. Welcome aboard.
        </GlassPanel>
      )}

      {showCanceled && (
        <GlassPanel variant="default" style={{ marginBottom: 20, padding: '12px 16px', fontSize: 13, color: '#F59E0B', fontWeight: 500, borderColor: 'rgba(245,158,11,0.25)' }}>
          Checkout was canceled. You have not been charged.
        </GlassPanel>
      )}

      {/* Account Info */}
      <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
        <div style={SECTION_LABEL}>Account</div>
        <div style={{ ...ROW, borderBottom: 'none' }}>
          <span style={{ color: 'rgba(192,194,198,0.55)' }}>Email</span>
          <span style={{ color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{user.email}</span>
        </div>
      </GlassPanel>

      {/* Subscription Info */}
      <GlassPanel style={{ padding: 24, marginBottom: 16 }}>
        <div style={SECTION_LABEL}>Subscription</div>
        <div style={ROW}>
          <span style={{ color: 'rgba(192,194,198,0.55)' }}>Status</span>
          <StatusBadge status={subscription.status} />
        </div>

        {subscription.status === 'trialing' && subscription.trialEndsAt && (
          <div style={{ ...ROW }}>
            <span style={{ color: 'rgba(192,194,198,0.55)' }}>Trial ends</span>
            <span style={{ color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{formatDate(subscription.trialEndsAt)}</span>
          </div>
        )}

        {subscription.status === 'active' && subscription.currentPeriodEnd && (
          <div style={{ ...ROW, borderBottom: 'none' }}>
            <span style={{ color: 'rgba(192,194,198,0.55)' }}>Next billing date</span>
            <span style={{ color: '#F5F5F7', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
        )}
      </GlassPanel>

      {/* Billing Actions */}
      <GlassPanel style={{ padding: 24 }}>
        <div style={SECTION_LABEL}>Billing</div>
        <BillingButtons
          showStartTrial={showStartTrial}
          showManageBilling={showManageBilling}
        />
        {!showStartTrial && !showManageBilling && (
          <p style={{ fontSize: 12, color: 'rgba(192,194,198,0.45)', margin: 0 }}>
            No billing actions available for your current subscription state.
          </p>
        )}
      </GlassPanel>
    </div>
  )
}

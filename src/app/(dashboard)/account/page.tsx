import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { checkSubscription, type SubscriptionStatus } from '@/lib/billing/subscription-check'
import { BillingButtons } from './billing-buttons'

interface AccountPageProps {
  searchParams: Promise<{ success?: string; canceled?: string }>
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const textColors: Record<SubscriptionStatus, string> = {
    trialing: '#2F80FF',
    active: '#00C48C',
    past_due: '#F59E0B',
    canceled: '#FF4D4F',
    none: '#94A3B8',
  }
  const labels: Record<SubscriptionStatus, string> = {
    trialing: 'Trial',
    active: 'Active',
    past_due: 'Past Due',
    canceled: 'Canceled',
    none: 'No Subscription',
  }
  const color = textColors[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      borderRadius: 9999, padding: '2px 10px',
      fontSize: 10.5, fontWeight: 700,
      color,
      background: color + '14',
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
  if (!user) {
    redirect('/login')
  }

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
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

      {showSuccess && (
        <div style={{ marginBottom: 24, borderRadius: 8, border: '1px solid #00C48C', background: '#FFFFFF', padding: '12px 16px', fontSize: 13, color: '#00C48C', fontWeight: 500 }}>
          Your subscription has been activated. Welcome aboard.
        </div>
      )}

      {showCanceled && (
        <div style={{ marginBottom: 24, borderRadius: 8, border: '1px solid #F59E0B', background: '#FFFFFF', padding: '12px 16px', fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>
          Checkout was canceled. You have not been charged.
        </div>
      )}

      {/* Account Info */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900 font-medium">{user.email}</span>
          </div>
        </div>
      </section>

      {/* Subscription Info */}
      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Status</span>
            <StatusBadge status={subscription.status} />
          </div>

          {subscription.status === 'trialing' && subscription.trialEndsAt && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Trial ends</span>
              <span className="text-gray-900">{formatDate(subscription.trialEndsAt)}</span>
            </div>
          )}

          {subscription.status === 'active' && subscription.currentPeriodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Next billing date</span>
              <span className="text-gray-900">{formatDate(subscription.currentPeriodEnd)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Billing Actions */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Billing</h2>
        <BillingButtons
          showStartTrial={showStartTrial}
          showManageBilling={showManageBilling}
        />
        {!showStartTrial && !showManageBilling && (
          <p className="text-sm text-gray-500">
            No billing actions available for your current subscription state.
          </p>
        )}
      </section>
    </main>
  )
}

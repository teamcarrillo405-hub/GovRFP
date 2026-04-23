import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { checkSubscription } from '@/lib/billing/subscription-check'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const subscription = await checkSubscription(user.id)
  const showBanner = subscription.status === 'past_due' || subscription.status === 'canceled'

  return (
    <div className="min-h-screen bg-white">
      <PageHeader userEmail={user.email} />

      {/* Billing alert banner — below fixed header */}
      {showBanner && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-red-600 text-white px-4 py-2.5 text-center text-sm font-sans flex items-center justify-center gap-3">
          <span>
            {subscription.status === 'past_due'
              ? 'Your payment is past due. Please update your billing information to restore access.'
              : 'Your subscription has been canceled. Renew to continue using AI features.'}
          </span>
          <Link
            href="/account"
            className="underline font-semibold hover:text-gray-100 transition-colors"
          >
            Manage billing
          </Link>
        </div>
      )}

      {/* Page content — padded below 56px fixed header */}
      <div className={showBanner ? 'pt-[96px]' : 'pt-14'}>
        {children}
      </div>
    </div>
  )
}

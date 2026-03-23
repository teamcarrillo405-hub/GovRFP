import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { checkSubscription } from '@/lib/billing/subscription-check'
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
    <div className="min-h-screen bg-gray-50">
      {showBanner && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-sm">
          {subscription.status === 'past_due'
            ? 'Your payment is past due. Please update your billing information to restore access.'
            : 'Your subscription has been canceled. Renew to continue using AI features.'}
          {' '}
          <Link href="/account" className="underline font-semibold ml-1">
            Manage billing
          </Link>
        </div>
      )}
      {children}
    </div>
  )
}

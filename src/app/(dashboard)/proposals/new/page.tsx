import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import FileUpload from '@/components/documents/FileUpload'
import Link from 'next/link'

export default async function NewProposalPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const subscription = await checkSubscription(user.id)

  if (!isSubscriptionActive(subscription.status)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Upload RFP</h1>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <p className="text-sm text-yellow-800 mb-3">
            An active subscription is required to upload documents and create proposals.
          </p>
          <Link
            href="/account"
            className="text-sm font-medium text-yellow-900 underline hover:text-yellow-700"
          >
            Manage subscription
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload RFP</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload a government RFP document (PDF or Word) to start building your proposal.
        Scanned PDFs are automatically processed with OCR.
      </p>
      <FileUpload />
    </main>
  )
}

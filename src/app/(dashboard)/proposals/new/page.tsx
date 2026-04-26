import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/supabase/server'
import { checkSubscription, isSubscriptionActive } from '@/lib/billing/subscription-check'
import FileUpload from '@/components/documents/FileUpload'
import { GovRfpHandoffPanel } from '@/components/proposals/GovRfpHandoffPanel'
import { parseGovRfpHandoff, type RawGovRfpSearchParams } from '@/lib/bridge/govrfp-handoff'

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<RawGovRfpSearchParams>
}) {
  const user = await getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const govRfpHandoff = parseGovRfpHandoff(params)

  const subscription = await checkSubscription(user.id)

  if (!isSubscriptionActive(subscription.status)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {govRfpHandoff ? 'Continue from GovRFP' : 'Upload RFP'}
        </h1>
        <div className="rounded-lg border border-[#F59E0B] bg-white p-6">
          <p className="text-sm text-[#F59E0B] mb-3">
            An active subscription is required to create proposals.
          </p>
          {govRfpHandoff && (
            <p className="text-sm text-[#F59E0B] mb-3">
              The opportunity{' '}
              <strong>&ldquo;{govRfpHandoff.title}&rdquo;</strong> is waiting — your
              GovRFP handoff is preserved in this URL. Activate your ProposalAI
              subscription and refresh this page to continue.
            </p>
          )}
          <Link
            href="/account"
            className="text-sm font-medium text-[#2F80FF] underline hover:brightness-110"
          >
            Manage subscription
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block"
      >
        Back to Dashboard
      </Link>

      {govRfpHandoff ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Start a new proposal
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            You arrived from GovRFP. Confirm the opportunity below and create the
            proposal — you&rsquo;ll upload the full RFP PDF for analysis on the next
            page.
          </p>
          <GovRfpHandoffPanel metadata={govRfpHandoff} />
          <div className="mt-12 pt-8 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Or skip the GovRFP handoff and upload an RFP PDF directly
            </h2>
            <FileUpload />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload RFP</h1>
          <p className="text-sm text-gray-500 mb-8">
            Upload a government RFP document (PDF or Word) to start building your
            proposal. Scanned PDFs are automatically processed with OCR.
          </p>
          <FileUpload />
        </>
      )}
    </main>
  )
}

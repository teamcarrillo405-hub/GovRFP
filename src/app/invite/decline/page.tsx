'use client'
import { Suspense } from 'react'
import InviteDeclineContent from './InviteDeclineContent'

export default function InviteDeclinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <Suspense fallback={<p className="text-sm text-gray-500 text-center">Processing...</p>}>
          <InviteDeclineContent />
        </Suspense>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

interface BillingButtonsProps {
  showStartTrial: boolean
  showManageBilling: boolean
}

export function BillingButtons({ showStartTrial, showManageBilling }: BillingButtonsProps) {
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStartTrial() {
    setLoadingCheckout(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start checkout. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoadingCheckout(false)
    }
  }

  async function handleManageBilling() {
    setLoadingPortal(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to open billing portal. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoadingPortal(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {showStartTrial && (
        <button
          onClick={handleStartTrial}
          disabled={loadingCheckout}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingCheckout ? 'Redirecting...' : 'Start Free Trial'}
        </button>
      )}
      {showManageBilling && (
        <button
          onClick={handleManageBilling}
          disabled={loadingPortal}
          className="w-full rounded-md bg-gray-100 border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loadingPortal ? 'Redirecting...' : 'Manage Billing'}
        </button>
      )}
    </div>
  )
}

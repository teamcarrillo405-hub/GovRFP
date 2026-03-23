import { createClient } from '@/lib/supabase/server'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'none'

export interface SubscriptionInfo {
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isActive: boolean // true for 'trialing' or 'active'
}

export async function checkSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, current_period_end')
    .eq('id', userId)
    .single()

  if (!data) return { status: 'none', trialEndsAt: null, currentPeriodEnd: null, isActive: false }

  const status = (data.subscription_status as SubscriptionStatus) || 'none'
  return {
    status,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    isActive: status === 'trialing' || status === 'active',
  }
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active'
}

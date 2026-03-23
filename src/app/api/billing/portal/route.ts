import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/server'

export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = profile?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json(
      { error: 'No billing account found. Please start a subscription first.' },
      { status: 400 }
    )
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/account`,
  })

  return NextResponse.json({ url: session.url })
}

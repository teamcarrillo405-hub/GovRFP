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

  // Look up existing stripe_customer_id
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id

  // Create Stripe customer if none exists
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    // Save customer ID back to profiles
    await adminSupabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  // Create Checkout session with 14-day no-card trial
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
    payment_method_collection: 'if_required',
    success_url: `${process.env.NEXT_PUBLIC_URL}/account?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/account?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}

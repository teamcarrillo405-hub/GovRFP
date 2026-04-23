import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
    case 'unpaid':
      return 'canceled'
    default:
      return 'canceled'
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`Webhook signature verification failed: ${message}`)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerStripeId = session.customer as string
      const subscriptionId = session.subscription as string

      // Determine if trial or active
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const status = mapStripeStatus(subscription.status)

      await adminSupabase
        .from('profiles')
        .update({
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
        })
        .eq('stripe_customer_id', customerStripeId)

      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerStripeId = invoice.customer as string
      const periodEnd = invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null

      await adminSupabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          current_period_end: periodEnd,
        })
        .eq('stripe_customer_id', customerStripeId)

      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerStripeId = subscription.customer as string
      const status = mapStripeStatus(subscription.status)

      const updates: Record<string, unknown> = { subscription_status: status }
      if (subscription.trial_end) {
        updates.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString()
      }
      // current_period_end lives on the subscription item in Stripe v20
      const firstItem = subscription.items?.data?.[0]
      if (firstItem?.current_period_end) {
        updates.current_period_end = new Date(firstItem.current_period_end * 1000).toISOString()
      }

      await adminSupabase
        .from('profiles')
        .update(updates)
        .eq('stripe_customer_id', customerStripeId)

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerStripeId = subscription.customer as string

      await adminSupabase
        .from('profiles')
        .update({ subscription_status: 'canceled' })
        .eq('stripe_customer_id', customerStripeId)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerStripeId = invoice.customer as string

      await adminSupabase
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerStripeId)

      break
    }

    case 'customer.subscription.trial_will_end': {
      // Log for now — email notification will be added in a future phase
      const subscription = event.data.object as Stripe.Subscription
      console.log(`Trial ending soon for customer: ${subscription.customer}`)
      break
    }

    default:
      // Ignore unhandled event types
      break
  }

  return NextResponse.json({ received: true })
}

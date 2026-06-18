import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const orgId = session.metadata?.organization_id
    if (!orgId || !session.subscription) return NextResponse.json({ ok: true })

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const item = subscription.items.data[0]
    const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end

    await admin.from('subscriptions').upsert({
      organization_id: orgId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      seat_count: item.quantity ?? 0,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
    }, { onConflict: 'organization_id' })
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const orgId = subscription.metadata?.organization_id
    if (!orgId) return NextResponse.json({ ok: true })

    const item = subscription.items.data[0]
    const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end
    await admin.from('subscriptions').update({
      status: subscription.status,
      seat_count: item?.quantity ?? 0,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
    }).eq('organization_id', orgId)
  }

  return NextResponse.json({ ok: true })
}

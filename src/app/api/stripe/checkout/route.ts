import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, PRICE_MONTHLY, PRICE_ANNUAL } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { interval, seatCount } = await req.json() as { interval: 'month' | 'year'; seatCount: number }

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .single()
  if (!org) return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 })

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', org.id)
    .single()

  let customerId = sub?.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { organization_id: org.id },
    })
    customerId = customer.id
  }

  const priceId = interval === 'year' ? PRICE_ANNUAL : PRICE_MONTHLY
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: seatCount }],
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/settings/billing`,
    metadata: { organization_id: org.id },
    subscription_data: { metadata: { organization_id: org.id } },
  })

  return NextResponse.json({ url: session.url })
}

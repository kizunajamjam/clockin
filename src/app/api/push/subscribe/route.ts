import { NextRequest, NextResponse } from 'next/server'
import { getAuthedStaff } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const ctx = await getAuthedStaff()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint, p256dh, auth } = await req.json()
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  await ctx.admin.from('push_subscriptions').upsert(
    { staff_id: ctx.staffId, endpoint, p256dh, auth },
    { onConflict: 'staff_id,endpoint' }
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthedStaff()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json()

  await ctx.admin.from('push_subscriptions').delete()
    .eq('staff_id', ctx.staffId)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}

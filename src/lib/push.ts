// Web Push 送信ユーティリティ
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を .env.local に設定してください
// 生成方法: npx web-push generate-vapid-keys

type PushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

type PushPayload = {
  title: string
  body: string
  url?: string
}

export async function sendPushNotification(subscription: PushSubscription, payload: PushPayload) {
  const webpush = await import('web-push')

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'

  if (!vapidPublic || !vapidPrivate) {
    console.warn('[push] VAPID keys not configured — skipping push notification')
    return
  }

  webpush.default.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate)

  try {
    await webpush.default.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload)
    )
  } catch (err) {
    console.error('[push] send failed:', err)
  }
}

export async function sendPushToStaff(staffId: string, payload: PushPayload) {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('staff_id', staffId)
  if (!subs?.length) return

  await Promise.all(subs.map(s => sendPushNotification(s, payload)))
}

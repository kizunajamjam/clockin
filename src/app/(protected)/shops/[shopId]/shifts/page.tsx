import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ShiftCalendar } from './ShiftCalendar'

export default async function ShiftsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id, week_start').eq('id', shopId).single()
  if (!shop) notFound()
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const { data: sub } = await admin.from('subscriptions').select('status').eq('organization_id', shop.organization_id).single()
  const isPro = sub?.status === 'active' || sub?.status === 'trialing'

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
          <h1 className="font-bold text-lg">シフト管理</h1>
        </header>
        <main className="max-w-lg mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
            <p className="text-2xl">🔒</p>
            <p className="font-semibold">プロプランの機能です</p>
            <p className="text-sm text-gray-500">シフト作成・共有はプロプランで利用できます</p>
            <Link href="/settings/billing"
              className="inline-block mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
              プロプランを見る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // 今週〜3週間分のシフトを取得（境界は日本時間で算出する）
  // 表示が日曜始まりの店舗でも先頭の日曜を取りこぼさないよう、前日曜から取得する
  const todayJst = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })  // YYYY-MM-DD
  const anchor = new Date(`${todayJst}T00:00:00Z`)  // 曜日計算用のUTCアンカー
  anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7) - 1)  // 直近の日曜
  const weekStartStr = anchor.toISOString().slice(0, 10)
  const rangeEndAnchor = new Date(anchor)
  rangeEndAnchor.setUTCDate(rangeEndAnchor.getUTCDate() + 30)
  const rangeEndStr = rangeEndAnchor.toISOString().slice(0, 10)

  const [{ data: shopStaffData }, { data: shiftsData }, { data: requestsData }] = await Promise.all([
    admin.from('shop_staff').select('staff_id, hourly_rate, night_rate_included, staff(id, name)').eq('shop_id', shopId).eq('is_active', true),
    admin.from('shifts').select('id, staff_id, starts_at, ends_at, note')
      .eq('shop_id', shopId)
      .gte('starts_at', `${weekStartStr}T00:00:00+09:00`)
      .lte('starts_at', `${rangeEndStr}T00:00:00+09:00`)
      .order('starts_at'),
    admin.from('shift_requests').select('id, staff_id, date, start_time, end_time, note, status')
      .eq('shop_id', shopId)
      .gte('date', weekStartStr)
      .lte('date', rangeEndStr)
      .order('date'),
  ])

  const staffList = (shopStaffData ?? []).flatMap(ss => {
    const s = ss.staff
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return (arr as { id: string; name: string }[]).map(staff => ({
      ...staff,
      hourly_rate: ss.hourly_rate,
      night_rate_included: ss.night_rate_included,
    }))
  })

  const shifts = (shiftsData ?? []) as { id: string; staff_id: string; starts_at: string; ends_at: string; note: string | null }[]
  const shiftRequests = (requestsData ?? []) as { id: string; staff_id: string; date: string; start_time: string | null; end_time: string | null; note: string | null; status: string }[]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">シフト管理</h1>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <ShiftCalendar shopId={shopId} staffList={staffList} initialShifts={shifts} shiftRequests={shiftRequests} weekStart={(shop.week_start as 'mon' | 'sun') ?? 'mon'} />
      </main>
    </div>
  )
}

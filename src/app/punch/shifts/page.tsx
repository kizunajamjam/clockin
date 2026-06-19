import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ShiftRequestClient } from './ShiftRequestClient'
import Link from 'next/link'

export default async function StaffShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'request' ? 'request' : 'confirmed'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: staffRecord } = await admin.from('staff').select('id, name').eq('user_id', user.id).single()
  if (!staffRecord) redirect('/punch')

  const today = new Date()
  const rangeEnd = new Date(today)
  rangeEnd.setDate(today.getDate() + 28)
  // 希望シフト(date型)の範囲は日本時間で算出する
  const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const rangeEndAnchor = new Date(`${todayStr}T00:00:00Z`)
  rangeEndAnchor.setUTCDate(rangeEndAnchor.getUTCDate() + 28)
  const rangeEndStr = rangeEndAnchor.toISOString().slice(0, 10)

  const [{ data: shiftsData }, { data: shopStaffList }, { data: requestsData }] = await Promise.all([
    admin.from('shifts')
      .select('id, starts_at, ends_at, break_minutes, note, shops(name)')
      .eq('staff_id', staffRecord.id)
      .gte('starts_at', today.toISOString())
      .lte('starts_at', rangeEnd.toISOString())
      .order('starts_at'),
    admin.from('shop_staff')
      .select('shop_id, shops(id, name, week_start)')
      .eq('staff_id', staffRecord.id)
      .eq('is_active', true),
    admin.from('shift_requests')
      .select('id, shop_id, date, start_time, end_time, note, status')
      .eq('staff_id', staffRecord.id)
      .gte('date', todayStr)
      .lte('date', rangeEndStr)
      .order('date'),
  ])

  const shifts = (shiftsData ?? []).map(s => ({
    id: s.id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    break_minutes: s.break_minutes ?? 0,
    note: s.note,
    shopName: Array.isArray(s.shops) ? s.shops[0]?.name : (s.shops as { name: string } | null)?.name ?? '',
  }))

  const shops = (shopStaffList ?? []).flatMap(ss => {
    const s = ss.shops
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr as { id: string; name: string; week_start: string }[]
  })
  const weekStart = (shops[0]?.week_start ?? 'mon') as 'mon' | 'sun'

  const requests = (requestsData ?? []) as {
    id: string; shop_id: string; date: string
    start_time: string | null; end_time: string | null
    note: string | null; status: string
  }[]

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  const workHours = (s: typeof shifts[0]) => {
    const mins = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000 - s.break_minutes
    return `${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, '0')}m`
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-bold">シフト</h1>

      {/* タブ */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-sm">
        <Link href="/punch/shifts?tab=confirmed"
          className={`flex-1 py-2.5 text-center font-medium transition-colors
            ${activeTab === 'confirmed' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
          確定シフト
        </Link>
        <Link href="/punch/shifts?tab=request"
          className={`flex-1 py-2.5 text-center font-medium transition-colors
            ${activeTab === 'request' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
          希望を出す
        </Link>
      </div>

      {activeTab === 'confirmed' ? (
        shifts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            予定されているシフトはありません
          </div>
        ) : (
          <ul className="space-y-3">
            {shifts.map(s => (
              <li key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{fmtDate(s.starts_at)}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{fmtTime(s.starts_at)} 〜 {fmtTime(s.ends_at)}</p>
                    {s.break_minutes > 0 && <p className="text-gray-400 text-xs mt-0.5">休憩 {s.break_minutes}分</p>}
                    {s.note && <p className="text-gray-500 text-xs mt-1">{s.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{s.shopName}</p>
                    <p className="text-sm font-medium text-gray-700 mt-1">{workHours(s)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        shops.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            所属している店舗がありません
          </div>
        ) : (
          <ShiftRequestClient
            shops={shops}
            initialRequests={requests}
            weekStart={weekStart}
          />
        )
      )}
    </div>
  )
}

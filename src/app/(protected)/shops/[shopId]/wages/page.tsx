import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { calcDailyPayroll, periodBucket, type PeriodUnit, type ShopStaffSetting } from '@/lib/payroll'
import { CsvExportButton } from '@/components/CsvExportButton'

export default async function WagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>
  searchParams: Promise<{ from?: string; to?: string; staff?: string; unit?: string }>
}) {
  const { shopId } = await params
  const { from: fromParam, to: toParam, staff: staffParam, unit: unitParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()

  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const from = fromParam ?? `${today.slice(0, 7)}-01`
  const to = toParam ?? today
  const staffFilter = staffParam ?? 'all'
  const unit: PeriodUnit = unitParam === 'day' || unitParam === 'week' ? unitParam : 'month'

  const { data: shopStaff } = await admin
    .from('shop_staff')
    .select('staff_id, hourly_rate, transport_fee, transport_fee_type, night_rate_included, staff(id, name)')
    .eq('shop_id', shopId)

  const staffList = (shopStaff ?? []).flatMap(ss => {
    const arr = Array.isArray(ss.staff) ? ss.staff : [ss.staff]
    const st = arr[0] as { id: string; name: string } | null
    if (!st) return []
    return [{ id: st.id, name: st.name }]
  })

  const settingsMap = new Map<string, ShopStaffSetting>()
  for (const ss of shopStaff ?? []) {
    settingsMap.set(ss.staff_id, {
      hourly_rate: ss.hourly_rate,
      transport_fee: ss.transport_fee,
      transport_fee_type: ss.transport_fee_type as 'daily' | 'monthly',
      night_rate_included: ss.night_rate_included,
    })
  }

  let query = admin
    .from('attendances')
    .select('staff_id, date, clocked_in_at, clocked_out_at, break_minutes, staff(id, name)')
    .eq('shop_id', shopId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
  if (staffFilter !== 'all') query = query.eq('staff_id', staffFilter)
  const { data: attendances } = await query

  const rows = (attendances ?? []).flatMap(a => {
    const s = a.staff
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr.map(st => ({ ...a, staffName: (st as { name: string }).name }))
  })

  // 期間（日/週/月）×スタッフごとの支給額集計（深夜割増・交通費（日払い）を含む）
  type WageRow = { bucketKey: string; bucketLabel: string; staffId: string; staffName: string; amount: number }
  const wageMap = new Map<string, WageRow>()
  for (const row of rows) {
    const setting = settingsMap.get(row.staff_id)
    if (!setting) continue
    const daily = calcDailyPayroll(
      { date: row.date, clocked_in_at: row.clocked_in_at, clocked_out_at: row.clocked_out_at, break_minutes: row.break_minutes },
      setting
    )
    if (!daily) continue
    const { key, label } = periodBucket(row.date, unit)
    const mapKey = `${key}__${row.staff_id}`
    const existing = wageMap.get(mapKey)
    if (existing) existing.amount += daily.total
    else wageMap.set(mapKey, { bucketKey: key, bucketLabel: label, staffId: row.staff_id, staffName: row.staffName, amount: daily.total })
  }

  // 月一律の交通費は、月次表示のときのみ「出勤実績がある月」に1回加算する
  const hasMonthlyTransport = staffList.some(s => {
    const setting = settingsMap.get(s.id)
    return setting && setting.transport_fee_type === 'monthly' && setting.transport_fee > 0
  })
  if (unit === 'month') {
    for (const s of staffList) {
      const setting = settingsMap.get(s.id)
      if (!setting || setting.transport_fee_type !== 'monthly' || setting.transport_fee <= 0) continue
      const monthsWorked = new Set(rows.filter(r => r.staff_id === s.id).map(r => r.date.slice(0, 7)))
      for (const ym of monthsWorked) {
        const existing = wageMap.get(`${ym}__${s.id}`)
        if (existing) existing.amount += setting.transport_fee
      }
    }
  }

  const wageRows = Array.from(wageMap.values()).sort((a, b) =>
    a.bucketKey === b.bucketKey ? a.staffName.localeCompare(b.staffName) : a.bucketKey.localeCompare(b.bucketKey)
  )
  const grandTotal = wageRows.reduce((s, r) => s + r.amount, 0)

  const csvRows: (string | number)[][] = [
    ['期間', 'スタッフ', '支給額'],
    ...wageRows.map(r => [r.bucketLabel, r.staffName, r.amount]),
    ['合計', '', grandTotal],
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">給与計算</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* 絞り込み */}
        <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">開始日</label>
              <input type="date" name="from" defaultValue={from}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">終了日</label>
              <input type="date" name="to" defaultValue={to}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">スタッフ</label>
              <select name="staff" defaultValue={staffFilter}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="all">全員</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">表示単位</label>
              <select name="unit" defaultValue={unit}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="day">日次</option>
                <option value="week">週次</option>
                <option value="month">月次</option>
              </select>
            </div>
          </div>
          <button type="submit"
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
            絞り込む
          </button>
        </form>

        {/* 支給額サマリー */}
        {wageRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm">
            この期間の勤怠記録がありません
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">支給額サマリー</p>
              <CsvExportButton rows={csvRows} filename={`給与_${from}_${to}.csv`} />
            </div>
            <ul className="divide-y divide-gray-100">
              {wageRows.map(r => (
                <li key={`${r.bucketKey}__${r.staffId}`} className="py-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-600">{r.bucketLabel} ・ {r.staffName}</span>
                  <span className="font-medium">¥{r.amount.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">合計</span>
              <span className="font-bold">¥{grandTotal.toLocaleString()}</span>
            </div>
            {unit !== 'month' && hasMonthlyTransport && (
              <p className="text-[11px] text-gray-400 pt-1">※月一律の交通費は月次表示でのみ反映されます</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

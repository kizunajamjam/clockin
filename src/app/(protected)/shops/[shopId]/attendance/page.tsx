import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AttendanceCorrectForm } from './AttendanceCorrectForm'
import { periodBucket, type PeriodUnit } from '@/lib/payroll'
import { CsvExportButton } from '@/components/CsvExportButton'

function toLocalDatetimeValue(iso: string | null, tz = 'Asia/Tokyo'): string {
  if (!iso) return ''
  const d = new Date(iso)
  const local = new Date(d.toLocaleString('en-US', { timeZone: tz }))
  return local.toISOString().slice(0, 16)
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
}

function workMinutes(inAt: string | null, outAt: string | null, breakMinutes: number): number {
  if (!inAt || !outAt) return 0
  const mins = Math.floor((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000) - breakMinutes
  return mins > 0 ? mins : 0
}

function fmtHM(mins: number): string {
  return `${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, '0')}m`
}

export default async function AttendancePage({
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
  const unit: PeriodUnit = unitParam === 'week' || unitParam === 'month' ? unitParam : 'day'

  const { data: shopStaff } = await admin
    .from('shop_staff')
    .select('staff_id, staff(id, name)')
    .eq('shop_id', shopId)

  const staffOptions = (shopStaff ?? []).flatMap(ss => {
    const arr = Array.isArray(ss.staff) ? ss.staff : [ss.staff]
    return arr.filter(Boolean) as { id: string; name: string }[]
  })

  let query = admin
    .from('attendances')
    .select('id, staff_id, date, clocked_in_at, clocked_out_at, break_minutes, punch_mode, note, staff(id, name)')
    .eq('shop_id', shopId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
    .order('clocked_in_at', { ascending: true })
  if (staffFilter !== 'all') query = query.eq('staff_id', staffFilter)
  const { data: attendances } = await query

  const rows = (attendances ?? []).flatMap(a => {
    const s = a.staff
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr.map(st => ({ ...a, staffName: (st as { name: string }).name }))
  })

  // ドリンクバックカウント（タブレット打刻のドリンクバック画面で記録）
  let drinkQuery = admin
    .from('drink_back_counts')
    .select('staff_id, date, count')
    .eq('shop_id', shopId)
    .gte('date', from)
    .lte('date', to)
  if (staffFilter !== 'all') drinkQuery = drinkQuery.eq('staff_id', staffFilter)
  const { data: drinkCounts } = await drinkQuery
  const drinkByDateStaff = new Map<string, number>()
  for (const d of drinkCounts ?? []) {
    drinkByDateStaff.set(`${d.date}__${d.staff_id}`, d.count)
  }

  // 日付ごとにグループ化（記録一覧の表示用）
  const dateGroups: { date: string; rows: typeof rows }[] = []
  for (const row of rows) {
    const g = dateGroups.find(g => g.date === row.date)
    if (g) g.rows.push(row)
    else dateGroups.push({ date: row.date, rows: [row] })
  }

  // 期間（日/週/月）×スタッフごとの勤務時間・ドリンクバック集計
  type SummaryRow = { bucketKey: string; bucketLabel: string; staffId: string; staffName: string; minutes: number; drinks: number }
  const summaryMap = new Map<string, SummaryRow>()
  function summaryEntry(date: string, staffId: string, staffName: string): SummaryRow {
    const { key, label } = periodBucket(date, unit)
    const mapKey = `${key}__${staffId}`
    let entry = summaryMap.get(mapKey)
    if (!entry) {
      entry = { bucketKey: key, bucketLabel: label, staffId, staffName, minutes: 0, drinks: 0 }
      summaryMap.set(mapKey, entry)
    }
    return entry
  }
  for (const row of rows) {
    const mins = workMinutes(row.clocked_in_at, row.clocked_out_at, row.break_minutes)
    if (mins === 0) continue
    summaryEntry(row.date, row.staff_id, row.staffName).minutes += mins
  }
  for (const d of drinkCounts ?? []) {
    const staffName = staffOptions.find(s => s.id === d.staff_id)?.name ?? ''
    if (!staffName) continue
    summaryEntry(d.date, d.staff_id, staffName).drinks += d.count
  }
  const summaryRows = Array.from(summaryMap.values())
    .filter(r => r.minutes > 0 || r.drinks > 0)
    .sort((a, b) => a.bucketKey === b.bucketKey ? a.staffName.localeCompare(b.staffName) : a.bucketKey.localeCompare(b.bucketKey))
  const grandMinutes = summaryRows.reduce((s, r) => s + r.minutes, 0)
  const grandDrinks = summaryRows.reduce((s, r) => s + r.drinks, 0)

  const csvRows: (string | number)[][] = [
    ['期間', 'スタッフ', '勤務時間(分)', '勤務時間', 'ドリンクバック数'],
    ...summaryRows.map(r => [r.bucketLabel, r.staffName, r.minutes, fmtHM(r.minutes), r.drinks]),
    ['合計', '', grandMinutes, fmtHM(grandMinutes), grandDrinks],
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">勤怠記録</h1>
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
                {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

        {/* 勤務時間サマリー */}
        {summaryRows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">勤務時間サマリー</p>
              <CsvExportButton rows={csvRows} filename={`勤怠_${from}_${to}.csv`} />
            </div>
            <ul className="divide-y divide-gray-100">
              {summaryRows.map(r => (
                <li key={`${r.bucketKey}__${r.staffId}`} className="py-1.5 flex items-center justify-between text-sm">
                  <span className="text-gray-600">{r.bucketLabel} ・ {r.staffName}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium">{fmtHM(r.minutes)}</span>
                    {r.drinks > 0 && <span className="text-amber-600">🍹{r.drinks}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">合計</span>
              <span className="flex items-center gap-3">
                <span className="font-bold">{fmtHM(grandMinutes)}</span>
                {grandDrinks > 0 && <span className="text-amber-600 font-bold">🍹{grandDrinks}</span>}
              </span>
            </div>
          </div>
        )}

        {/* 記録一覧 */}
        {dateGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm">
            この期間の打刻記録はありません
          </div>
        ) : (
          <div className="space-y-4">
            {dateGroups.map(group => (
              <div key={group.date} className="space-y-2">
                <p className="text-xs font-medium text-gray-400">{group.date}</p>
                <div className="space-y-3">
                  {group.rows.map(row => (
                    <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.staffName}</span>
                        <div className="flex items-center gap-2">
                          {(drinkByDateStaff.get(`${row.date}__${row.staff_id}`) ?? 0) > 0 && (
                            <span className="text-xs text-amber-600">🍹{drinkByDateStaff.get(`${row.date}__${row.staff_id}`)}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            row.punch_mode === 'tablet' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {row.punch_mode === 'tablet' ? 'タブレット' : 'スマホ'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm text-center">
                        <div>
                          <p className="text-xs text-gray-400">出勤</p>
                          <p className="font-mono text-green-700">{formatTime(row.clocked_in_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">退勤</p>
                          <p className="font-mono text-blue-700">{formatTime(row.clocked_out_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">勤務時間</p>
                          <p className="font-medium">{fmtHM(workMinutes(row.clocked_in_at, row.clocked_out_at, row.break_minutes))}</p>
                        </div>
                      </div>
                      {row.note && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">修正: {row.note}</p>
                      )}
                      <AttendanceCorrectForm
                        attendanceId={row.id}
                        shopId={shopId}
                        clockedInAt={toLocalDatetimeValue(row.clocked_in_at)}
                        clockedOutAt={toLocalDatetimeValue(row.clocked_out_at)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

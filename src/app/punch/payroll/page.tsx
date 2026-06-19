import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { calcMonthlyPayroll, calcCustomLines, employmentInsurance, formatMinutes, type CustomItem, type CustomRecord } from '@/lib/payroll'
import Link from 'next/link'

export default async function StaffPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; shop?: string }>
}) {
  const { ym, shop: shopIdParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: staffRecord } = await admin.from('staff').select('id, name, income_alert_amount').eq('user_id', user.id).single()
  if (!staffRecord) redirect('/punch')

  // 所属店舗一覧
  const { data: shopStaffList } = await admin
    .from('shop_staff')
    .select('shop_id, hourly_rate, transport_fee, transport_fee_type, night_rate_included, shops(id, name, employment_insurance_rate)')
    .eq('staff_id', staffRecord.id)
    .eq('is_active', true)

  const shops = (shopStaffList ?? []).flatMap(ss => {
    const s = ss.shops
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr.map(shop => ({ ...shop, hourly_rate: ss.hourly_rate, transport_fee: ss.transport_fee, transport_fee_type: ss.transport_fee_type, night_rate_included: ss.night_rate_included }))
  }) as { id: string; name: string; employment_insurance_rate: number; hourly_rate: number; transport_fee: number; transport_fee_type: string; night_rate_included: boolean }[]

  const selectedShop = shops.find(s => s.id === shopIdParam) ?? shops[0]

  // 「今月」判定は日本時間で行う
  const currentYm = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
  const targetYm = ym ?? currentYm

  const [year, month] = targetYm.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)

  let payroll = null
  let incomeAlert = null
  let customTotal = 0

  if (selectedShop) {
    const { data: records } = await admin
      .from('attendances')
      .select('date, clocked_in_at, clocked_out_at, break_minutes')
      .eq('staff_id', staffRecord.id)
      .eq('shop_id', selectedShop.id)
      .gte('date', monthStart.toLocaleDateString('sv-SE'))
      .lt('date', monthEnd.toLocaleDateString('sv-SE'))
      .order('date')

    payroll = calcMonthlyPayroll(
      (records ?? []).map(r => ({ ...r, break_minutes: r.break_minutes ?? 0 })),
      {
        hourly_rate: selectedShop.hourly_rate,
        transport_fee: selectedShop.transport_fee ?? 0,
        transport_fee_type: (selectedShop.transport_fee_type as 'daily' | 'monthly') ?? 'daily',
        night_rate_included: selectedShop.night_rate_included ?? false,
      }
    )

    // カスタム給与項目（当月）
    const [{ data: itemsData }, { data: customRecData }] = await Promise.all([
      admin.from('salary_custom_items').select('id, name, type, unit_price').eq('shop_id', selectedShop.id).order('sort_order'),
      admin.from('salary_custom_records').select('item_id, value').eq('shop_id', selectedShop.id).eq('staff_id', staffRecord.id).eq('year_month', targetYm),
    ])
    const customItems = (itemsData ?? []) as CustomItem[]
    customTotal = calcCustomLines(customItems, (customRecData ?? []) as CustomRecord[]).total

    // 年収アラートチェック（今年の累計。カスタム項目も含める）
    if (staffRecord.income_alert_amount) {
      const yearStart = new Date(year, 0, 1)
      const [{ data: ytdRecords }, { data: ytdCustomRec }] = await Promise.all([
        admin.from('attendances')
          .select('date, clocked_in_at, clocked_out_at, break_minutes')
          .eq('staff_id', staffRecord.id)
          .eq('shop_id', selectedShop.id)
          .gte('date', yearStart.toLocaleDateString('sv-SE'))
          .lt('date', monthEnd.toLocaleDateString('sv-SE'))
          .order('date'),
        admin.from('salary_custom_records')
          .select('item_id, value')
          .eq('staff_id', staffRecord.id)
          .eq('shop_id', selectedShop.id)
          .gte('year_month', `${year}-01`)
          .lte('year_month', targetYm),
      ])

      const ytdPayroll = calcMonthlyPayroll(
        (ytdRecords ?? []).map(r => ({ ...r, break_minutes: r.break_minutes ?? 0 })),
        {
          hourly_rate: selectedShop.hourly_rate,
          transport_fee: selectedShop.transport_fee ?? 0,
          transport_fee_type: (selectedShop.transport_fee_type as 'daily' | 'monthly') ?? 'daily',
          night_rate_included: selectedShop.night_rate_included ?? false,
        }
      )
      const ytdCustomTotal = calcCustomLines(customItems, (ytdCustomRec ?? []) as CustomRecord[]).total
      const ytdGrand = ytdPayroll.grand_total + ytdCustomTotal

      if (ytdGrand >= staffRecord.income_alert_amount) {
        incomeAlert = { ytd: ytdGrand, threshold: staffRecord.income_alert_amount }
      }
    }
  }

  // 控除（雇用保険料）と差引支給額
  const monthlyGross = (payroll?.grand_total ?? 0) + customTotal
  const eiRate = selectedShop?.employment_insurance_rate ?? 0.006
  const employmentIns = employmentInsurance(monthlyGross, eiRate)
  const netTotal = monthlyGross - employmentIns

  const prevYm = new Date(year, month - 2, 1)
  const nextYm = new Date(year, month, 1)
  const fmtYm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-bold">給与明細</h1>

      {/* 店舗選択 */}
      {shops.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {shops.map(s => (
            <Link key={s.id} href={`/punch/payroll?ym=${targetYm}&shop=${s.id}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${selectedShop?.id === s.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`}>
              {s.name}
            </Link>
          ))}
        </div>
      )}

      {/* 月切替 */}
      <div className="flex items-center gap-3">
        <Link href={`/punch/payroll?ym=${fmtYm(prevYm)}${selectedShop ? `&shop=${selectedShop.id}` : ''}`}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">‹ 前月</Link>
        <span className="font-medium text-sm">{year}年{month}月</span>
        {targetYm < currentYm && (
          <Link href={`/punch/payroll?ym=${fmtYm(nextYm)}${selectedShop ? `&shop=${selectedShop.id}` : ''}`}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">次月 ›</Link>
        )}
      </div>

      {/* 年収アラート */}
      {incomeAlert && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800">⚠️ 年収アラート</p>
          <p className="text-sm text-amber-700 mt-1">
            今年の累計給与が設定金額を超えました<br />
            累計: ¥{incomeAlert.ytd.toLocaleString()} / 設定: ¥{incomeAlert.threshold.toLocaleString()}
          </p>
        </div>
      )}

      {!payroll || payroll.days.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          この月の勤怠記録がありません
        </div>
      ) : (
        <>
          {/* 合計 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h2 className="font-semibold text-sm">月間合計</h2>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>勤務時間</span>
                <span>{formatMinutes(payroll.total_work_minutes)}</span>
              </div>
              <div className="flex justify-between">
                <span>基本給</span>
                <span>¥{payroll.total_base_pay.toLocaleString()}</span>
              </div>
              {payroll.total_night_premium > 0 && (
                <div className="flex justify-between">
                  <span>深夜割増</span>
                  <span>¥{payroll.total_night_premium.toLocaleString()}</span>
                </div>
              )}
              {payroll.total_transport_fee > 0 && (
                <div className="flex justify-between">
                  <span>交通費</span>
                  <span>¥{payroll.total_transport_fee.toLocaleString()}</span>
                </div>
              )}
              {customTotal > 0 && (
                <div className="flex justify-between">
                  <span>カスタム項目</span>
                  <span>¥{customTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-2">
                <span>支給合計</span>
                <span>¥{(payroll.grand_total + customTotal).toLocaleString()}</span>
              </div>
              {employmentIns > 0 && (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>雇用保険料（控除 {(eiRate * 100).toFixed(2)}%）</span>
                    <span>−¥{employmentIns.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                    <span>差引支給額</span>
                    <span>¥{netTotal.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 日別 */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {payroll.days.map((d, i) => (
              <div key={`${d.date}-${i}`} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{new Date(d.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}</p>
                  <p className="text-gray-400 text-xs">{formatMinutes(d.work_minutes)}</p>
                </div>
                <p className="font-medium text-gray-700">¥{d.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

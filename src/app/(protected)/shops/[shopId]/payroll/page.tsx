import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { calcMonthlyPayroll, calcCustomLines, formatMinutes, type CustomItem, type CustomRecord } from '@/lib/payroll'
import { isProStatus } from '@/lib/plan'

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>
  searchParams: Promise<{ ym?: string }>
}) {
  const { shopId } = await params
  const { ym: ymParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()

  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  // プラン確認
  const { data: sub } = await admin.from('subscriptions').select('status').eq('organization_id', shop.organization_id).single()
  const proEnabled = isProStatus(sub?.status)

  if (!proEnabled) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
          <h1 className="font-bold text-lg">給与計算</h1>
        </header>
        <main className="max-w-lg mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
            <p className="text-2xl">🔒</p>
            <p className="font-semibold">プロプランの機能です</p>
            <p className="text-sm text-gray-500">給与自動計算・CSV出力はプロプランで利用できます</p>
            <Link href="/settings/billing"
              className="inline-block mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
              プロプランを見る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // 対象月（デフォルト: 今月）
  const now = new Date()
  const targetYm = ymParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = targetYm.split('-').map(Number)

  const startDate = `${targetYm}-01`
  const endDate = new Date(year, month, 0).toLocaleDateString('sv-SE')

  // スタッフ一覧 + カスタム給与項目（店舗単位）+ 当月の実績（全スタッフ分）
  const [{ data: shopStaff }, { data: itemsData }, { data: customRecData }] = await Promise.all([
    admin.from('shop_staff')
      .select('staff_id, hourly_rate, transport_fee, transport_fee_type, night_rate_included, staff(id, name)')
      .eq('shop_id', shopId),
    admin.from('salary_custom_items').select('id, name, type, unit_price').eq('shop_id', shopId).order('sort_order'),
    admin.from('salary_custom_records').select('staff_id, item_id, value').eq('shop_id', shopId).eq('year_month', targetYm),
  ])

  const customItems = (itemsData ?? []) as CustomItem[]
  const recByStaff = new Map<string, CustomRecord[]>()
  for (const r of (customRecData ?? []) as { staff_id: string; item_id: string; value: number }[]) {
    const arr = recByStaff.get(r.staff_id) ?? []
    arr.push({ item_id: r.item_id, value: r.value })
    recByStaff.set(r.staff_id, arr)
  }

  const staffPayrolls = await Promise.all(
    (shopStaff ?? []).map(async ss => {
      const staffArr = Array.isArray(ss.staff) ? ss.staff : [ss.staff]
      const st = staffArr[0] as { id: string; name: string } | null
      if (!st) return null

      const { data: records } = await admin
        .from('attendances')
        .select('date, clocked_in_at, clocked_out_at, break_minutes')
        .eq('shop_id', shopId)
        .eq('staff_id', st.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')

      const payroll = calcMonthlyPayroll(records ?? [], {
        hourly_rate: ss.hourly_rate,
        transport_fee: ss.transport_fee,
        transport_fee_type: ss.transport_fee_type as 'daily' | 'monthly',
        night_rate_included: ss.night_rate_included,
      })

      const { total: customTotal } = calcCustomLines(customItems, recByStaff.get(st.id) ?? [])
      return { staffId: st.id, staffName: st.name, payroll, customTotal, total: payroll.grand_total + customTotal }
    })
  )

  const validPayrolls = staffPayrolls.filter(Boolean) as NonNullable<typeof staffPayrolls[number]>[]

  // 前月・翌月
  const prevDate = new Date(year, month - 2, 1)
  const nextDate = new Date(year, month, 1)
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const nextYm = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = targetYm === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const grandTotal = validPayrolls.reduce((s, p) => s + p.total, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">給与計算</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* 月ナビ */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
          <Link href={`/shops/${shopId}/payroll?ym=${prevYm}`}
            className="text-sm text-gray-500 hover:text-gray-900 px-2 py-1">← 前月</Link>
          <p className="font-semibold">{year}年{month}月</p>
          <Link
            href={isCurrentMonth ? '#' : `/shops/${shopId}/payroll?ym=${nextYm}`}
            className={`text-sm px-2 py-1 ${isCurrentMonth ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:text-gray-900'}`}>
            翌月 →
          </Link>
        </div>

        {/* スタッフ別サマリー */}
        {validPayrolls.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-gray-400 text-sm">
            この月の勤怠記録がありません
          </div>
        ) : (
          <div className="space-y-3">
            {validPayrolls.map(({ staffId, staffName, payroll, customTotal, total }) => (
              <Link key={staffId} href={`/shops/${shopId}/payroll/${staffId}?ym=${targetYm}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{staffName}</span>
                  <span className="font-bold text-lg">¥{total.toLocaleString()}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>勤務 {formatMinutes(payroll.total_work_minutes)}</span>
                  {payroll.total_night_premium > 0 && (
                    <span>深夜割増 ¥{payroll.total_night_premium.toLocaleString()}</span>
                  )}
                  {payroll.total_transport_fee > 0 && (
                    <span>交通費 ¥{payroll.total_transport_fee.toLocaleString()}</span>
                  )}
                  {customTotal > 0 && (
                    <span>カスタム ¥{customTotal.toLocaleString()}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* カスタム項目の管理導線 */}
        <Link href={`/shops/${shopId}/salary-items`}
          className="block text-center text-sm text-gray-500 hover:text-gray-900 py-2">
          カスタム給与項目を管理 →
        </Link>

        {/* 合計 */}
        {validPayrolls.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">合計支給額</span>
            <span className="text-xl font-bold">¥{grandTotal.toLocaleString()}</span>
          </div>
        )}
      </main>
    </div>
  )
}

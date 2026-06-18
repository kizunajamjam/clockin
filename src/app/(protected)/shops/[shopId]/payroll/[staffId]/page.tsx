import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { calcMonthlyPayroll, formatMinutes } from '@/lib/payroll'
import { CsvDownloadButton } from './CsvDownloadButton'

export default async function StaffPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string; staffId: string }>
  searchParams: Promise<{ ym?: string }>
}) {
  const { shopId, staffId } = await params
  const { ym: ymParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const now = new Date()
  const targetYm = ymParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = targetYm.split('-').map(Number)
  const startDate = `${targetYm}-01`
  const endDate = new Date(year, month, 0).toLocaleDateString('sv-SE')

  const { data: staffRecord } = await admin.from('staff').select('id, name').eq('id', staffId).single()
  if (!staffRecord) notFound()

  const { data: ss } = await admin.from('shop_staff')
    .select('hourly_rate, transport_fee, transport_fee_type, night_rate_included')
    .eq('shop_id', shopId).eq('staff_id', staffId).single()
  if (!ss) notFound()

  const { data: records } = await admin.from('attendances')
    .select('date, clocked_in_at, clocked_out_at, break_minutes')
    .eq('shop_id', shopId).eq('staff_id', staffId)
    .gte('date', startDate).lte('date', endDate).order('date')

  const payroll = calcMonthlyPayroll(records ?? [], {
    hourly_rate: ss.hourly_rate,
    transport_fee: ss.transport_fee,
    transport_fee_type: ss.transport_fee_type as 'daily' | 'monthly',
    night_rate_included: ss.night_rate_included,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}/payroll?ym=${targetYm}`} className="text-sm text-gray-500 hover:text-gray-900">← 給与計算</Link>
        <h1 className="font-bold text-lg">{staffRecord.name} — {year}年{month}月</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* サマリー */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">支給合計</span>
            <span className="text-2xl font-bold">¥{payroll.grand_total.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-center border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-gray-400">基本給</p>
              <p className="font-medium">¥{payroll.total_base_pay.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">深夜割増</p>
              <p className="font-medium">¥{payroll.total_night_premium.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">交通費</p>
              <p className="font-medium">¥{payroll.total_transport_fee.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 text-center border-t border-gray-100 pt-3">
            勤務時間合計: {formatMinutes(payroll.total_work_minutes)} / 出勤日数: {payroll.days.length}日
          </div>
        </div>

        {/* 日別明細 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium">日別明細</h2>
            <CsvDownloadButton payroll={payroll} staffName={staffRecord.name} ym={targetYm} />
          </div>
          {payroll.days.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">勤務記録がありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">日付</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">勤務時間</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">支給額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payroll.days.map(day => (
                  <tr key={day.date}>
                    <td className="px-4 py-2 text-gray-700">{day.date}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{formatMinutes(day.work_minutes)}</td>
                    <td className="px-4 py-2 text-right font-medium">¥{day.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calcWorkMinutes(inAt: string | null, outAt: string | null): string {
  if (!inAt || !outAt) return '—'
  const mins = Math.floor((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m.toString().padStart(2, '0')}m`
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { shopId } = await params
  const { date: dateParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: shop } = await admin
    .from('shops')
    .select('id, name, organization_id')
    .eq('id', shopId)
    .single()
  if (!shop) notFound()

  // オーナー権限確認
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) notFound()

  // 対象日（デフォルト: 今日）
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const targetDate = dateParam ?? today

  // 勤怠データ取得
  const { data: attendances } = await admin
    .from('attendances')
    .select('id, date, clocked_in_at, clocked_out_at, punch_mode, staff(id, name)')
    .eq('shop_id', shopId)
    .eq('date', targetDate)
    .order('clocked_in_at', { ascending: true })

  const rows = (attendances ?? []).flatMap(a => {
    const s = a.staff
    if (!s) return []
    const staffArr = Array.isArray(s) ? s : [s]
    return staffArr.map(st => ({ ...a, staffName: (st as { name: string }).name }))
  })

  // 前日・翌日のナビ
  const d = new Date(targetDate)
  const prev = new Date(d); prev.setDate(prev.getDate() - 1)
  const next = new Date(d); next.setDate(next.getDate() + 1)
  const prevStr = prev.toLocaleDateString('sv-SE')
  const nextStr = next.toLocaleDateString('sv-SE')
  const isToday = targetDate === today

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← {shop.name}
        </Link>
        <h1 className="font-bold text-lg">勤怠記録</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* 日付ナビゲーション */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
          <Link href={`/shops/${shopId}/attendance?date=${prevStr}`}
            className="text-sm text-gray-500 hover:text-gray-900 px-2 py-1">
            ← 前日
          </Link>
          <div className="text-center">
            <p className="font-semibold">{targetDate}</p>
            {isToday && <p className="text-xs text-blue-600">今日</p>}
          </div>
          <Link
            href={isToday ? '#' : `/shops/${shopId}/attendance?date=${nextStr}`}
            className={`text-sm px-2 py-1 ${isToday ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:text-gray-900'}`}
          >
            翌日 →
          </Link>
        </div>

        {/* 勤怠テーブル */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">スタッフ</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">出勤</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">退勤</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">勤務時間</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">方法</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{row.staffName}</td>
                    <td className="px-4 py-3 text-center text-green-700 font-mono">
                      {formatTime(row.clocked_in_at)}
                    </td>
                    <td className="px-4 py-3 text-center text-blue-700 font-mono">
                      {formatTime(row.clocked_out_at)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {calcWorkMinutes(row.clocked_in_at, row.clocked_out_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        row.punch_mode === 'tablet'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {row.punch_mode === 'tablet' ? 'タブレット' : 'スマホ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">
              この日の打刻記録はありません
            </div>
          )}
        </div>

        {/* 集計 */}
        {rows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600">
            <span className="font-medium">{rows.length}名</span> 出勤・
            <span className="font-medium">{rows.filter(r => r.clocked_out_at).length}名</span> 退勤済み
          </div>
        )}
      </main>
    </div>
  )
}

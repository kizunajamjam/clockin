import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logout } from '@/app/logout/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // スタッフアカウントの場合は打刻画面へリダイレクト
  const { data: staffRecord } = await admin
    .from('staff')
    .select('id')
    .eq('user_id', user!.id)
    .single()
  if (staffRecord) redirect('/punch')

  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', user!.id)
    .single()

  const [{ data: shops }, { data: sub }] = await Promise.all([
    org ? admin.from('shops').select('id, name').eq('organization_id', org.id) : Promise.resolve({ data: [] }),
    org ? admin.from('subscriptions').select('status').eq('organization_id', org.id).single() : Promise.resolve({ data: null }),
  ])
  const isPro = sub?.status === 'active' || sub?.status === 'trialing'

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  // 今日の出勤状況を全店舗まとめて取得
  const shopIds = (shops ?? []).map(s => s.id)
  const { data: todayAttendances } = shopIds.length > 0
    ? await admin
        .from('attendances')
        .select('shop_id, staff_id, clocked_in_at, clocked_out_at')
        .in('shop_id', shopIds)
        .eq('date', today)
    : { data: [] }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">clockin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{org?.name}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">ログアウト</button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 今日の日時 */}
        <div className="text-center py-2">
          <p className="text-sm text-gray-400">{dateStr}</p>
          <p className="text-3xl font-bold tracking-tight">{timeStr}</p>
        </div>

        {!shops || shops.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <p className="text-gray-500 text-sm">まだ店舗が登録されていません</p>
            <Link href="/shops/new"
              className="inline-block px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
              最初の店舗を作成する
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-500">店舗</h2>
            {shops.map((shop) => {
              // スタッフ単位で集計（複数打刻でも実人数で数える）
              const openByStaff = new Map<string, boolean>()
              for (const a of (todayAttendances ?? [])) {
                if (a.shop_id !== shop.id) continue
                const isOpen = !!a.clocked_in_at && !a.clocked_out_at
                openByStaff.set(a.staff_id, (openByStaff.get(a.staff_id) ?? false) || isOpen)
              }
              const total = openByStaff.size
              const inCount = [...openByStaff.values()].filter(Boolean).length
              const outCount = total - inCount

              return (
                <Link key={shop.id} href={`/shops/${shop.id}`}
                  className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-400 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{shop.name}</span>
                    {total > 0 ? (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">出勤中 {inCount}名</span>
                        {outCount > 0 && <span className="text-gray-400">退勤 {outCount}名</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">本日の打刻なし</span>
                    )}
                  </div>
                </Link>
              )
            })}
            <Link href="/shops/new"
              className="block text-center text-sm text-gray-400 hover:text-gray-600 py-2">
              + 店舗を追加
            </Link>
          </div>
        )}

        {/* クイックリンク */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/settings/billing"
            className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-center hover:border-gray-400 transition-colors">
            <p className="text-gray-400 text-xs mb-1">プラン</p>
            <p className="font-medium">{isPro ? 'プロ' : 'フリー'}</p>
          </Link>
          <Link href="/profile"
            className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm text-center hover:border-gray-400 transition-colors">
            <p className="text-gray-400 text-xs mb-1">設定</p>
            <p className="font-medium">プロフィール</p>
          </Link>
        </div>
      </main>
    </div>
  )
}

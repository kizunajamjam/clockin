import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  // 認可: ログイン中ユーザーが所有する組織配下の店舗に限定（招待トークン等の漏洩防止）
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, organization_id, punch_modes, gps_enabled, gps_radius_m')
    .eq('id', shopId)
    .single()
  if (!shop) notFound()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) notFound()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  const { data: shopStaff } = await admin
    .from('shop_staff')
    .select('staff_id, staff(id, name, invite_token)')
    .eq('shop_id', shopId)
    .eq('is_active', true)

  const staffList = (shopStaff ?? []).flatMap(ss => {
    const s = ss.staff
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr as { id: string; name: string; invite_token: string | null }[]
  })

  const punchModes = shop.punch_modes as string[]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← ダッシュボード</Link>
        <h1 className="font-bold text-lg">{shop.name}</h1>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-4">
        {/* スタッフ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">スタッフ（{staffList.length}名）</h2>
            <Link href={`/shops/${shopId}/staff/new`}
              className="text-sm text-gray-900 font-medium hover:underline">
              + 追加
            </Link>
          </div>
          {staffList.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {staffList.map(s => (
                <li key={s.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.invite_token && (
                    <p className="text-xs text-gray-400 break-all mt-0.5">
                      招待URL: {baseUrl}/invite/{s.invite_token}
                    </p>
                  )}
                  </div>
                  <Link href={`/shops/${shopId}/staff/${s.id}`}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">編集</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">まだスタッフが登録されていません</p>
          )}
        </div>

        {/* クイックリンク */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '勤怠記録', href: `/shops/${shopId}/attendance` },
            { label: '給与計算', href: `/shops/${shopId}/wages` },
          ].map(({ label, href }) => (
            <Link key={href} href={href}
              className="bg-white rounded-xl border border-gray-200 px-3 py-4 text-center text-sm font-medium hover:border-gray-400 transition-colors">
              {label}
            </Link>
          ))}
        </div>

        {/* タブレット打刻リンク */}
        {punchModes.includes('tablet') && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h2 className="font-semibold text-sm">タブレット打刻</h2>
            <p className="text-xs text-gray-500">下のURLを店頭タブレットのブラウザで開いてください</p>
            <Link href={`/kiosk/${shopId}`}
              className="block text-sm text-blue-600 hover:underline break-all"
              target="_blank">
              /kiosk/{shopId}
            </Link>
          </div>
        )}

        {/* 店舗設定 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-500">店舗設定</h2>
            <Link href={`/shops/${shopId}/settings`}
              className="text-sm text-gray-900 font-medium hover:underline">
              編集 →
            </Link>
          </div>
          <div className="text-sm space-y-1 text-gray-600">
            <p>打刻方式：{punchModes.join('・')}</p>
            <p>GPS確認：{shop.gps_enabled ? `有効（半径${shop.gps_radius_m}m）` : '無効'}</p>
          </div>
        </div>
      </main>
    </div>
  )
}

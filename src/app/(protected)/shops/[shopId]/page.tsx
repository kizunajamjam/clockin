import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  const admin = createAdminClient()
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  const [{ data: shop }, { data: shopStaff }] = await Promise.all([
    admin.from('shops').select('id, name, punch_modes, gps_enabled, gps_radius_m').eq('id', shopId).single(),
    admin.from('shop_staff').select('staff_id, staff(id, name, invite_token)').eq('shop_id', shopId).eq('is_active', true),
  ])

  if (!shop) notFound()

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
                <li key={s.id} className="py-2">
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.invite_token && (
                    <p className="text-xs text-gray-400 break-all mt-0.5">
                      招待URL: {baseUrl}/invite/{s.invite_token}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">まだスタッフが登録されていません</p>
          )}
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
          <h2 className="font-semibold text-sm text-gray-500">店舗設定</h2>
          <div className="text-sm space-y-1 text-gray-600">
            <p>打刻方式：{punchModes.join('・')}</p>
            <p>GPS確認：{shop.gps_enabled ? `有効（半径${shop.gps_radius_m}m）` : '無効'}</p>
          </div>
        </div>
      </main>
    </div>
  )
}

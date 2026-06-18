import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  const admin = createAdminClient()

  const { data: shop } = await admin
    .from('shops')
    .select('id, name, punch_modes, gps_enabled, gps_radius_m')
    .eq('id', shopId)
    .single()

  if (!shop) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← ダッシュボード</Link>
        <h1 className="font-bold text-lg">{shop.name}</h1>
      </header>
      <main className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-medium text-sm text-gray-500">店舗設定</h2>
          <div className="text-sm space-y-1">
            <p>打刻方式：{(shop.punch_modes as string[]).join('・')}</p>
            <p>GPS確認：{shop.gps_enabled ? `有効（半径${shop.gps_radius_m}m）` : '無効'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          スタッフ管理・シフト・勤怠（実装予定）
        </div>
      </main>
    </div>
  )
}

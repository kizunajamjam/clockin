import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isProStatus } from '@/lib/plan'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { CustomItem } from '@/lib/payroll'
import { SalaryItemsClient } from './SalaryItemsClient'

export default async function SalaryItemsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  // プロ機能
  const { data: sub } = await admin.from('subscriptions').select('status').eq('organization_id', shop.organization_id).single()
  if (!isProStatus(sub?.status)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <Link href={`/shops/${shopId}/payroll`} className="text-sm text-gray-500 hover:text-gray-900">← 給与計算</Link>
          <h1 className="font-bold text-lg">カスタム給与項目</h1>
        </header>
        <main className="max-w-lg mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
            <p className="text-2xl">🔒</p>
            <p className="font-semibold">プロプランの機能です</p>
            <Link href="/settings/billing" className="inline-block mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
              プロプランを見る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const { data: itemsData } = await admin
    .from('salary_custom_items')
    .select('id, name, type, unit_price')
    .eq('shop_id', shopId)
    .order('sort_order')

  const items = (itemsData ?? []) as CustomItem[]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}/payroll`} className="text-sm text-gray-500 hover:text-gray-900">← 給与計算</Link>
        <h1 className="font-bold text-lg">カスタム給与項目</h1>
      </header>
      <main className="max-w-lg mx-auto p-6 space-y-4">
        <p className="text-sm text-gray-500">
          店舗ごとに給与の追加項目（手当・歩合・実費など）を定義します。
          各スタッフの月次金額は給与明細画面で入力します。
        </p>
        <SalaryItemsClient shopId={shopId} initialItems={items} />
      </main>
    </div>
  )
}

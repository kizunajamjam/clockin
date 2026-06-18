import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ShiftsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const { data: sub } = await admin.from('subscriptions').select('status').eq('organization_id', shop.organization_id).single()
  const isPro = sub?.status === 'active' || sub?.status === 'trialing'

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
          <h1 className="font-bold text-lg">シフト管理</h1>
        </header>
        <main className="max-w-lg mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-3">
            <p className="text-2xl">🔒</p>
            <p className="font-semibold">プロプランの機能です</p>
            <p className="text-sm text-gray-500">シフト作成・共有はプロプランで利用できます</p>
            <Link href="/settings/billing"
              className="inline-block mt-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
              プロプランを見る
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // TODO: シフトカレンダーUI（プロ実装）
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">シフト管理</h1>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          シフトカレンダーUI（実装予定）
        </div>
      </main>
    </div>
  )
}

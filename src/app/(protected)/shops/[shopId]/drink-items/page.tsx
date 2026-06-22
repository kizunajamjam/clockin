import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { DrinkItemsClient } from './DrinkItemsClient'

export default async function DrinkItemsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id').eq('id', shopId).single()
  if (!shop) notFound()
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const { data: itemsData } = await admin
    .from('drink_back_items')
    .select('id, name')
    .eq('shop_id', shopId)
    .order('sort_order')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">ドリンクバック・ジャンル管理</h1>
      </header>
      <main className="max-w-lg mx-auto p-6 space-y-4">
        <p className="text-sm text-gray-500">
          タブレット打刻のドリンクバックカウントで使うジャンル（ドリンク・シャンパン・テキーラなど）を管理します。
        </p>
        <DrinkItemsClient shopId={shopId} initialItems={itemsData ?? []} />
      </main>
    </div>
  )
}

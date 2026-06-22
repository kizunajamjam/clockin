import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { KioskClient } from './KioskClient'

export default async function KioskPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  const admin = createAdminClient()

  const { data: shop } = await admin
    .from('shops')
    .select('id, name, punch_modes')
    .eq('id', shopId)
    .single()

  if (!shop) notFound()

  const punchModes = shop.punch_modes as string[]
  if (!punchModes.includes('tablet')) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">この店舗はタブレット打刻が無効です</p>
      </div>
    )
  }

  // アクティブなスタッフ一覧・ドリンクバックのジャンルは互いに独立なので並列取得
  const [{ data: shopStaff }, { data: drinkItemsData }] = await Promise.all([
    admin.from('shop_staff').select('staff_id, staff(id, name)').eq('shop_id', shopId).eq('is_active', true),
    admin.from('drink_back_items').select('id, name').eq('shop_id', shopId).order('sort_order'),
  ])

  const staffList = (shopStaff ?? [])
    .flatMap(ss => {
      const s = ss.staff
      if (!s) return []
      return (Array.isArray(s) ? s : [s]) as { id: string; name: string }[]
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return <KioskClient shopId={shopId} shopName={shop.name} staffList={staffList} drinkItems={drinkItemsData ?? []} />
}

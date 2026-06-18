import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PunchClient } from './PunchClient'

export default async function PunchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // ログインユーザーに紐付くスタッフを取得
  const { data: staffRecord } = await admin
    .from('staff')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!staffRecord) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full text-center">
          <p className="text-gray-500 text-sm">スタッフ登録が完了していません</p>
          <p className="text-xs text-gray-400 mt-2">オーナーから招待リンクをもらってください</p>
        </div>
      </div>
    )
  }

  // 所属店舗一覧
  const { data: shopStaffList } = await admin
    .from('shop_staff')
    .select('shop_id, shops(id, name, gps_enabled, gps_radius_m, punch_modes)')
    .eq('staff_id', staffRecord.id)
    .eq('is_active', true)

  const shops = (shopStaffList ?? []).flatMap(ss => {
    const s = ss.shops
    if (!s) return []
    const arr = Array.isArray(s) ? s : [s]
    return arr.filter(shop => {
      const modes = shop.punch_modes as string[]
      return modes.includes('smartphone')
    }) as { id: string; name: string; gps_enabled: boolean; gps_radius_m: number }[]
  })

  return (
    <PunchClient
      staffName={staffRecord.name}
      shops={shops}
    />
  )
}

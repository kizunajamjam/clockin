'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type State = { error: string } | { success: string } | null

export async function updateShop(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const shopId = formData.get('shop_id') as string
  const name = (formData.get('name') as string).trim()
  const prefecture = (formData.get('prefecture') as string).trim()
  const punchModes = formData.getAll('punch_modes') as string[]
  const gpsEnabled = formData.get('gps_enabled') === 'true'
  const gpsRadiusRaw = parseInt(formData.get('gps_radius_m') as string, 10)
  const gpsRadius = Number.isFinite(gpsRadiusRaw) ? Math.min(Math.max(gpsRadiusRaw, 50), 1000) : 300
  const gpsLat = parseFloat(formData.get('gps_lat') as string) || null
  const gpsLng = parseFloat(formData.get('gps_lng') as string) || null

  if (!name) return { error: '店舗名を入力してください' }
  if (!prefecture) return { error: '都道府県を選択してください' }
  if (punchModes.length === 0) return { error: '打刻方式を1つ以上選択してください' }
  if (gpsEnabled && punchModes.includes('smartphone') && (!gpsLat || !gpsLng)) {
    return { error: 'スマホ打刻でGPS確認を有効にするには、店舗の位置を設定してください' }
  }

  const admin = createAdminClient()

  // オーナー権限確認
  const { data: shop } = await admin.from('shops').select('organization_id').eq('id', shopId).single()
  if (!shop) return { error: '店舗が見つかりません' }
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) return { error: '権限がありません' }

  const weekStart = formData.get('week_start') === 'sun' ? 'sun' : 'mon'

  const { error } = await admin.from('shops').update({
    name,
    prefecture,
    punch_modes: punchModes,
    gps_enabled: gpsEnabled,
    gps_radius_m: gpsRadius,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    week_start: weekStart,
  }).eq('id', shopId)

  if (error) return { error: '更新に失敗しました: ' + error.message }

  revalidatePath(`/shops/${shopId}`)
  revalidatePath(`/shops/${shopId}/settings`)
  return { success: '更新しました' }
}

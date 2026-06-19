'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isOrgPro } from '@/lib/plan'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function createShop(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const name = (formData.get('name') as string).trim()
  if (!name) return { error: '店舗名を入力してください' }

  const prefecture = (formData.get('prefecture') as string).trim()
  if (!prefecture) return { error: '都道府県を選択してください' }

  const punchModes = formData.getAll('punch_modes') as string[]
  if (punchModes.length === 0) return { error: '打刻方式を1つ以上選択してください' }

  const gpsEnabled = formData.get('gps_enabled') === 'true'
  const gpsRadiusRaw = parseInt(formData.get('gps_radius_m') as string, 10)
  const gpsRadius = Number.isFinite(gpsRadiusRaw)
    ? Math.min(Math.max(gpsRadiusRaw, 50), 1000)
    : 300
  const gpsLat = parseFloat(formData.get('gps_lat') as string) || null
  const gpsLng = parseFloat(formData.get('gps_lng') as string) || null

  if (gpsEnabled && punchModes.includes('smartphone') && (!gpsLat || !gpsLng)) {
    return { error: 'スマホ打刻でGPS確認を有効にするには、店舗の位置を設定してください' }
  }

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_user_id', user.id)
    .single()

  if (!org) return { error: '組織が見つかりません' }

  // フリープランは1店舗まで（プロは無制限）
  if (!(await isOrgPro(admin, org.id))) {
    const { count } = await admin
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
    if ((count ?? 0) >= 1) {
      return { error: 'フリープランは1店舗までです。プロプランにアップグレードしてください' }
    }
  }

  const { data: shop, error } = await admin
    .from('shops')
    .insert({
      organization_id: org.id,
      name,
      prefecture,
      punch_modes: punchModes,
      gps_enabled: gpsEnabled,
      gps_radius_m: gpsRadius,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
    })
    .select('id')
    .single()

  if (error) return { error: '店舗の作成に失敗しました: ' + error.message }

  redirect(`/shops/${shop.id}`)
}

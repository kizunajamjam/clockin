'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type PunchResult =
  | { success: true; type: 'in' | 'out'; shopName: string }
  | { success: false; error: string }

export async function punchSmartphone(formData: FormData): Promise<PunchResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'ログインが必要です' }

  const shopId = formData.get('shop_id') as string
  const gpsLat = formData.get('gps_lat') ? parseFloat(formData.get('gps_lat') as string) : null
  const gpsLng = formData.get('gps_lng') ? parseFloat(formData.get('gps_lng') as string) : null

  const admin = createAdminClient()

  // スタッフ情報取得
  const { data: staffRecord } = await admin
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!staffRecord) return { success: false, error: 'スタッフ情報が見つかりません' }

  // 店舗情報取得（GPS設定確認）
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, gps_enabled, gps_lat, gps_lng, gps_radius_m, punch_modes')
    .eq('id', shopId)
    .single()
  if (!shop) return { success: false, error: '店舗が見つかりません' }

  const punchModes = shop.punch_modes as string[]
  if (!punchModes.includes('smartphone')) {
    return { success: false, error: 'この店舗はスマホ打刻が無効です' }
  }

  // 所属確認
  const { data: shopStaff } = await admin
    .from('shop_staff')
    .select('id')
    .eq('shop_id', shopId)
    .eq('staff_id', staffRecord.id)
    .eq('is_active', true)
    .single()
  if (!shopStaff) return { success: false, error: 'この店舗のスタッフではありません' }

  // GPS確認
  if (shop.gps_enabled) {
    if (gpsLat === null || gpsLng === null) {
      return { success: false, error: 'GPS位置情報を取得できませんでした' }
    }
    if (shop.gps_lat && shop.gps_lng) {
      const dist = haversineM(gpsLat, gpsLng, shop.gps_lat, shop.gps_lng)
      if (dist > shop.gps_radius_m) {
        return { success: false, error: `店舗から離れすぎています（${Math.round(dist)}m / 許可半径${shop.gps_radius_m}m）` }
      }
    }
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('attendances')
    .select('id, clocked_in_at, clocked_out_at')
    .eq('shop_id', shopId)
    .eq('staff_id', staffRecord.id)
    .eq('date', today)
    .single()

  if (!existing) {
    await admin.from('attendances').insert({
      shop_id: shopId,
      staff_id: staffRecord.id,
      date: today,
      clocked_in_at: now,
      punch_mode: 'smartphone',
      gps_lat: gpsLat,
      gps_lng: gpsLng,
    })
    return { success: true, type: 'in', shopName: shop.name }
  }

  if (existing.clocked_in_at && !existing.clocked_out_at) {
    await admin.from('attendances').update({
      clocked_out_at: now,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
    }).eq('id', existing.id)
    return { success: true, type: 'out', shopName: shop.name }
  }

  return { success: false, error: '本日の打刻は既に完了しています' }
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

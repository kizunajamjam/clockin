'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin } from '@/lib/pin'
import { revalidatePath } from 'next/cache'

type State = { error: string } | { success: string } | null

export async function updateStaff(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const staffId = formData.get('staff_id') as string
  const shopId = formData.get('shop_id') as string
  const name = (formData.get('name') as string).trim()
  const hourlyRate = parseInt(formData.get('hourly_rate') as string, 10)
  const transportFee = parseInt(formData.get('transport_fee') as string, 10) || 0
  const transportFeeType = formData.get('transport_fee_type') as string
  const nightRateIncluded = formData.get('night_rate_included') === 'true'
  const gender = (formData.get('gender') as string) || null
  const pin = (formData.get('pin') as string).trim()
  const incomeAlertRaw = formData.get('income_alert_amount') as string
  const incomeAlertAmount = incomeAlertRaw ? parseInt(incomeAlertRaw, 10) : null
  const isActive = formData.get('is_active') !== 'false'

  if (!name) return { error: 'スタッフ名を入力してください' }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return { error: '時給を正しく入力してください' }
  if (pin && !/^\d{4}$/.test(pin)) return { error: 'PINは4桁の数字で入力してください' }

  const admin = createAdminClient()

  // オーナー権限確認
  const { data: shop } = await admin.from('shops').select('organization_id').eq('id', shopId).single()
  if (!shop) return { error: '店舗が見つかりません' }
  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) return { error: '権限がありません' }

  const staffUpdate: Record<string, unknown> = { name, gender, income_alert_amount: incomeAlertAmount }
  if (pin) staffUpdate.pin = await hashPin(pin, staffId)

  const { error: staffErr } = await admin.from('staff').update(staffUpdate).eq('id', staffId).eq('organization_id', shop.organization_id)
  if (staffErr) return { error: 'スタッフ情報の更新に失敗しました: ' + staffErr.message }

  const { error: ssErr } = await admin.from('shop_staff').update({
    hourly_rate: hourlyRate,
    transport_fee: transportFee,
    transport_fee_type: transportFeeType,
    night_rate_included: nightRateIncluded,
    is_active: isActive,
  }).eq('shop_id', shopId).eq('staff_id', staffId)
  if (ssErr) return { error: '給与設定の更新に失敗しました: ' + ssErr.message }

  revalidatePath(`/shops/${shopId}/staff/${staffId}`)
  revalidatePath(`/shops/${shopId}`)
  return { success: '更新しました' }
}

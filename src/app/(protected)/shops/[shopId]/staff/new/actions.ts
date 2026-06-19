'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPin } from '@/lib/pin'
import { isProStatus } from '@/lib/plan'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function createStaff(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

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

  if (!name) return { error: 'スタッフ名を入力してください' }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return { error: '時給を正しく入力してください' }
  if (pin && !/^\d{4,6}$/.test(pin)) return { error: 'PINは4〜6桁の数字で入力してください' }

  const admin = createAdminClient()

  // オーナー確認
  const { data: shop } = await admin
    .from('shops')
    .select('id, organization_id, punch_modes')
    .eq('id', shopId)
    .single()
  if (!shop) return { error: '店舗が見つかりません' }

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) return { error: '権限がありません' }

  // フリープラン: 5名上限チェック（プロプランは無制限）
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status')
    .eq('organization_id', shop.organization_id)
    .single()

  if (!isProStatus(sub?.status)) {
    const { count } = await admin
      .from('shop_staff')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('is_active', true)
    if ((count ?? 0) >= 5) {
      return { error: 'フリープランのスタッフ上限（5名）に達しています。プロプランにアップグレードしてください' }
    }
  }

  // タブレット打刻が有効な場合はPIN必須
  const punchModes = shop.punch_modes as string[]
  if (punchModes.includes('tablet') && !pin) {
    return { error: 'タブレット打刻が有効な場合、PINは必須です' }
  }

  // staff レコード作成
  const staffId = crypto.randomUUID()
  const inviteToken = crypto.randomUUID()
  const pinHash = pin ? await hashPin(pin, staffId) : null

  const { error: staffError } = await admin.from('staff').insert({
    id: staffId,
    organization_id: shop.organization_id,
    name,
    gender: gender || null,
    income_alert_amount: incomeAlertAmount,
    pin: pinHash,
    invite_token: inviteToken,
  })
  if (staffError) return { error: 'スタッフの作成に失敗しました: ' + staffError.message }

  // shop_staff レコード作成
  const { error: ssError } = await admin.from('shop_staff').insert({
    shop_id: shopId,
    staff_id: staffId,
    hourly_rate: hourlyRate,
    transport_fee: transportFee,
    transport_fee_type: transportFeeType || 'daily',
    night_rate_included: nightRateIncluded,
  })
  if (ssError) return { error: 'スタッフの店舗登録に失敗しました: ' + ssError.message }

  redirect(`/shops/${shopId}`)
}

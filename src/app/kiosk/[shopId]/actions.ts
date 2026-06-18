'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPin } from '@/lib/pin'

export async function getAttendanceStatus(staffId: string, shopId: string): Promise<'in' | 'out' | 'done'> {
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const { data } = await admin
    .from('attendances')
    .select('clocked_in_at, clocked_out_at')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', today)
    .single()

  if (!data || !data.clocked_in_at) return 'in'
  if (!data.clocked_out_at) return 'out'
  return 'done'
}

type PunchResult =
  | { success: true; type: 'in' | 'out'; staffName: string }
  | { success: false; error: string }

export async function punchTablet(formData: FormData): Promise<PunchResult> {
  const staffId = formData.get('staff_id') as string
  const shopId = formData.get('shop_id') as string
  const pin = formData.get('pin') as string

  if (!staffId || !shopId || !pin) return { success: false, error: '入力が不正です' }
  if (!/^\d{4}$/.test(pin)) return { success: false, error: 'PINは4桁の数字です' }

  const admin = createAdminClient()

  // スタッフ取得（PIN検証用）
  const { data: staff } = await admin
    .from('staff')
    .select('id, name, pin')
    .eq('id', staffId)
    .single()

  if (!staff) return { success: false, error: 'スタッフが見つかりません' }
  if (!staff.pin) return { success: false, error: 'PINが設定されていません' }

  const valid = await verifyPin(pin, staffId, staff.pin)
  if (!valid) return { success: false, error: 'PINが正しくありません' }

  // 今日の打刻レコードを確認
  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD
  const { data: existing } = await admin
    .from('attendances')
    .select('id, clocked_in_at, clocked_out_at')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', today)
    .single()

  const now = new Date().toISOString()

  if (!existing) {
    // 出勤打刻
    const { error } = await admin.from('attendances').insert({
      shop_id: shopId,
      staff_id: staffId,
      date: today,
      clocked_in_at: now,
      punch_mode: 'tablet',
    })
    if (error) return { success: false, error: '打刻に失敗しました' }
    return { success: true, type: 'in', staffName: staff.name }
  }

  if (existing.clocked_in_at && !existing.clocked_out_at) {
    // 退勤打刻
    const { error } = await admin
      .from('attendances')
      .update({ clocked_out_at: now })
      .eq('id', existing.id)
    if (error) return { success: false, error: '打刻に失敗しました' }
    return { success: true, type: 'out', staffName: staff.name }
  }

  return { success: false, error: '本日の打刻は既に完了しています' }
}

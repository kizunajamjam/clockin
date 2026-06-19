'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPin, hashPin, needsRehash } from '@/lib/pin'

// PINブルートフォース対策：連続N回失敗でM分ロック
const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_MINUTES = 5

// 未退勤レコードがあれば'out'、なければ'in'（複数回打刻対応）
export async function getAttendanceStatus(staffId: string, shopId: string): Promise<'in' | 'out'> {
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const { data } = await admin
    .from('attendances')
    .select('id')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', today)
    .is('clocked_out_at', null)
    .limit(1)
    .single()

  return data ? 'out' : 'in'
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

  const { data: staff } = await admin
    .from('staff')
    .select('id, name, pin, pin_failed_count, pin_locked_until')
    .eq('id', staffId)
    .single()

  if (!staff) return { success: false, error: 'スタッフが見つかりません' }
  if (!staff.pin) return { success: false, error: 'PINが設定されていません' }

  // ロック中か確認
  const nowDate = new Date()
  const lockedUntil = staff.pin_locked_until ? new Date(staff.pin_locked_until) : null
  if (lockedUntil && lockedUntil > nowDate) {
    const mins = Math.ceil((lockedUntil.getTime() - nowDate.getTime()) / 60000)
    return { success: false, error: `PINの試行回数が上限に達しました。約${mins}分後に再試行してください` }
  }
  // ロック期限切れなら失敗カウントはリセット扱い
  const prevFailed = lockedUntil ? 0 : (staff.pin_failed_count ?? 0)

  const valid = await verifyPin(pin, staffId, staff.pin)
  if (!valid) {
    const failed = prevFailed + 1
    if (failed >= MAX_PIN_ATTEMPTS) {
      const newLock = new Date(nowDate.getTime() + PIN_LOCK_MINUTES * 60000).toISOString()
      await admin.from('staff').update({ pin_failed_count: failed, pin_locked_until: newLock }).eq('id', staffId)
      return { success: false, error: `PINを${MAX_PIN_ATTEMPTS}回間違えました。約${PIN_LOCK_MINUTES}分間ロックします` }
    }
    await admin.from('staff').update({ pin_failed_count: failed, pin_locked_until: null }).eq('id', staffId)
    return { success: false, error: `PINが正しくありません（あと${MAX_PIN_ATTEMPTS - failed}回）` }
  }

  // 成功 → 失敗カウンタ/ロックをリセット。旧形式ハッシュなら現行パラメータへ昇格
  const reset: Record<string, unknown> = {}
  if ((staff.pin_failed_count ?? 0) !== 0 || staff.pin_locked_until) {
    reset.pin_failed_count = 0
    reset.pin_locked_until = null
  }
  if (needsRehash(staff.pin)) {
    reset.pin = await hashPin(pin, staffId)
  }
  if (Object.keys(reset).length > 0) {
    await admin.from('staff').update(reset).eq('id', staffId)
  }

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const now = new Date().toISOString()

  // 未退勤レコードを探す
  const { data: openRecord } = await admin
    .from('attendances')
    .select('id')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', today)
    .is('clocked_out_at', null)
    .limit(1)
    .single()

  if (openRecord) {
    // 退勤打刻
    const { error } = await admin
      .from('attendances')
      .update({ clocked_out_at: now })
      .eq('id', openRecord.id)
    if (error) return { success: false, error: '打刻に失敗しました' }
    return { success: true, type: 'out', staffName: staff.name }
  } else {
    // 出勤打刻（新規レコード挿入）
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
}

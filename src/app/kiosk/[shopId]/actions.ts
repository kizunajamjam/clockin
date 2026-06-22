'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPin, hashPin, needsRehash } from '@/lib/pin'
import { headers } from 'next/headers'

// PINブルートフォース対策：連続N回失敗でM分ロック（staff単位）
const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_MINUTES = 5
// IP単位スロットリング：同一IPからの失敗がW分間にM件でブロック（staff横断の総当たり対策）
const IP_MAX_FAILS = 20
const IP_WINDOW_MINUTES = 10

// クライアントIPを取得（Cloudflare / 一般的なプロキシヘッダ）
async function getClientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('cf-connecting-ip')
    ?? h.get('x-forwarded-for')?.split(',')[0].trim()
    ?? null
}

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

type PinVerifyResult =
  | { ok: true; staffName: string }
  | { ok: false; error: string }

// PIN検証共通処理（ロックアウト・IPスロットリング・監査ログ・旧形式ハッシュの昇格を含む）
// 打刻・ドリンクバックカウントの両方から利用する
async function verifyStaffPin(staffId: string, shopId: string, pin: string): Promise<PinVerifyResult> {
  if (!staffId || !shopId || !pin) return { ok: false, error: '入力が不正です' }
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'PINは4〜6桁の数字です' }

  const admin = createAdminClient()
  const ip = await getClientIp()

  // 監査ログ記録（失敗時はIPスロットリングの母数になる）
  const logAttempt = (success: boolean, sid: string | null) =>
    admin.from('punch_attempts').insert({ shop_id: shopId, staff_id: sid, success, ip })

  // IP単位スロットリング（同一IPからの失敗集中をブロック）
  if (ip) {
    const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60000).toISOString()
    const { count } = await admin
      .from('punch_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('success', false)
      .gte('created_at', since)
    if ((count ?? 0) >= IP_MAX_FAILS) {
      return { ok: false, error: '試行回数が多すぎます。しばらく待ってから再試行してください' }
    }
  }

  const { data: staff } = await admin
    .from('staff')
    .select('id, name, pin, pin_failed_count, pin_locked_until')
    .eq('id', staffId)
    .single()

  if (!staff) { await logAttempt(false, null); return { ok: false, error: 'スタッフが見つかりません' } }
  if (!staff.pin) return { ok: false, error: 'PINが設定されていません' }

  // ロック中か確認
  const nowDate = new Date()
  const lockedUntil = staff.pin_locked_until ? new Date(staff.pin_locked_until) : null
  if (lockedUntil && lockedUntil > nowDate) {
    const mins = Math.ceil((lockedUntil.getTime() - nowDate.getTime()) / 60000)
    await logAttempt(false, staffId)
    return { ok: false, error: `PINの試行回数が上限に達しました。約${mins}分後に再試行してください` }
  }
  // ロック期限切れなら失敗カウントはリセット扱い
  const prevFailed = lockedUntil ? 0 : (staff.pin_failed_count ?? 0)

  const valid = await verifyPin(pin, staffId, staff.pin)
  if (!valid) {
    const failed = prevFailed + 1
    await logAttempt(false, staffId)
    if (failed >= MAX_PIN_ATTEMPTS) {
      const newLock = new Date(nowDate.getTime() + PIN_LOCK_MINUTES * 60000).toISOString()
      await admin.from('staff').update({ pin_failed_count: failed, pin_locked_until: newLock }).eq('id', staffId)
      return { ok: false, error: `PINを${MAX_PIN_ATTEMPTS}回間違えました。約${PIN_LOCK_MINUTES}分間ロックします` }
    }
    await admin.from('staff').update({ pin_failed_count: failed, pin_locked_until: null }).eq('id', staffId)
    return { ok: false, error: `PINが正しくありません（あと${MAX_PIN_ATTEMPTS - failed}回）` }
  }

  await logAttempt(true, staffId)

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

  return { ok: true, staffName: staff.name }
}

type PunchResult =
  | { success: true; type: 'in' | 'out'; staffName: string }
  | { success: false; error: string }

export async function punchTablet(formData: FormData): Promise<PunchResult> {
  const staffId = formData.get('staff_id') as string
  const shopId = formData.get('shop_id') as string
  const pin = formData.get('pin') as string

  const verified = await verifyStaffPin(staffId, shopId, pin)
  if (!verified.ok) return { success: false, error: verified.error }

  const admin = createAdminClient()
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
    return { success: true, type: 'out', staffName: verified.staffName }
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
    return { success: true, type: 'in', staffName: verified.staffName }
  }
}

// ── ドリンクバックカウント ──────────────────────────────────────
type DrinkOpenResult =
  | { success: true; counts: Record<string, number> }
  | { success: false; error: string }

function todayJst(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

async function getDrinkCounts(admin: ReturnType<typeof createAdminClient>, shopId: string, staffId: string, date: string): Promise<Record<string, number>> {
  const { data } = await admin
    .from('drink_back_counts')
    .select('item_id, count')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', date)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.item_id] = row.count
  return counts
}

// ドリンクバックカウント画面を開く（本日のジャンル別カウントを返す。PIN不要）
export async function openDrinkCounter(staffId: string, shopId: string): Promise<DrinkOpenResult> {
  if (!staffId || !shopId) return { success: false, error: '入力が不正です' }
  const admin = createAdminClient()
  const counts = await getDrinkCounts(admin, shopId, staffId, todayJst())
  return { success: true, counts }
}

type DrinkCountResult = { success: true; itemId: string; count: number } | { success: false; error: string }

async function adjustDrinkCount(staffId: string, shopId: string, itemId: string, delta: number): Promise<DrinkCountResult> {
  if (!staffId || !shopId || !itemId) return { success: false, error: '入力が不正です' }

  const admin = createAdminClient()
  const date = todayJst()
  const { data: existing } = await admin
    .from('drink_back_counts')
    .select('count')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .eq('date', date)
    .eq('item_id', itemId)
    .single()
  const next = Math.max(0, (existing?.count ?? 0) + delta)

  const { error } = await admin
    .from('drink_back_counts')
    .upsert(
      { shop_id: shopId, staff_id: staffId, date, item_id: itemId, count: next, updated_at: new Date().toISOString() },
      { onConflict: 'shop_id,staff_id,date,item_id' }
    )
  if (error) return { success: false, error: '更新に失敗しました' }

  return { success: true, itemId, count: next }
}

export async function incrementDrinkCount(formData: FormData): Promise<DrinkCountResult> {
  return adjustDrinkCount(formData.get('staff_id') as string, formData.get('shop_id') as string, formData.get('item_id') as string, 1)
}

export async function decrementDrinkCount(formData: FormData): Promise<DrinkCountResult> {
  return adjustDrinkCount(formData.get('staff_id') as string, formData.get('shop_id') as string, formData.get('item_id') as string, -1)
}

'use server'
import { getOwnerShop } from '@/lib/auth'
import { sendPushToStaff } from '@/lib/push'
import { revalidatePath } from 'next/cache'

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('sv-SE')
}

// 'HH:MM[:SS]' を 'HH:MM' に正規化
function hhmm(t: string): string {
  return t.slice(0, 5)
}

function fmtJpDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', weekday: 'short',
  })
}

export async function createShift(prevState: unknown, formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const staffId = formData.get('staff_id') as string
  const date = formData.get('date') as string       // YYYY-MM-DD
  const startTime = formData.get('starts_at') as string  // HH:mm
  const endTime = formData.get('ends_at') as string      // HH:mm
  const breakMinutes = parseInt(formData.get('break_minutes') as string || '0')
  const note = formData.get('note') as string

  if (!staffId || !date || !startTime || !endTime) return { error: '必須項目を入力してください' }

  // 終了が開始より早い場合は翌日扱い
  const startsAt = `${date}T${startTime}:00+09:00`
  const endDate = endTime <= startTime ? addOneDay(date) : date
  const endsAt = `${endDate}T${endTime}:00+09:00`

  if (new Date(startsAt) >= new Date(endsAt)) return { error: '終了時間は開始時間より後にしてください' }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  const { error } = await ctx.admin.from('shifts').insert({
    shop_id: shopId,
    staff_id: staffId,
    starts_at: startsAt,
    ends_at: endsAt,
    break_minutes: breakMinutes,
    note: note || null,
    created_by: ctx.userId,
  })
  if (error) return { error: error.message }

  revalidatePath(`/shops/${shopId}/shifts`)
  return { success: true }
}

export async function updateShiftRequestStatus(formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const requestId = formData.get('request_id') as string
  const status = formData.get('status') as string

  if (!['approved', 'rejected', 'pending'].includes(status)) return { error: '不正なステータスです' }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  // 通知用に対象希望を取得（店舗スコープで認可）
  const { data: req } = await ctx.admin
    .from('shift_requests')
    .select('staff_id, date')
    .eq('id', requestId)
    .eq('shop_id', shopId)
    .single()
  if (!req) return { error: '対象の希望シフトが見つかりません' }

  const { error } = await ctx.admin.from('shift_requests').update({ status }).eq('id', requestId).eq('shop_id', shopId)
  if (error) return { error: error.message }

  // スタッフへプッシュ通知（承認/却下時のみ。VAPID未設定時は自動スキップ）
  if (status === 'approved' || status === 'rejected') {
    await sendPushToStaff(req.staff_id, {
      title: status === 'approved' ? '希望シフトが承認されました' : '希望シフトが却下されました',
      body: fmtJpDate(req.date),
      url: '/punch/shifts',
    })
  }

  revalidatePath(`/shops/${shopId}/shifts`)
  return { success: true }
}

// 承認した希望シフトを確定シフト(shifts)へ反映する
export async function createShiftFromRequest(formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const requestId = formData.get('request_id') as string

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  const { data: req } = await ctx.admin
    .from('shift_requests')
    .select('staff_id, date, start_time, end_time, note')
    .eq('id', requestId)
    .eq('shop_id', shopId)
    .single()
  if (!req) return { error: '対象の希望シフトが見つかりません' }
  if (!req.start_time || !req.end_time) {
    return { error: '希望時刻が未指定のため確定シフトに反映できません' }
  }

  const startTime = hhmm(req.start_time)
  const endTime = hhmm(req.end_time)
  const startsAt = `${req.date}T${startTime}:00+09:00`
  const endDate = endTime <= startTime ? addOneDay(req.date) : req.date
  const endsAt = `${endDate}T${endTime}:00+09:00`

  const { error } = await ctx.admin.from('shifts').insert({
    shop_id: shopId,
    staff_id: req.staff_id,
    starts_at: startsAt,
    ends_at: endsAt,
    break_minutes: 0,
    note: req.note ?? null,
    created_by: ctx.userId,
  })
  if (error) return { error: error.message }

  // 希望ステータスを承認済みにし、スタッフへ確定通知
  await ctx.admin.from('shift_requests').update({ status: 'approved' }).eq('id', requestId).eq('shop_id', shopId)
  await sendPushToStaff(req.staff_id, {
    title: 'シフトが確定しました',
    body: `${fmtJpDate(req.date)} ${startTime}〜${endTime}`,
    url: '/punch/shifts',
  })

  revalidatePath(`/shops/${shopId}/shifts`)
  return { success: true, shift: { staff_id: req.staff_id, date: req.date, starts_at: startsAt, ends_at: endsAt, note: req.note ?? null } }
}

export async function deleteShift(formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const shiftId = formData.get('shift_id') as string

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return

  await ctx.admin.from('shifts').delete().eq('id', shiftId).eq('shop_id', shopId)
  revalidatePath(`/shops/${shopId}/shifts`)
}

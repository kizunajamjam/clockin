'use server'
import { getAuthedStaff, getAuthedStaffForShop } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function upsertShiftRequest(formData: FormData) {
  const shopId = formData.get('shop_id') as string

  // 所属確認（service_role はRLSを迂回するため、ここで必ず検証する）
  const ctx = await getAuthedStaffForShop(shopId)
  if (!ctx) return { error: 'この店舗のスタッフではありません' }

  const date = formData.get('date') as string
  const startTime = (formData.get('start_time') as string) || null
  const endTime = (formData.get('end_time') as string) || null
  const note = (formData.get('note') as string) || null

  const { error } = await ctx.admin.from('shift_requests').upsert(
    { shop_id: shopId, staff_id: ctx.staffId, date, start_time: startTime, end_time: endTime, note, status: 'pending' },
    { onConflict: 'shop_id,staff_id,date' }
  )
  if (error) return { error: error.message }

  revalidatePath('/punch/shifts')
  return { success: true }
}

export async function deleteShiftRequest(formData: FormData) {
  const ctx = await getAuthedStaff()
  if (!ctx) return

  const requestId = formData.get('request_id') as string

  await ctx.admin.from('shift_requests').delete()
    .eq('id', requestId)
    .eq('staff_id', ctx.staffId)

  revalidatePath('/punch/shifts')
}

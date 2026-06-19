'use server'
import { getOwnerShop } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// カスタム給与項目の月次実績を保存する
// FormData: shop_id, staff_id, year_month, value_<itemId>=数値（空欄は0扱い）
export async function upsertCustomRecords(prevState: unknown, formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const staffId = formData.get('staff_id') as string
  const yearMonth = formData.get('year_month') as string

  const month = Number(yearMonth.slice(5, 7))
  if (!/^\d{4}-\d{2}$/.test(yearMonth) || month < 1 || month > 12) return { error: '対象月が不正です' }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  // スタッフが当該店舗に所属しているか確認（テナント境界）
  const { data: membership } = await ctx.admin
    .from('shop_staff')
    .select('id')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .single()
  if (!membership) return { error: 'この店舗のスタッフではありません' }

  // 当該店舗の項目のみ対象（他店舗のitem_idを弾く）
  const { data: items } = await ctx.admin
    .from('salary_custom_items')
    .select('id')
    .eq('shop_id', shopId)
  const validItemIds = new Set((items ?? []).map(i => i.id))

  const rows: { shop_id: string; staff_id: string; item_id: string; year_month: string; value: number }[] = []
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith('value_')) continue
    const itemId = key.slice('value_'.length)
    if (!validItemIds.has(itemId)) continue
    const value = parseFloat(raw as string)
    rows.push({ shop_id: shopId, staff_id: staffId, item_id: itemId, year_month: yearMonth, value: Number.isFinite(value) ? value : 0 })
  }

  if (rows.length > 0) {
    const { error } = await ctx.admin
      .from('salary_custom_records')
      .upsert(rows, { onConflict: 'staff_id,item_id,year_month' })
    if (error) return { error: error.message }
  }

  revalidatePath(`/shops/${shopId}/payroll/${staffId}`)
  return { success: true }
}

'use server'
import { getOwnerShop } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

const VALID_TYPES = ['count_unit', 'fixed', 'percentage', 'expense', 'time_unit']

// 単価が必要な型（件数×単価 / 時間×単価 / 売上×率）
const NEEDS_UNIT_PRICE = ['count_unit', 'time_unit', 'percentage']

export async function createSalaryItem(prevState: unknown, formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const name = (formData.get('name') as string ?? '').trim()
  const type = formData.get('type') as string
  const unitPriceRaw = formData.get('unit_price') as string

  if (!name) return { error: '項目名を入力してください' }
  if (!VALID_TYPES.includes(type)) return { error: '種類を選択してください' }

  const unitPrice = NEEDS_UNIT_PRICE.includes(type)
    ? (unitPriceRaw ? parseInt(unitPriceRaw, 10) : NaN)
    : null
  if (NEEDS_UNIT_PRICE.includes(type) && (!Number.isFinite(unitPrice!) || unitPrice! < 0)) {
    return { error: '単価（または率）を正しく入力してください' }
  }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  // 末尾に追加するため現在の最大 sort_order + 1
  const { data: last } = await ctx.admin
    .from('salary_custom_items')
    .select('sort_order')
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await ctx.admin.from('salary_custom_items').insert({
    shop_id: shopId,
    name,
    type,
    unit_price: unitPrice,
    sort_order: (last?.sort_order ?? -1) + 1,
  })
  if (error) return { error: error.message }

  revalidatePath(`/shops/${shopId}/salary-items`)
  return { success: true }
}

export async function updateSalaryItem(prevState: unknown, formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const itemId = formData.get('item_id') as string
  const name = (formData.get('name') as string ?? '').trim()
  const type = formData.get('type') as string
  const unitPriceRaw = formData.get('unit_price') as string

  if (!name) return { error: '項目名を入力してください' }
  if (!VALID_TYPES.includes(type)) return { error: '種類を選択してください' }

  const unitPrice = NEEDS_UNIT_PRICE.includes(type)
    ? (unitPriceRaw ? parseInt(unitPriceRaw, 10) : NaN)
    : null
  if (NEEDS_UNIT_PRICE.includes(type) && (!Number.isFinite(unitPrice!) || unitPrice! < 0)) {
    return { error: '単価（または率）を正しく入力してください' }
  }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  const { error } = await ctx.admin
    .from('salary_custom_items')
    .update({ name, type, unit_price: unitPrice })
    .eq('id', itemId)
    .eq('shop_id', shopId)
  if (error) return { error: error.message }

  revalidatePath(`/shops/${shopId}/salary-items`)
  return { success: true }
}

export async function deleteSalaryItem(formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const itemId = formData.get('item_id') as string

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return

  // 紐づく月次実績も含めて削除（FK ON DELETE CASCADE で salary_custom_records も消える）
  await ctx.admin.from('salary_custom_items').delete().eq('id', itemId).eq('shop_id', shopId)
  revalidatePath(`/shops/${shopId}/salary-items`)
}

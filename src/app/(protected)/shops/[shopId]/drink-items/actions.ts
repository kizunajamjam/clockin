'use server'
import { getOwnerShop } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createDrinkItem(prevState: unknown, formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const name = (formData.get('name') as string ?? '').trim()

  if (!name) return { error: '項目名を入力してください' }

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return { error: '権限がありません' }

  // 末尾に追加するため現在の最大 sort_order + 1
  const { data: last } = await ctx.admin
    .from('drink_back_items')
    .select('sort_order')
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await ctx.admin.from('drink_back_items').insert({
    shop_id: shopId,
    name,
    sort_order: (last?.sort_order ?? -1) + 1,
  })
  if (error) return { error: error.message }

  revalidatePath(`/shops/${shopId}/drink-items`)
  return { success: true }
}

export async function deleteDrinkItem(formData: FormData) {
  const shopId = formData.get('shop_id') as string
  const itemId = formData.get('item_id') as string

  const ctx = await getOwnerShop(shopId)
  if (!ctx) return

  // 紐づくカウント実績も含めて削除（FK ON DELETE CASCADE で drink_back_counts も消える）
  await ctx.admin.from('drink_back_items').delete().eq('id', itemId).eq('shop_id', shopId)
  revalidatePath(`/shops/${shopId}/drink-items`)
}

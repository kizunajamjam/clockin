// 認可ヘルパ
//
// 本アプリは service_role クライアント（createAdminClient）でRLSを迂回してCRUDするため、
// 認可は「各経路でのアプリ層チェック」に依存する。チェック漏れ＝全権限バイパスになるので、
// service_role を使うアクションは必ず本モジュールのヘルパで本人・所属・所有を検証すること。
//
// - getAuthedStaff()         : ログイン中ユーザーに紐づく staff を解決
// - getAuthedStaffForShop()  : 上記 + 指定店舗へのアクティブ所属を検証
// - getOwnerShop()           : ログイン中ユーザーが所有する組織配下の店舗かを検証

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export type AuthedStaff = {
  userId: string
  staffId: string
  admin: Admin
}

/** ログイン中ユーザーに紐づく staff を解決する。未ログイン or staff未登録なら null */
export async function getAuthedStaff(): Promise<AuthedStaff | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: staff } = await admin.from('staff').select('id').eq('user_id', user.id).single()
  if (!staff) return null

  return { userId: user.id, staffId: staff.id, admin }
}

/** staff が指定店舗にアクティブ所属しているか検証する。所属していなければ null */
export async function getAuthedStaffForShop(shopId: string): Promise<AuthedStaff | null> {
  const ctx = await getAuthedStaff()
  if (!ctx) return null

  const { data: membership } = await ctx.admin
    .from('shop_staff')
    .select('id')
    .eq('shop_id', shopId)
    .eq('staff_id', ctx.staffId)
    .eq('is_active', true)
    .single()
  if (!membership) return null

  return ctx
}

export type OwnerShop = {
  userId: string
  shop: { id: string; organization_id: string }
  admin: Admin
}

/** ログイン中ユーザーが所有する組織配下の店舗かを検証する。所有していなければ null */
export async function getOwnerShop(shopId: string): Promise<OwnerShop | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id, organization_id')
    .eq('id', shopId)
    .single()
  if (!shop) return null

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) return null

  return { userId: user.id, shop, admin }
}

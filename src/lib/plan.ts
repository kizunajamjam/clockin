// プラン判定ヘルパ
// subscriptions.status が active / trialing のとき「プロ」とみなす。
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export function isProStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/** 組織がプロプランか判定する */
export async function isOrgPro(admin: Admin, organizationId: string): Promise<boolean> {
  const { data } = await admin
    .from('subscriptions')
    .select('status')
    .eq('organization_id', organizationId)
    .single()
  return isProStatus(data?.status)
}

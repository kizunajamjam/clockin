'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type State = { error: string } | { success: string } | null

export async function correctAttendance(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const attendanceId = formData.get('attendance_id') as string
  const shopId = formData.get('shop_id') as string
  const clockedInAt = formData.get('clocked_in_at') as string
  const clockedOutAt = (formData.get('clocked_out_at') as string) || null
  const note = (formData.get('note') as string).trim()

  if (!note) return { error: '修正理由を入力してください' }

  const admin = createAdminClient()

  // オーナー権限確認
  const { data: shop } = await admin
    .from('shops')
    .select('organization_id')
    .eq('id', shopId)
    .single()
  if (!shop) return { error: '店舗が見つかりません' }

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) return { error: '権限がありません' }

  const { error } = await admin
    .from('attendances')
    .update({
      clocked_in_at: clockedInAt || null,
      clocked_out_at: clockedOutAt || null,
      note,
    })
    .eq('id', attendanceId)

  if (error) return { error: '更新に失敗しました: ' + error.message }

  revalidatePath(`/shops/${shopId}/attendance`)
  return { success: '修正しました' }
}

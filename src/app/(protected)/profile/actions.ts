'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type State = { error: string } | { success: string } | null

export async function updateProfile(prevState: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const incomeAlertRaw = formData.get('income_alert_amount') as string
  const incomeAlertAmount = incomeAlertRaw ? parseInt(incomeAlertRaw, 10) : null

  const admin = createAdminClient()
  const { error } = await admin
    .from('staff')
    .update({ income_alert_amount: incomeAlertAmount })
    .eq('user_id', user.id)

  if (error) return { error: '更新に失敗しました: ' + error.message }

  revalidatePath('/profile')
  return { success: '更新しました' }
}

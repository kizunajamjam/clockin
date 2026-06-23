'use server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

type State = { error: string } | { success: string } | null

export async function requestPasswordReset(prevState: State, formData: FormData): Promise<State> {
  const email = (formData.get('email') as string).trim().toLowerCase()
  if (!email) return { error: 'メールアドレスを入力してください' }

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/confirm?next=/reset-password/update`,
  })

  // 登録済みメールかどうかを区別せず常に同じ文言を返す（メールアドレスの存在を推測されないようにする）
  return { success: 'このメールアドレスが登録されていれば、再設定用のメールを送信しました' }
}

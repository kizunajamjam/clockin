'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function updatePassword(prevState: State, formData: FormData): Promise<State> {
  const password = formData.get('password') as string
  if (!password || password.length < 8) return { error: 'パスワードは8文字以上で入力してください' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'リンクの期限が切れています。もう一度メールの送信からお試しください' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'パスワードの更新に失敗しました: ' + error.message }

  redirect('/dashboard')
}

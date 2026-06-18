'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function login(prevState: State, formData: FormData): Promise<State> {
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'メールアドレスとパスワードを入力してください' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: 'メールアドレスまたはパスワードが正しくありません' }

  redirect('/dashboard')
}

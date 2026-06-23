'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function acceptInvite(prevState: State, formData: FormData): Promise<State> {
  const token = formData.get('token') as string
  const email = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email) return { error: 'メールアドレスを入力してください' }
  if (!password || password.length < 8) return { error: 'パスワードは8文字以上で入力してください' }

  const admin = createAdminClient()

  // トークンを使用済みにする（同じリンクを複数端末で同時に開いても、行ロックにより
  // この更新が成功するのは1リクエストのみ。先にここで「権利」を確保してから
  // アカウント作成に進むことで、2つのログインアカウントが作られる事故を防ぐ
  const { data: claimed } = await admin
    .from('staff')
    .update({ invite_token: null })
    .eq('invite_token', token)
    .is('user_id', null)
    .select('id, name')
    .single()

  if (!claimed) return { error: '招待リンクが無効、または既に使用されています' }

  // Supabase Authアカウント作成
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) {
    // 作成に失敗したら招待リンクを再利用できるよう戻す
    await admin.from('staff').update({ invite_token: token }).eq('id', claimed.id)
    if (authError.message.includes('already registered')) {
      return { error: 'このメールアドレスは既に登録されています' }
    }
    return { error: 'アカウント作成に失敗しました: ' + authError.message }
  }

  // staffレコードにuser_idを紐付け
  const { error: linkError } = await admin
    .from('staff')
    .update({ user_id: authData.user.id, email })
    .eq('id', claimed.id)

  if (linkError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    await admin.from('staff').update({ invite_token: token }).eq('id', claimed.id)
    return { error: 'アカウントの紐付けに失敗しました' }
  }

  redirect('/punch-complete')
}

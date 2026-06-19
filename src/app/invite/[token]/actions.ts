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

  // トークンでスタッフを検索
  const { data: staffRecord } = await admin
    .from('staff')
    .select('id, name, user_id')
    .eq('invite_token', token)
    .single()

  if (!staffRecord) return { error: '招待リンクが無効または期限切れです' }
  if (staffRecord.user_id) return { error: 'この招待リンクは既に使用されています' }

  // Supabase Authアカウント作成
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: 'このメールアドレスは既に登録されています' }
    }
    return { error: 'アカウント作成に失敗しました: ' + authError.message }
  }

  // staffレコードにuser_idを紐付け
  const { error: linkError } = await admin
    .from('staff')
    .update({ user_id: authData.user.id, email, invite_token: null })
    .eq('id', staffRecord.id)

  if (linkError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'アカウントの紐付けに失敗しました' }
  }

  redirect('/punch-complete')
}

'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

type State = { error: string } | null

export async function signUp(prevState: State, formData: FormData): Promise<State> {
  const email = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const organizationName = (formData.get('organization_name') as string).trim()

  if (!email || !password || !organizationName) {
    return { error: 'すべての項目を入力してください' }
  }
  if (password.length < 8) {
    return { error: 'パスワードは8文字以上で入力してください' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'アカウントの作成に失敗しました' }

  const admin = createAdminClient()
  const { error: orgError } = await admin.from('organizations').insert({
    name: organizationName,
    owner_user_id: data.user.id,
  })

  if (orgError) {
    // 組織作成に失敗したら、孤児となるauthユーザーを掃除する
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: '組織の作成に失敗しました: ' + orgError.message }
  }

  redirect('/dashboard')
}

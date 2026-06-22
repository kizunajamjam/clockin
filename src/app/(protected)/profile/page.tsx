import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: staffRecord } = await admin
    .from('staff')
    .select('name, email')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← ダッシュボード</Link>
        <h1 className="font-bold text-lg">プロフィール</h1>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-4">
        {staffRecord ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
              <p className="font-medium text-lg">{staffRecord.name}</p>
              <p className="text-gray-500">{staffRecord.email ?? user.email}</p>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
            <p>スタッフ情報が見つかりません。</p>
            <p className="text-xs mt-1 text-gray-400">オーナーアカウントではこの画面は使用しません。</p>
          </div>
        )}
      </main>
    </div>
  )
}

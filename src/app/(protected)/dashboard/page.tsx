import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logout } from '@/app/logout/actions'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', user!.id)
    .single()

  const { data: shops } = org
    ? await admin.from('shops').select('id, name').eq('organization_id', org.id)
    : { data: [] }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">clockin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{org?.name}</span>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-bold">ダッシュボード</h1>

        {!shops || shops.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <p className="text-gray-500 text-sm">まだ店舗が登録されていません</p>
            <Link
              href="/shops/new"
              className="inline-block px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
            >
              最初の店舗を作成する
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => (
              <Link
                key={shop.id}
                href={`/shops/${shop.id}`}
                className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-gray-400 transition-colors"
              >
                <span className="font-medium">{shop.name}</span>
              </Link>
            ))}
            <Link
              href="/shops/new"
              className="block text-center text-sm text-gray-400 hover:text-gray-600 py-2"
            >
              + 店舗を追加
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

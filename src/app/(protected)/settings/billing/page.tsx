import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isProStatus } from '@/lib/plan'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BillingClient } from './BillingClient'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('owner_user_id', user.id)
    .single()
  if (!org) redirect('/dashboard')

  const { data: sub } = await admin
    .from('subscriptions')
    .select('status, seat_count, current_period_end')
    .eq('organization_id', org.id)
    .single()

  // 現在のスタッフ数（全店舗合計）
  const { data: shops } = await admin.from('shops').select('id').eq('organization_id', org.id)
  const shopIds = (shops ?? []).map(s => s.id)
  const { count: staffCount } = shopIds.length > 0
    ? await admin.from('shop_staff').select('id', { count: 'exact', head: true }).in('shop_id', shopIds).eq('is_active', true)
    : { count: 0 }

  const isPro = isProStatus(sub?.status)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← ダッシュボード</Link>
        <h1 className="font-bold text-lg">プラン・お支払い</h1>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-4">
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            ✓ プロプランへのアップグレードが完了しました
          </div>
        )}

        {/* 現在のプラン */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="font-semibold text-sm text-gray-500">現在のプラン</h2>
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold">{isPro ? 'プロ' : 'フリー'}</p>
            {isPro && sub?.current_period_end && (
              <p className="text-xs text-gray-400">
                次回更新: {new Date(sub.current_period_end).toLocaleDateString('ja-JP')}
              </p>
            )}
          </div>
          {isPro ? (
            <p className="text-sm text-gray-600">{sub?.seat_count}名分のシートを契約中</p>
          ) : (
            <p className="text-sm text-gray-500">スタッフ5名まで・1店舗・打刻のみ</p>
          )}
        </div>

        {!isPro && (
          <BillingClient staffCount={staffCount ?? 0} />
        )}

        {/* 機能比較 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">機能</th>
                <th className="text-center px-4 py-3 font-medium text-gray-400">フリー</th>
                <th className="text-center px-4 py-3 font-medium text-gray-900">プロ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ['打刻（タブレット・スマホ）', true, true],
                ['スタッフ数', '5名まで', '無制限'],
                ['店舗数', '1店舗', '無制限'],
                ['シフト作成・共有', false, true],
                ['給与自動計算', false, true],
                ['CSVエクスポート', false, true],
                ['カスタム給与項目', false, true],
                ['広告なし', false, true],
              ].map(([feature, free, pro], i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-gray-700">{feature}</td>
                  <td className="px-4 py-2.5 text-center">
                    {typeof free === 'boolean' ? (free ? '✓' : '—') : <span className="text-gray-500 text-xs">{free}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center font-medium">
                    {typeof pro === 'boolean' ? (pro ? '✓' : '—') : <span className="text-xs">{pro}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

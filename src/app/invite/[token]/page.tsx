import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { InviteForm } from './InviteForm'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: staff } = await admin
    .from('staff')
    .select('id, name, user_id')
    .eq('invite_token', token)
    .single()

  if (!staff) notFound()

  if (staff.user_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full text-center">
          <p className="text-gray-500 text-sm">この招待リンクは既に使用済みです</p>
          <a href="/punch" className="mt-4 block text-sm text-blue-600 hover:underline">打刻画面へ</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full">
        <h1 className="font-bold text-lg mb-1">アカウント作成</h1>
        <InviteForm token={token} staffName={staff.name} />
      </div>
    </div>
  )
}

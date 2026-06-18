import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { NewStaffForm } from './NewStaffForm'

export default async function NewStaffPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params
  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, punch_modes, prefecture')
    .eq('id', shopId)
    .single()
  if (!shop) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">スタッフを追加</h1>
      </header>
      <main className="max-w-lg mx-auto p-6">
        <NewStaffForm
          shopId={shopId}
          hasTablet={(shop.punch_modes as string[]).includes('tablet')}
          prefecture={shop.prefecture ?? null}
        />
      </main>
    </div>
  )
}

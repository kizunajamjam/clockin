import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { StaffEditForm } from './StaffEditForm'

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ shopId: string; staffId: string }>
}) {
  const { shopId, staffId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name, organization_id, punch_modes').eq('id', shopId).single()
  if (!shop) notFound()

  const { data: org } = await admin.from('organizations').select('id').eq('id', shop.organization_id).eq('owner_user_id', user.id).single()
  if (!org) notFound()

  const { data: staffRecord } = await admin
    .from('staff')
    .select('id, name, gender, email, income_alert_amount, invite_token, user_id')
    .eq('id', staffId)
    .single()
  if (!staffRecord) notFound()

  const { data: ss } = await admin
    .from('shop_staff')
    .select('hourly_rate, transport_fee, transport_fee_type, night_rate_included, is_active')
    .eq('shop_id', shopId)
    .eq('staff_id', staffId)
    .single()
  if (!ss) notFound()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  const punchModes = shop.punch_modes as string[]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">{staffRecord.name}</h1>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-4">
        {/* 招待状況 */}
        {!staffRecord.user_id && staffRecord.invite_token && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-800 mb-1">未招待</p>
            <p className="text-amber-700 text-xs break-all">
              招待URL: {baseUrl}/invite/{staffRecord.invite_token}
            </p>
          </div>
        )}
        {staffRecord.user_id && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
            ✓ アカウント登録済み {staffRecord.email && `（${staffRecord.email}）`}
          </div>
        )}

        <StaffEditForm
          staffId={staffId}
          shopId={shopId}
          hasTablet={punchModes.includes('tablet')}
          defaultValues={{
            name: staffRecord.name,
            gender: staffRecord.gender ?? '',
            hourlyRate: ss.hourly_rate,
            transportFee: ss.transport_fee,
            transportFeeType: ss.transport_fee_type,
            nightRateIncluded: ss.night_rate_included,
            incomeAlertAmount: staffRecord.income_alert_amount ?? undefined,
            isActive: ss.is_active,
          }}
        />
      </main>
    </div>
  )
}

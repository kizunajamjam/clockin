import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ShopSettingsForm } from './ShopSettingsForm'

export default async function ShopSettingsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, organization_id, prefecture, punch_modes, gps_enabled, gps_lat, gps_lng, gps_radius_m, week_start, employment_insurance_rate')
    .eq('id', shopId)
    .single()
  if (!shop) notFound()

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('id', shop.organization_id)
    .eq('owner_user_id', user.id)
    .single()
  if (!org) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href={`/shops/${shopId}`} className="text-sm text-gray-500 hover:text-gray-900">← {shop.name}</Link>
        <h1 className="font-bold text-lg">店舗設定</h1>
      </header>
      <main className="max-w-lg mx-auto p-6">
        <ShopSettingsForm
          shopId={shopId}
          defaultValues={{
            name: shop.name,
            prefecture: shop.prefecture ?? '',
            punchModes: shop.punch_modes as string[],
            gpsEnabled: shop.gps_enabled,
            gpsLat: shop.gps_lat?.toString() ?? '',
            gpsLng: shop.gps_lng?.toString() ?? '',
            gpsRadiusM: shop.gps_radius_m,
            weekStart: (shop.week_start as string) ?? 'mon',
            eiRatePercent: (((shop.employment_insurance_rate as number) ?? 0.006) * 100).toString(),
          }}
        />
      </main>
    </div>
  )
}

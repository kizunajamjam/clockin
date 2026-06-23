import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UpdatePasswordForm } from './UpdatePasswordForm'

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/reset-password?error=invalid_link')

  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <UpdatePasswordForm />
    </main>
  )
}

import { ResetPasswordForm } from './ResetPasswordForm'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <ResetPasswordForm linkExpired={error === 'invalid_link'} />
    </main>
  )
}

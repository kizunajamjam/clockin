import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">clockin</h1>
      <p className="text-gray-500 text-center max-w-sm">
        小規模店舗向けのシフト・勤怠・給与管理アプリ
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
        >
          ログイン
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100"
        >
          無料で始める
        </Link>
      </div>
    </main>
  )
}

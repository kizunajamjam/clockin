import Link from 'next/link'

export default function PunchCompletePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="font-bold text-lg mb-2">アカウント作成完了</h1>
        <p className="text-sm text-gray-500 mb-5">
          登録したメールアドレスとパスワードでログインして打刻できます
        </p>
        <Link
          href="/login"
          className="block w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          ログインする
        </Link>
      </div>
    </div>
  )
}

'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from './actions'

export function ResetPasswordForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, isPending] = useActionState(requestPasswordReset, null)

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">パスワードの再設定</h1>
        <p className="text-sm text-gray-500">登録済みのメールアドレスに再設定用のリンクを送ります</p>
      </div>

      {linkExpired && !state && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          リンクの期限が切れています。もう一度メールの送信からお試しください
        </p>
      )}

      {state && 'success' in state ? (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{state.success}</p>
      ) : (
        <form action={action} className="space-y-4">
          {state && 'error' in state && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">メールアドレス</label>
            <input
              id="email" name="email" type="email" required autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="example@mail.com"
            />
          </div>
          <button
            type="submit" disabled={isPending}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '送信中...' : '再設定メールを送る'}
          </button>
        </form>
      )}

      <p className="text-sm text-center text-gray-500">
        <Link href="/login" className="text-gray-900 font-medium hover:underline">ログインに戻る</Link>
      </p>
    </div>
  )
}
